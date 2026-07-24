// Rough estimate — 4 characters ≈ 1 token. Used only for budget decisions.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
