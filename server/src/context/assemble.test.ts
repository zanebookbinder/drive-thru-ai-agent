import { describe, expect, it } from 'vitest';
import { assemble, selectDocuments } from './assemble';
import { CorpusDocument } from '../types';

function doc(tokenEstimate: number): CorpusDocument {
  return {
    fileId: 'f',
    name: 'D',
    mimeType: 'text/plain',
    webViewLink: '',
    path: '',
    text: '',
    tokenEstimate,
    anchors: [],
  };
}

describe('assemble', () => {
  it('loads every document as tier 1 when under budget', () => {
    const result = assemble([doc(100), doc(200)], [], 1000);
    expect(result.tier).toBe(1);
    expect(result.documents).toHaveLength(2);
  });

  it('returns tier 2 with no eager documents when over budget', () => {
    const result = assemble([doc(600), doc(600)], [], 1000);
    expect(result.tier).toBe(2);
    expect(result.documents).toHaveLength(0);
  });

  it('treats an exactly-at-budget corpus as tier 1', () => {
    expect(assemble([doc(1000)], [], 1000).tier).toBe(1);
  });
});

describe('selectDocuments', () => {
  it('includes everything when the corpus fits', () => {
    const { included, omitted } = selectDocuments([doc(100), doc(200)], 1000);
    expect(included).toHaveLength(2);
    expect(omitted).toBe(0);
  });

  it('stops adding once the budget is reached and reports the omitted count', () => {
    const { included, omitted } = selectDocuments([doc(600), doc(600), doc(600)], 1000);
    expect(included).toHaveLength(1);
    expect(omitted).toBe(2);
  });

  it('skips an oversized document but still includes smaller ones after it', () => {
    const { included, omitted } = selectDocuments([doc(5000), doc(100)], 1000);
    expect(included.map((d) => d.tokenEstimate)).toEqual([100]);
    expect(omitted).toBe(1);
  });
});
