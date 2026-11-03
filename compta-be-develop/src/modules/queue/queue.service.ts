import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelModel, ConfirmChannel, connect, ConsumeMessage } from 'amqplib';
import { QUEUE_PREFETCH, QueueName, queueTopology } from './queue-names';
import { decideFailure, NonRetryableError, parseDelays } from './queue-retry';

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const PUBLISH_TIMEOUT_MS = 5_000;
const SHUTDOWN_WAIT_MS = 25_000;
const ATTEMPT_HEADER = 'x-attempt';

export interface QueueConsumer {
  /** Must be idempotent: a message is delivered again if the process dies before the ack. */
  handle(message: unknown): Promise<void>;
  /** Retries are used up or the failure cannot be retried: the message goes to the DLQ after this. */
  onDeadLetter?(message: unknown, error: unknown): Promise<void>;
}

/**
 * RabbitMQ: durable queues, persistent messages, manual ack, retry queues with a TTL (backoff) and a dead-letter queue.
 * Reconnects by itself. Publishing while the broker is down throws: callers keep the work in their outbox row.
 */
@Injectable()
export class QueueService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly prefix: string;
  private readonly delaysMs: number[];
  private readonly url: string;
  private readonly consumers = new Map<QueueName, QueueConsumer>();
  private readonly connectListeners: (() => void)[] = [];
  private readonly inFlight = new Set<Promise<void>>();

  private connection?: ChannelModel;
  private publisher?: ConfirmChannel;
  private consumerChannels: ConfirmChannel[] = [];
  private consuming = false;
  private closing = false;
  private connecting?: Promise<void>;
  private reconnectDelay = RECONNECT_MIN_MS;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('RABBITMQ_URL');
    this.prefix = config.getOrThrow<string>('RABBITMQ_QUEUE_PREFIX');
    this.delaysMs = parseDelays(config.getOrThrow<string>('QUEUE_RETRY_DELAYS_MS'));
  }

  registerConsumer(name: QueueName, consumer: QueueConsumer) {
    this.consumers.set(name, consumer);
  }

  /** Called on each (re)connection: lets outboxes publish what the broker missed. */
  onConnected(listener: () => void) {
    this.connectListeners.push(listener);
  }

  isConnected() {
    return !!this.publisher;
  }

  async onApplicationBootstrap() {
    await this.connectNow();
  }

  /** Runs in the API process (main.ts); CLI jobs only publish. */
  async startConsumers() {
    this.consuming = true;
    if (this.connection) await this.openConsumers();
  }

  async publish(name: QueueName, message: object, messageId: string) {
    const channel = this.publisher;
    if (!channel) throw new Error('Broker is not connected');
    const content = Buffer.from(JSON.stringify(message));
    await this.confirmed(channel, queueTopology(this.prefix, name, this.delaysMs).main, content, { messageId });
  }

  /** Queue depth, used by health details and tests. */
  async depth(queue: string): Promise<number> {
    if (!this.publisher) throw new Error('Broker is not connected');
    return (await this.publisher.checkQueue(queue)).messageCount;
  }

  queueNames(name: QueueName) {
    return queueTopology(this.prefix, name, this.delaysMs);
  }

  async onModuleDestroy() {
    this.closing = true;
    clearTimeout(this.reconnectTimer);
    // Closing a channel fires its close event, which forgets the connection: keep hold of it to close it below
    const connection = this.connection;
    for (const channel of this.consumerChannels) await channel.close().catch(() => undefined);
    // Let running handlers finish; whatever is left is delivered again to another process
    await Promise.race([Promise.allSettled([...this.inFlight]), new Promise((r) => setTimeout(r, SHUTDOWN_WAIT_MS).unref())]);
    await connection?.close().catch(() => undefined);
  }

  private connectNow(): Promise<void> {
    this.connecting ??= this.doConnect().finally(() => (this.connecting = undefined));
    return this.connecting;
  }

  private async doConnect() {
    try {
      const connection = await connect(this.url, { timeout: 5_000 });
      connection.on('error', (error: Error) => this.logger.warn({ errorCode: errorCode(error) }, 'Broker connection error'));
      connection.on('close', () => this.onLost(connection));
      this.connection = connection;

      const publisher = await connection.createConfirmChannel();
      publisher.on('error', (error: Error) => this.logger.warn({ errorCode: errorCode(error) }, 'Broker channel error'));
      publisher.on('close', () => this.onLost(connection));
      await this.assertTopology(publisher);
      this.publisher = publisher;
      if (this.consuming) await this.openConsumers();

      this.reconnectDelay = RECONNECT_MIN_MS;
      this.logger.log('Connected to broker');
      for (const listener of this.connectListeners) listener();
    } catch (error) {
      // Never log the URL: it contains the password
      this.logger.error({ errorCode: errorCode(error) }, 'Cannot connect to broker');
      await this.connection?.close().catch(() => undefined);
      this.reset();
      this.scheduleReconnect();
    }
  }

  private onLost(connection: ChannelModel) {
    if (this.connection !== connection) return;
    this.reset();
    if (this.closing) return;
    this.logger.warn('Lost connection to broker, reconnecting');
    connection.close().catch(() => undefined);
    this.scheduleReconnect();
  }

  private reset() {
    this.connection = undefined;
    this.publisher = undefined;
    this.consumerChannels = [];
  }

  private scheduleReconnect() {
    if (this.closing || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connectNow();
    }, this.reconnectDelay).unref();
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
  }

  private async assertTopology(channel: ConfirmChannel) {
    for (const name of Object.values(QueueName)) {
      const { main, dlq, retry } = queueTopology(this.prefix, name, this.delaysMs);
      await channel.assertQueue(dlq, { durable: true });
      await channel.assertQueue(main, {
        durable: true,
        arguments: { 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': dlq },
      });
      for (const { delay, queue } of retry) {
        // Expired messages go back to the main queue: that is the backoff
        await channel.assertQueue(queue, {
          durable: true,
          arguments: { 'x-message-ttl': delay, 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': main },
        });
      }
    }
  }

  private async openConsumers() {
    if (this.consumerChannels.length > 0 || !this.connection) return;
    const connection = this.connection;
    for (const [name, consumer] of this.consumers) {
      const channel = await connection.createConfirmChannel();
      channel.on('error', (error: Error) => this.logger.warn({ errorCode: errorCode(error), queue: name }, 'Consumer channel error'));
      channel.on('close', () => this.onLost(connection));
      await channel.prefetch(QUEUE_PREFETCH[name]);
      await channel.consume(
        queueTopology(this.prefix, name, this.delaysMs).main,
        (message) => {
          if (!message) return;
          const run = this.deliver(name, consumer, channel, message).finally(() => this.inFlight.delete(run));
          this.inFlight.add(run);
        },
        { noAck: false },
      );
      this.consumerChannels.push(channel);
    }
  }

  private async deliver(name: QueueName, consumer: QueueConsumer, channel: ConfirmChannel, message: ConsumeMessage) {
    let body: unknown;
    try {
      try {
        body = JSON.parse(message.content.toString());
      } catch {
        throw new NonRetryableError('Malformed message');
      }
      await consumer.handle(body);
      channel.ack(message);
    } catch (error) {
      await this.onHandlerFailed(name, consumer, channel, message, body, error);
    }
  }

  private async onHandlerFailed(
    name: QueueName,
    consumer: QueueConsumer,
    channel: ConfirmChannel,
    message: ConsumeMessage,
    body: unknown,
    error: unknown,
  ) {
    const attempt = Number(message.properties.headers?.[ATTEMPT_HEADER] ?? 0);
    const decision = decideFailure(attempt, this.delaysMs, error);
    const { dlq, retry } = queueTopology(this.prefix, name, this.delaysMs);
    try {
      if (decision.kind === 'retry') {
        const target = retry.find((r) => r.delay === decision.delayMs)!.queue;
        await this.confirmed(channel, target, message.content, {
          messageId: message.properties.messageId as string | undefined,
          headers: { [ATTEMPT_HEADER]: decision.attempt },
        });
        this.logger.warn({ queue: name, attempt: decision.attempt, delayMs: decision.delayMs }, 'Job failed, will retry');
      } else {
        // Whatever the hook does, the message goes on: a throw here must not requeue it forever (E-INF-02)
        await Promise.resolve(consumer.onDeadLetter?.(body, error)).catch((hookError: unknown) => {
          this.logger.error({ queue: name, errorCode: errorCode(hookError) }, 'Dead-letter hook failed');
        });
        await this.confirmed(channel, dlq, message.content, {
          messageId: message.properties.messageId as string | undefined,
          headers: { [ATTEMPT_HEADER]: attempt },
        });
        this.logger.error({ queue: name, attempt, reason: (error as Error).message }, 'Job moved to the dead-letter queue');
      }
      channel.ack(message);
    } catch (forwardError) {
      // Could not forward it: leave it to the broker, it is delivered again once the channel is back
      this.logger.error({ queue: name, errorCode: errorCode(forwardError) }, 'Could not forward a failed job');
      try {
        channel.nack(message, false, true);
      } catch {
        // Channel already gone: the broker requeues unacked messages by itself
      }
    }
  }

  private confirmed(channel: ConfirmChannel, queue: string, content: Buffer, options: { messageId?: string; headers?: object }) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Broker did not confirm the message')), PUBLISH_TIMEOUT_MS).unref();
      channel.sendToQueue(queue, content, { persistent: true, contentType: 'application/json', ...options }, (error) => {
        clearTimeout(timer);
        if (error) reject(error instanceof Error ? error : new Error('Broker refused the message'));
        else resolve();
      });
    });
  }
}

function errorCode(error: unknown): string {
  return (error as { code?: string | number }).code?.toString() ?? (error as Error).name ?? 'UNKNOWN';
}
