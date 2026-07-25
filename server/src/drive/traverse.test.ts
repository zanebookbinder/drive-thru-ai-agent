import { describe, expect, it } from 'vitest';
import { traverse } from './traverse';
import { FOLDER, SHORTCUT } from './mime';

// Minimal fake of drive.files.list backed by a folder→children map, with
// pagination via a numeric-offset nextPageToken.
function fakeDrive(tree: Record<string, unknown[]>, pageSize = 1000) {
  return {
    files: {
      list: async ({ q, pageToken }: { q: string; pageToken?: string }) => {
        const parent = /'([^']+)' in parents/.exec(q)![1];
        const all = tree[parent] ?? [];
        const start = pageToken ? Number(pageToken) : 0;
        const files = all.slice(start, start + pageSize);
        const next = start + pageSize < all.length ? String(start + pageSize) : undefined;
        return { data: { files, nextPageToken: next } };
      },
    },
  } as never;
}

const file = (id: string, name: string) => ({ id, name, mimeType: 'text/plain', size: '10' });
const folder = (id: string, name: string) => ({ id, name, mimeType: FOLDER });
const shortcut = (id: string, targetId: string) => ({
  id,
  name: 'sc',
  mimeType: SHORTCUT,
  shortcutDetails: { targetId },
});

describe('traverse', () => {
  it('collects files across a nested folder tree, recording paths', async () => {
    const drive = fakeDrive({
      root: [file('f1', 'a.txt'), folder('sub', 'Sub')],
      sub: [file('f2', 'b.txt')],
    });
    const out = await traverse(drive, 'root');
    expect(out.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
    expect(out.find((f) => f.id === 'f1')!.path).toBe('');
    expect(out.find((f) => f.id === 'f2')!.path).toBe('/Sub');
  });

  it('follows nextPageToken through every page', async () => {
    const many = Array.from({ length: 25 }, (_, i) => file(`f${i}`, `${i}.txt`));
    const drive = fakeDrive({ root: many }, 10); // 10/page → 3 pages
    const out = await traverse(drive, 'root');
    expect(out).toHaveLength(25);
  });

  it('resolves a shortcut to its target file', async () => {
    const drive = fakeDrive({
      root: [shortcut('sc1', 'target')],
      target: [file('t1', 't.txt')],
    });
    const out = await traverse(drive, 'root');
    expect(out.map((f) => f.id)).toEqual(['t1']);
  });

  it('is cycle-safe when folders reference each other', async () => {
    const drive = fakeDrive({
      root: [folder('a', 'A')],
      a: [folder('b', 'B'), file('fa', 'fa.txt')],
      b: [folder('a', 'A'), file('fb', 'fb.txt')], // b → a is a cycle
    });
    const out = await traverse(drive, 'root');
    expect(out.map((f) => f.id).sort()).toEqual(['fa', 'fb']);
  });
});
