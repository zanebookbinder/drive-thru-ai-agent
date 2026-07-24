import { Citation, CorpusDocument } from '../types';
import { deepLink } from '../context/anchors';

const MARKER = /\[(\d+)(?::p(\d+))?\]/g;

// Extracts [n] / [n:p<page>] markers from the answer and resolves each to a
// Drive deep link. Markers pointing outside the corpus are dropped, not linked.
export function extractCitations(answer: string, documents: CorpusDocument[]): Citation[] {
  const byMarker = new Map<string, Citation>();
  for (const match of answer.matchAll(MARKER)) {
    const index = Number(match[1]);
    const page = match[2] ? Number(match[2]) : undefined;
    const doc = documents[index - 1];
    if (!doc) continue;
    const marker = match[0];
    if (byMarker.has(marker)) continue;
    byMarker.set(marker, {
      marker,
      index,
      page,
      name: doc.name,
      path: doc.path,
      link: deepLink(doc, page),
    });
  }
  return [...byMarker.values()];
}
