/** Every queue of the system. Names on the broker are <RABBITMQ_QUEUE_PREFIX>.<name>. */
export const QueueName = {
  MAIL: 'mail',
  PROVISIONING: 'provisioning',
  MIGRATION: 'migration',
  EXPORT: 'export',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

// One at a time for long jobs; a long job holds its message unacked for as long as it runs. RabbitMQ closes the channel
// of a consumer holding a message longer than consumer_timeout (default 30 minutes): the broker config raises it to 4 hours.
export const QUEUE_PREFETCH: Record<QueueName, number> = {
  [QueueName.MAIL]: 5,
  [QueueName.PROVISIONING]: 2,
  [QueueName.MIGRATION]: 1,
  [QueueName.EXPORT]: 1,
};

export const queueTopology = (prefix: string, name: QueueName, delaysMs: number[]) => {
  const main = `${prefix}.${name}`;
  return { main, dlq: `${main}.dlq`, retry: delaysMs.map((delay) => ({ delay, queue: `${main}.retry.${delay}` })) };
};
