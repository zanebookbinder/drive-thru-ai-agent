interface GoogleApiError {
  code?: number;
  response?: { status?: number };
  errors?: Array<{ reason?: string }>;
}

export function isRetryable(err: unknown): boolean {
  const e = err as GoogleApiError;
  const status = e?.code ?? e?.response?.status;
  if (typeof status !== 'number') return false;
  if (status >= 500) return true;
  if (status === 429) return true;
  if (status === 403) {
    const reason = e?.errors?.[0]?.reason ?? '';
    return reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded';
  }
  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelayMs = 500 } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === retries) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
      await sleep(delay);
    }
  }
  throw lastError;
}
