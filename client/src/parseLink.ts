const PATTERNS = [
  /\/folders\/([a-zA-Z0-9_-]+)/,
  /\/file\/d\/([a-zA-Z0-9_-]+)/,
  /\/document\/d\/([a-zA-Z0-9_-]+)/,
  /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
  /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
  /[?&]id=([a-zA-Z0-9_-]+)/,
];

// Mirrors the server parser for instant client-side validation.
export function parseDriveLink(input: string): string | null {
  const url = input.trim();
  for (const pattern of PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return /^[a-zA-Z0-9_-]{20,}$/.test(url) ? url : null;
}
