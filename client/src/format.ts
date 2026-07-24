const UNITS = ['B', 'KB', 'MB', 'GB'];

// Human-readable byte size, e.g. 8_200_000 → "7.8 MB".
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${UNITS[unit]}`;
}
