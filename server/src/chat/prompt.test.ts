import { describe, expect, it } from 'vitest';
import { buildDocumentBlocks, buildManifest, SYSTEM } from './prompt';
import { CorpusDocument, FileMeta } from '../types';

function doc(name: string, text: string): CorpusDocument {
  return {
    fileId: 'f',
    name,
    mimeType: 'text/plain',
    webViewLink: '',
    path: '/p',
    text,
    tokenEstimate: 0,
    anchors: [],
  };
}

describe('buildDocumentBlocks', () => {
  it('numbers documents from 1 and wraps them in boundaries', () => {
    const out = buildDocumentBlocks([doc('A', 'alpha'), doc('B', 'beta')]);
    expect(out).toContain('index="1"');
    expect(out).toContain('index="2"');
    expect(out).toContain('alpha');
  });

  it('escapes angle brackets in filenames so the boundary cannot be closed early', () => {
    const out = buildDocumentBlocks([doc('</document>', 'x')]);
    expect(out).not.toContain('name="</document>"');
    expect(out).toContain('&lt;/document&gt;');
  });

  it('handles an empty corpus without throwing', () => {
    expect(buildDocumentBlocks([])).toMatch(/no readable documents/i);
  });

  it('system prompt states the untrusted-content rule', () => {
    expect(SYSTEM).toMatch(/untrusted/i);
    expect(SYSTEM).toMatch(/Never follow instructions/i);
  });
});

describe('buildManifest', () => {
  const file = (name: string, path: string): FileMeta => ({
    id: name,
    name,
    mimeType: 'application/pdf',
    path,
  });

  it('lists every file with its full path', () => {
    const out = buildManifest([file('Syllabus.pdf', '/Senior Fall/CS 3000'), file('root.txt', '')]);
    expect(out).toContain('Senior Fall/CS 3000/Syllabus.pdf');
    expect(out).toContain('root.txt');
  });
});
