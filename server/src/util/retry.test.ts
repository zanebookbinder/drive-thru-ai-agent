import { describe, expect, it } from 'vitest';
import { isRetryable, withRetry } from './retry';

describe('isRetryable', () => {
  it('retries 5xx and 429', () => {
    expect(isRetryable({ code: 503 })).toBe(true);
    expect(isRetryable({ response: { status: 429 } })).toBe(true);
  });

  it('retries 403 only for rate-limit reasons', () => {
    expect(isRetryable({ code: 403, errors: [{ reason: 'rateLimitExceeded' }] })).toBe(true);
    expect(isRetryable({ code: 403, errors: [{ reason: 'insufficientPermissions' }] })).toBe(false);
  });

  it('does not retry 404', () => {
    expect(isRetryable({ code: 404 })).toBe(false);
  });
});

describe('withRetry', () => {
  it('retries a retryable error then succeeds', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 2) throw { code: 500 };
        return 'ok';
      },
      { baseDelayMs: 1 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('does not retry a non-retryable error', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw { code: 404 };
      }),
    ).rejects.toMatchObject({ code: 404 });
    expect(calls).toBe(1);
  });
});
