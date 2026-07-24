export const FOLDER = 'application/vnd.google-apps.folder';
export const SHORTCUT = 'application/vnd.google-apps.shortcut';
export const GOOGLE_DOC = 'application/vnd.google-apps.document';
export const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet';
export const GOOGLE_SLIDES = 'application/vnd.google-apps.presentation';
export const PDF = 'application/pdf';

// Plain-text families read as-is via files.get?alt=media.
const TEXT_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/xml',
  'text/xml',
]);

export function isPlainText(mimeType: string): boolean {
  return TEXT_TYPES.has(mimeType) || mimeType.startsWith('text/');
}
