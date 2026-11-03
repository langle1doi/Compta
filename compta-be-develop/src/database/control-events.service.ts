import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { ControlPrismaService } from './control-prisma.service';

const CHANNEL = 'compte_authz';
const RECONNECT_DELAY_MS = 2_000;

export type AuthzEvent =
  /** Roles, grants or memberships changed: reload the tenant's Casbin policy */
  | { kind: 'policy'; tenantId: string }
  /** User status/token version changed: drop the cached user state */
  | { kind: 'user'; tenantId: string; userId: string }
  /** Tenant status changed: drop the cached tenant lookup */
  | { kind: 'tenant'; tenantId: string; subdomain: string }
  /** A session was revoked: drop its cached state */
  | { kind: 'session'; tenantId: string; sessionId: string }
  /** Platform admin changed (status, role, token version, sessions) */
  | { kind: 'platform_admin'; adminId: string }
  /** Platform role grants changed */
  | { kind: 'platform_policy' }
  /** Plan limits changed: drop the cached plan */
  | { kind: 'plan'; planId: string };

type Handler = (event: AuthzEvent) => void;

/**
 * Cross-instance cache invalidation over Postgres LISTEN/NOTIFY on the control DB.
 * Every instance (including the publisher) receives each event, so caches are dropped
 * everywhere as soon as the change is committed.
 */
@Injectable()
export class ControlEventsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ControlEventsService.name);
  private readonly handlers: Handler[] = [];
  private client?: Client;
  private closing = false;
  private reconnecting = false;

  constructor(
    private readonly control: ControlPrismaService,
    private readonly config: ConfigService,
  ) {}

  subscribe(handler: Handler) {
    this.handlers.push(handler);
  }

  /** Applies locally right away, then broadcasts to the other instances. */
  async publish(event: AuthzEvent) {
    this.dispatch(event);
    await this.control.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(event)})`;
  }

  async onApplicationBootstrap() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.closing = true;
    await this.client?.end().catch(() => undefined);
  }

  private async connect() {
    const client = new Client({ connectionString: this.config.getOrThrow<string>('CONTROL_DATABASE_URL') });
    client.on('notification', (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        this.dispatch(JSON.parse(msg.payload) as AuthzEvent);
      } catch (error) {
        this.logger.warn({ err: error }, 'Ignoring malformed authz event');
      }
    });
    client.on('error', (error) => {
      this.logger.error(
        { code: (error as { code?: string }).code },
        'Authz event listener lost its connection; caches rely on their TTL until it is back',
      );
      this.scheduleReconnect();
    });
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      this.client = client;
    } catch (error) {
      this.logger.error({ errorCode: (error as { code?: string }).code }, 'Cannot start authz event listener');
      await client.end().catch(() => undefined);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.closing || this.reconnecting) return;
    this.reconnecting = true;
    this.client = undefined;
    // Events may have been missed while disconnected: caches also expire on their own TTL.
    setTimeout(() => {
      this.reconnecting = false;
      void this.connect();
    }, RECONNECT_DELAY_MS).unref();
  }

  private dispatch(event: AuthzEvent) {
    for (const handler of this.handlers) handler(event);
  }
}
