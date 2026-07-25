import { describe, expect, it } from 'vitest';
import { buildMessages, omissionNote, scopedNote } from './anthropic';
import { CorpusDocument, FileMeta } from '../types';

function doc(fileId: string, text = 'body'): CorpusDocument {
  return {
    fileId,
    name: fileId,
    mimeType: 'text/plain',
    webViewLink: '',
    path: '',
    text,
    tokenEstimate: 1,
    anchors: [],
  };
}

const meta = (id: string): FileMeta => ({ id, name: id, mimeType: 'text/plain', path: '' });

describe('scopedNote', () => {
  it('tells the model to answer only from the shown files, with no "other files" clause when none excluded', () => {
    const n = scopedNote(2, 0);
    expect(n).toContain('narrowed to the 2 file');
    expect(n).toContain('Answer only from them');
    expect(n).not.toMatch(/other file/i);
  });

  it('mentions the excluded files and that the answer may live elsewhere', () => {
    const n = scopedNote(1, 3);
    expect(n).toContain('3 other file');
    expect(n.toLowerCase()).toContain('not included');
    expect(n).toContain('all files'); // suggests switching back to all files
  });
});

describe('omissionNote', () => {
  it('is empty when nothing was omitted', () => {
    expect(omissionNote(5, 0)).toBe('');
  });

  it('reports how many of the total have their text loaded', () => {
    expect(omissionNote(3, 2)).toContain('3 of 5');
  });
});

describe('buildMessages', () => {
  it('leads with manifest + cached document blocks, then history, then the question', () => {
    const msgs = buildMessages(
      [doc('a')],
      [meta('a')],
      0,
      false,
      0,
      [{ role: 'user', content: 'earlier turn' }],
      'the question',
    );

    expect(msgs[0].role).toBe('user');
    const blocks = msgs[0].content as Array<{ text: string; cache_control?: unknown }>;
    expect(blocks[0].text).toContain('FILE MANIFEST');
    expect(blocks[1].text).toContain('<document');
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' });

    expect(msgs.some((m) => m.content === 'earlier turn')).toBe(true);
    expect(msgs.at(-1)).toEqual({ role: 'user', content: 'the question' });
  });

  it('appends the scoped note to the document block when the chat is scoped', () => {
    const msgs = buildMessages([doc('a')], [meta('a')], 0, true, 2, [], 'q');
    const blocks = msgs[0].content as Array<{ text: string }>;
    expect(blocks[1].text).toContain('2 other file');
  });
});
