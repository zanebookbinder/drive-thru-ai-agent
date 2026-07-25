import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileSelectModal } from './FileSelectModal';
import { Conversation, StoredFile } from '../types';

function file(fileId: string, loaded = true): StoredFile {
  return { fileId, name: fileId, path: '', link: '', type: 'Text', sizeBytes: 100, estimated: false, loaded };
}

function conversation(selectedFileIds: string[] | undefined, files: StoredFile[]): Conversation {
  return {
    id: 'c',
    title: 't',
    sourceUrl: '',
    rootId: 'r',
    tier: 1,
    createdAt: 0,
    files,
    skipped: [],
    messages: [],
    selectedFileIds,
  };
}

const noop = () => {};

function setup(selectedFileIds: string[] | undefined, files: StoredFile[]) {
  const onSelectFiles = vi.fn();
  const onLoadFile = vi.fn();
  render(
    <FileSelectModal
      conversation={conversation(selectedFileIds, files)}
      onSelectFiles={onSelectFiles}
      onLoadFile={onLoadFile}
      loadingFiles={new Set()}
      onLoadAll={noop}
      loadingAll={false}
      onClose={noop}
    />,
  );
  return { onSelectFiles, onLoadFile };
}

describe('FileSelectModal tri-state selection', () => {
  const files = [file('a'), file('b'), file('c')];

  it('checks all loaded files by default (absent selection = all)', () => {
    setup(undefined, files);
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes).toHaveLength(3);
    expect(boxes.every((b) => b.checked)).toBe(true);
  });

  it('unchecking one loaded file persists the remaining subset', () => {
    const { onSelectFiles } = setup(undefined, files);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // uncheck 'a'
    expect(onSelectFiles).toHaveBeenCalledWith(['b', 'c']);
  });

  it('"Select none" clears to an empty array', () => {
    const { onSelectFiles } = setup(undefined, files);
    fireEvent.click(screen.getByText('Select none'));
    expect(onSelectFiles).toHaveBeenCalledWith([]);
  });

  it('"Select all" clears back to the all-files default (null)', () => {
    const { onSelectFiles } = setup(['a'], files);
    fireEvent.click(screen.getByText('Select all'));
    expect(onSelectFiles).toHaveBeenCalledWith(null);
  });

  it('checking a not-yet-loaded file loads it on demand', () => {
    const { onLoadFile } = setup([], [file('a'), file('big', false)]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]); // 'big', unloaded
    expect(onLoadFile).toHaveBeenCalledWith('big');
  });
});
