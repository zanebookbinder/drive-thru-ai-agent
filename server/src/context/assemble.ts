import { CorpusDocument, FileMeta } from '../types';

export interface AssembleResult {
  tier: 1 | 2;
  documents: CorpusDocument[];
}

// Tier 1: whole corpus fits the budget, load everything.
// Tier 2: over budget — the full text won't fit, so the prompt carries a manifest
// of every file plus as many document bodies as fit (see selectDocuments).
export function assemble(
  documents: CorpusDocument[],
  _manifest: FileMeta[],
  maxTokens: number,
): AssembleResult {
  const total = documents.reduce((sum, doc) => sum + doc.tokenEstimate, 0);
  if (total <= maxTokens) return { tier: 1, documents };
  return { tier: 2, documents: [] };
}

export interface Selection {
  included: CorpusDocument[];
  omitted: number;
}

// Greedily include document bodies up to the token budget. Documents too large to
// fit are skipped rather than blocking smaller ones; every file still appears in
// the manifest, so aggregate questions work regardless of what text is loaded.
export function selectDocuments(documents: CorpusDocument[], maxTokens: number): Selection {
  const included: CorpusDocument[] = [];
  let total = 0;
  for (const doc of documents) {
    if (total + doc.tokenEstimate > maxTokens) continue;
    included.push(doc);
    total += doc.tokenEstimate;
  }
  return { included, omitted: documents.length - included.length };
}
