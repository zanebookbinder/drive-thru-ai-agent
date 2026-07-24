import { describe, expect, it } from 'vitest';
import { CostTracker, SPEND_LIMIT_USD, usdForAnthropicUsage } from './cost';

describe('usdForAnthropicUsage', () => {
  it('prices uncached input and output at Sonnet-5 rates', () => {
    // 1M input + 1M output = $3 + $15.
    const usd = usdForAnthropicUsage({ input_tokens: 1_000_000, output_tokens: 1_000_000 } as never);
    expect(usd).toBeCloseTo(18, 5);
  });

  it('discounts cache reads and surcharges cache writes', () => {
    const usd = usdForAnthropicUsage({
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000, // 0.1x → 0.1M effective → $0.30
      cache_creation_input_tokens: 1_000_000, // 1.25x → 1.25M effective → $3.75
    } as never);
    expect(usd).toBeCloseTo(0.3 + 3.75, 5);
  });
});

describe('CostTracker', () => {
  it('accumulates per key and trips at the limit', () => {
    const t = new CostTracker();
    t.add('a@b.com', SPEND_LIMIT_USD - 0.01);
    expect(t.isOverLimit('a@b.com')).toBe(false);
    t.add('a@b.com', 0.02);
    expect(t.isOverLimit('a@b.com')).toBe(true);
    // Independent per user.
    expect(t.isOverLimit('c@d.com')).toBe(false);
  });
});
