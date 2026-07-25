import { useEffect } from 'react';
import { Conversation } from '../types';
import { formatBytes } from '../format';
import { FileTypeIcon, ICON_ONLY } from './FileTypeIcon';

interface Props {
  conversation: Conversation;
  // null clears the scope (all loaded files); [] = none; [ids] = exactly those.
  onSelectFiles: (fileIds: string[] | null) => void;
  onLoadFile: (fileId: string) => void;
  loadingFiles: Set<string>;
  onLoadAll: () => void;
  loadingAll: boolean;
  onClose: () => void;
}

// Center-screen dialog for choosing which files the chat is scoped to. Changes
// apply live (so closing by any means — Save, ✕, or clicking the backdrop —
// persists them). Checking an unloaded file loads it on demand and includes it.
export function FileSelectModal({
  conversation,
  onSelectFiles,
  onLoadFile,
  loadingFiles,
  onLoadAll,
  loadingAll,
  onClose,
}: Props) {
  const { files } = conversation;
  const loadedIds = files.filter((f) => f.loaded).map((f) => f.fileId);

  // Resolve the tri-state selection into an explicit set of "in chat" ids.
  const includeAll = conversation.selectedFileIds === undefined;
  const selected = new Set(includeAll ? loadedIds : conversation.selectedFileIds);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Persist a raw id set: collapse "every loaded file" back to the all-files
  // default (null) so future loads stay included; keep an empty set as "none".
  const persist = (next: Set<string>) => {
    if (next.size === 0) return onSelectFiles([]);
    const isAllLoaded =
      loadedIds.length > 0 && next.size === loadedIds.length && loadedIds.every((id) => next.has(id));
    onSelectFiles(isAllLoaded ? null : [...next]);
  };

  const toggle = (fileId: string, loaded: boolean) => {
    const next = new Set(selected);
    if (next.has(fileId)) {
      next.delete(fileId);
    } else {
      next.add(fileId);
      if (!loaded) onLoadFile(fileId); // load on demand, then it's in the chat
    }
    persist(next);
  };

  const selectAll = () => {
    if (loadedIds.length < files.length) onLoadAll();
    onSelectFiles(null);
  };
  const selectNone = () => onSelectFiles([]);

  const selectedCount = files.filter((f) => selected.has(f.fileId)).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Select files to chat with"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Select files to chat with</h2>
          <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-note muted small">
          <p>
            By default Claude reads <strong>all loaded files</strong> in this folder. Large files
            (over 20&nbsp;KB) and anything past the first 100 aren't loaded automatically — check one
            here to load it and add it to the chat.
          </p>
          <p>
            Narrowing to a few files focuses Claude's answers on just those documents and keeps token
            usage (and cost) down. When a subset is selected, answers note that other files weren't
            consulted.
          </p>
        </div>

        <div className="modal-toolbar">
          <span className="muted small">
            {selectedCount} of {files.length} selected
          </span>
          <span className="row">
            <button className="link-button small" onClick={selectAll} disabled={loadingAll}>
              {loadingAll ? 'Loading…' : 'Select all'}
            </button>
            <button className="link-button small" onClick={selectNone}>
              Select none
            </button>
          </span>
        </div>

        <ul className="modal-file-list">
          {files.map((file) => {
            const folder = (file.path ?? '').replace(/^\//, '');
            const fullPath = folder ? `${folder}/${file.name}` : file.name;
            const isLoading = loadingFiles.has(file.fileId);
            const checked = selected.has(file.fileId);
            return (
              <li key={file.fileId}>
                <label className="modal-file">
                  <input
                    type="checkbox"
                    className="file-check"
                    checked={checked}
                    disabled={isLoading}
                    onChange={() => toggle(file.fileId, file.loaded)}
                  />
                  <span className="file-info">
                    <span className="file-name" title={fullPath}>
                      {file.name}
                    </span>
                    {folder && <span className="file-folder">{folder}</span>}
                  </span>
                  <span className="file-meta">
                    {isLoading ? (
                      <span className="muted small">Loading…</span>
                    ) : (
                      !file.loaded && <span className="not-loaded-tag">Not loaded</span>
                    )}
                    {file.sizeBytes > 0 && (
                      <span className="file-size">
                        {file.estimated ? '~' : ''}
                        {formatBytes(file.sizeBytes)}
                      </span>
                    )}
                    <span className="file-type" title={file.type}>
                      <FileTypeIcon type={file.type} />
                      {!ICON_ONLY.has(file.type) && file.type}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="modal-foot">
          <button className="button" onClick={onClose}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
