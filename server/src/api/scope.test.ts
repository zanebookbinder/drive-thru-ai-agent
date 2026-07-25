import { describe, expect, it } from 'vitest';
import { resolveSelection, scopeCorpus, selectedNeedingLoad } from './scope';
import { Corpus, CorpusDocument, FileMeta } from '../types';

function doc(fileId: string): CorpusDocument {
  return {
    fileId,
    name: fileId,
    mimeType: 'text/plain',
    webViewLink: '',
    path: '',
    text: 'body',
    tokenEstimate: 1,
    anchors: [],
  };
}

const meta = (id: string): FileMeta => ({ id, name: id, mimeType: 'text/plain', path: '' });

// loaded = ids with document bodies; manifestIds = every file in the folder.
function corpus(loaded: string[], manifestIds: string[]): Corpus {
  return {
    id: 'c',
    title: 't',
    sourceUrl: '',
    rootId: 'r',
    tier: 1,
    documents: loaded.map(doc),
    manifest: manifestIds.map(meta),
    unloaded: [],
    tokensLoaded: 0,
    skipped: [],
  };
}

describe('resolveSelection (tri-state)', () => {
  it('treats an absent selection as "all files" (null scope)', () => {
    expect(resolveSelection(undefined)).toBeNull();
  });

  it('treats an empty array as "no files" — an empty set, not null', () => {
    const s = resolveSelection([]);
    expect(s).not.toBeNull();
    expect(s!.size).toBe(0);
  });

  it('scopes to exactly the given ids', () => {
    expect([...resolveSelection(['a', 'b'])!]).toEqual(['a', 'b']);
  });
});

describe('scopeCorpus', () => {
  // d exists in the manifest but has no loaded document (it was gated out).
  const c = corpus(['a', 'b', 'c'], ['a', 'b', 'c', 'd']);

  it('returns the whole corpus with nothing excluded for a null selection', () => {
    const r = scopeCorpus(null, c);
    expect(r.documents).toHaveLength(3);
    expect(r.manifest).toHaveLength(4);
    expect(r.excluded).toBe(0);
  });

  it('yields zero documents/manifest and counts all excluded for an empty selection', () => {
    const r = scopeCorpus(new Set(), c);
    expect(r.documents).toHaveLength(0);
    expect(r.manifest).toHaveLength(0);
    expect(r.excluded).toBe(4);
  });

  it('keeps only the selected loaded docs and manifest entries', () => {
    const r = scopeCorpus(new Set(['a']), c);
    expect(r.documents.map((d) => d.fileId)).toEqual(['a']);
    expect(r.manifest.map((m) => m.id)).toEqual(['a']);
    expect(r.excluded).toBe(3); // b, c, d
  });

  it('scopes the manifest for a selected-but-unloaded file (force-load fills the doc)', () => {
    const r = scopeCorpus(new Set(['d']), c);
    expect(r.documents).toHaveLength(0);
    expect(r.manifest.map((m) => m.id)).toEqual(['d']);
  });
});

describe('selectedNeedingLoad (regression: scoping never sends zero documents)', () => {
  it('needs nothing for an empty or absent selection', () => {
    expect(selectedNeedingLoad(undefined, ['a'])).toEqual([]);
    expect(selectedNeedingLoad([], ['a'])).toEqual([]);
  });

  it('returns selected ids that are not yet loaded', () => {
    expect(selectedNeedingLoad(['a', 'd'], ['a', 'b', 'c'])).toEqual(['d']);
  });

  it('needs nothing when every selected file is already loaded', () => {
    expect(selectedNeedingLoad(['a', 'b'], ['a', 'b', 'c'])).toEqual([]);
  });
});
