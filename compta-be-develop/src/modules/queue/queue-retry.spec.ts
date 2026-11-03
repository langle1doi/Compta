import { decideFailure, NonRetryableError, parseDelays } from './queue-retry';

describe('decideFailure', () => {
  const delays = parseDelays('100,200,300');

  it('retries once per delay, in order, then dead-letters', () => {
    expect(decideFailure(0, delays, new Error('x'))).toEqual({ kind: 'retry', attempt: 1, delayMs: 100 });
    expect(decideFailure(1, delays, new Error('x'))).toEqual({ kind: 'retry', attempt: 2, delayMs: 200 });
    expect(decideFailure(2, delays, new Error('x'))).toEqual({ kind: 'retry', attempt: 3, delayMs: 300 });
    expect(decideFailure(3, delays, new Error('x'))).toEqual({ kind: 'dead_letter' });
  });

  it('sends a non-retryable failure straight to the dead-letter queue', () => {
    expect(decideFailure(0, delays, new NonRetryableError('bad'))).toEqual({ kind: 'dead_letter' });
  });
});
