import { describe, expect, it } from 'vitest';
import { extractCitations } from './citations';
import { CorpusDocument } from '../types';
import { PDF } from '../drive/mime';

function doc(overrides: Partial<CorpusDocument>): CorpusDocument {
  return {
    fileId: 'f',
    name: 'Doc',
    mimeType: PDF,
    webViewLink: 'https://drive.google.com/file/d/f/view',
    path: '/folder',
    text: '',
    tokenEstimate: 0,
    anchors: [],
    ...overrides,
  };
}

describe('extractCitations', () => {
  const docs = [
    doc({ fileId: 'a', name: 'Alpha', webViewLink: 'https://drive.google.com/file/d/a/view' }),
    doc({ fileId: 'b', name: 'Beta', webViewLink: 'https://drive.google.com/file/d/b/view' }),
  ];

  it('resolves a plain marker to a deep link', () => {
    const [c] = extractCitations('The target is 42 [1].', docs);
    expect(c.name).toBe('Alpha');
    expect(c.link).toBe('https://drive.google.com/file/d/a/view');
  });

  it('resolves a page marker to a #page deep link', () => {
    const [c] = extractCitations('See [2:p7].', docs);
    expect(c.page).toBe(7);
    expect(c.link).toBe('https://drive.google.com/file/d/b/view#page=7');
  });

  it('dedupes repeated markers', () => {
    expect(extractCitations('[1] and again [1].', docs)).toHaveLength(1);
  });

  it('drops markers pointing outside the corpus', () => {
    expect(extractCitations('Bogus [9].', docs)).toHaveLength(0);
  });
});
