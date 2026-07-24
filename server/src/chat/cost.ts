import Anthropic from '@anthropic-ai/sdk';

// Approximate per-user spend cap. In-memory, so it resets on restart/redeploy —
// a lightweight guardrail, not billing-grade accounting.
export const SPEND_LIMIT_USD = 5;

// Sonnet-5 standard rates ($/million tokens). Using the higher standard (not the
// intro) rates makes the cap conservative — it trips a little early, never late.
const INPUT_PER_MTOK = 3;
const OUTPUT_PER_MTOK = 15;

export function usdForAnthropicUsage(usage: Anthropic.Usage): number {
  // Count uncached input, cache writes (~1.25x), cache reads (~0.1x), and output.
  const input = usage.input_tokens ?? 0;
  const cacheWrite = (usage.cache_creation_input_tokens ?? 0) * 1.25;
  const cacheRead = (usage.cache_read_input_tokens ?? 0) * 0.1;
  const output = usage.output_tokens ?? 0;
  return ((input + cacheWrite + cacheRead) / 1e6) * INPUT_PER_MTOK + (output / 1e6) * OUTPUT_PER_MTOK;
}

// Tracks cumulative estimated spend per user (keyed by email). In-memory only.
export class CostTracker {
  private spend = new Map<string, number>();

  add(key: string, usd: number): void {
    this.spend.set(key, (this.spend.get(key) ?? 0) + usd);
  }

  get(key: string): number {
    return this.spend.get(key) ?? 0;
  }

  isOverLimit(key: string): boolean {
    return this.get(key) >= SPEND_LIMIT_USD;
  }
}
