import { describe, expect, it } from 'vitest';
import { conversationToMarkdown } from './export';
import { Conversation } from './types';

const conv: Conversation = {
  id: 'c1',
  title: 'My Folder',
  sourceUrl: 'https://drive.google.com/drive/folders/x',
  rootId: 'x',
  tier: 1,
  createdAt: 0,
  files: [],
  skipped: [],
  manuallyLoaded: [],
  messages: [
    { role: 'user', content: 'What is the target?' },
    {
      role: 'assistant',
      content: 'The target is 42 [1].',
      citations: [
        { marker: '[1]', index: 1, name: 'Report', path: '/f', link: 'https://drive/x/view' },
      ],
    },
  ],
} as Conversation;

describe('conversationToMarkdown', () => {
  it('turns citation markers into links and lists sources', () => {
    const md = conversationToMarkdown(conv);
    expect(md).toContain('# My Folder');
    expect(md).toContain('## What is the target?');
    expect(md).toContain('[[1]](https://drive/x/view)');
    expect(md).toContain('- [1] [Report](https://drive/x/view)');
  });
});
