import { CorpusDocument } from '../types';
import { GOOGLE_SLIDES, PDF } from '../drive/mime';

// Builds a Drive deep link for a document, using anchors to land on a page when
// the model reports one. Falls back to the plain webViewLink.
export function deepLink(doc: CorpusDocument, page?: number): string {
  const base = doc.webViewLink;
  if (!base) return '';
  if (page && doc.mimeType === PDF) return `${base}#page=${page}`;
  if (page && doc.mimeType === GOOGLE_SLIDES) return `${base}#slide=${page}`;
  return base;
}
