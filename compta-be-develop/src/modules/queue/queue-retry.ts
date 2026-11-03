/** A handler throws this when another delivery cannot succeed (malformed message, unknown id): straight to the DLQ. */
export class NonRetryableError extends Error {}

export type FailureDecision = { kind: 'retry'; attempt: number; delayMs: number } | { kind: 'dead_letter' };

/** `attempt` = retries already done. One delay per retry; once they are used up the message goes to the dead-letter queue. */
export function decideFailure(attempt: number, delaysMs: number[], error: unknown): FailureDecision {
  if (error instanceof NonRetryableError || attempt >= delaysMs.length) return { kind: 'dead_letter' };
  return { kind: 'retry', attempt: attempt + 1, delayMs: delaysMs[attempt] };
}

export const parseDelays = (value: string) => value.split(',').map(Number);
