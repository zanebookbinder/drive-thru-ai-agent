import { Corpus, StoredFile } from '../types';
import { FOLDER, GOOGLE_DOC, GOOGLE_SHEET, GOOGLE_SLIDES, PDF, SHORTCUT } from './mime';

const LABELS: Record<string, string> = {
  [GOOGLE_DOC]: 'Google Doc',
  [GOOGLE_SHEET]: 'Google Sheet',
  [GOOGLE_SLIDES]: 'Google Slides',
  [PDF]: 'PDF',
  [FOLDER]: 'Folder',
  [SHORTCUT]: 'Shortcut',
  'text/plain': 'Text',
  'text/markdown': 'Markdown',
  'text/csv': 'CSV',
  'application/json': 'JSON',
  'application/xml': 'XML',
  'text/xml': 'XML',
};

// Short, human-readable label for a MIME type shown in the ingest summary.
export function friendlyType(mimeType: string): string {
  if (LABELS[mimeType]) return LABELS[mimeType];
  if (mimeType.startsWith('text/')) return 'Text';
  const subtype = mimeType.split('/')[1] ?? mimeType;
  return subtype.toUpperCase();
}

// Corpus → sidebar file metadata (with links). Loaded documents come first, then
// files left unloaded (which the user can load on demand). Native Google files
// report no byte size, so a loaded one estimates from its exported text length.
export function describeFiles(corpus: Corpus): StoredFile[] {
  const sizeById = new Map(corpus.manifest.map((f) => [f.id, f.size]));

  const loaded: StoredFile[] = corpus.documents.map((d) => {
    const bytes = sizeById.get(d.fileId);
    return {
      fileId: d.fileId,
      name: d.name,
      path: d.path,
      link: d.webViewLink,
      type: friendlyType(d.mimeType),
      sizeBytes: bytes ? Number(bytes) : d.text.length,
      estimated: !bytes,
      loaded: true,
    };
  });

  const unloaded: StoredFile[] = corpus.unloaded.map((f) => ({
    fileId: f.id,
    name: f.name,
    path: f.path,
    link: f.webViewLink ?? '',
    type: friendlyType(f.mimeType),
    sizeBytes: f.size ? Number(f.size) : 0,
    estimated: false,
    loaded: false,
  }));

  return [...loaded, ...unloaded];
}
