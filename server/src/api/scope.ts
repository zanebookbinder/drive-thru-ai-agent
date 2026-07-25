import { Corpus, CorpusDocument, FileMeta } from '../types';

// The chat scope is tri-state:
//   undefined selection → all loaded files (the default)
//   []                  → no files
//   [ids]               → exactly those files
// Returns a Set for membership tests, or null meaning "no scope / everything".
export function resolveSelection(selectedFileIds: string[] | undefined): Set<string> | null {
  return selectedFileIds ? new Set(selectedFileIds) : null;
}

export interface ScopedCorpus {
  documents: CorpusDocument[];
  manifest: FileMeta[];
  // Folder files excluded by the narrowing (for the honest "there may be more" note).
  excluded: number;
}

// Narrow a corpus to the selected files. A null selection means "everything".
export function scopeCorpus(selected: Set<string> | null, corpus: Corpus): ScopedCorpus {
  if (!selected) {
    return { documents: corpus.documents, manifest: corpus.manifest, excluded: 0 };
  }
  const documents = corpus.documents.filter((d) => selected.has(d.fileId));
  const manifest = corpus.manifest.filter((f) => selected.has(f.id));
  return { documents, manifest, excluded: corpus.manifest.length - manifest.length };
}

// Which selected files still need loading (gated out at ingest, or dropped after a
// re-ingest) — so the chat handler can force-load them before answering and never
// silently send Claude zero documents for a file the user explicitly selected.
export function selectedNeedingLoad(
  selectedFileIds: string[] | undefined,
  loadedIds: Iterable<string>,
): string[] {
  if (!selectedFileIds || selectedFileIds.length === 0) return [];
  const loaded = new Set(loadedIds);
  return selectedFileIds.filter((id) => !loaded.has(id));
}
