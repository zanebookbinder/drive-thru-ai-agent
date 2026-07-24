import { useState } from 'react';
import { Conversation, StoredFile } from '../types';
import { formatBytes } from '../format';
import { FileTypeIcon, ICON_ONLY } from './FileTypeIcon';

interface Props {
  conversation: Conversation;
  onReload: () => void;
  reloading: boolean;
  onLoadFile: (fileId: string) => void;
  loadingFiles: Set<string>;
  onLoadAll: () => void;
  loadingAll: boolean;
}

const PREVIEW_COUNT = 5;

// Per-type tally rendered with icons, e.g. "176 [doc]  87 [pdf] PDF".
function TypeTally({ files }: { files: StoredFile[] }) {
  const counts = new Map<string, number>();
  for (const f of files) counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
  return (
    <span className="type-tally">
      {[...counts.entries()].map(([type, n], i) => (
        <span className="type-chip" key={type} title={`${n} ${type}`}>
          {i > 0 && ', '}
          {n} <FileTypeIcon type={type} />
          {!ICON_ONLY.has(type) && <span className="type-word">{type}</span>}
        </span>
      ))}
    </span>
  );
}

// A download-into-tray glyph making the "load this file" action obvious.
function LoadIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function sumBytes(files: StoredFile[]): number {
  return files.reduce((sum, f) => sum + (f.sizeBytes > 0 ? f.sizeBytes : 0), 0);
}

// Shows the folder — a loaded tally and an unloaded tally up top, then a per-file
// list. Files loaded into the session show their size; unloaded files show a
// "Load into session" button. Sizes (when Drive reports them) sit left of the type.
export function IngestSummary({
  conversation,
  onReload,
  reloading,
  onLoadFile,
  loadingFiles,
  onLoadAll,
  loadingAll,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const { files, skipped } = conversation;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? files.filter((f) => `${f.path}/${f.name}`.toLowerCase().includes(q))
    : files;
  const visible = showAll || q ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hidden = filtered.length - PREVIEW_COUNT;

  const loaded = files.filter((f) => f.loaded);
  const unloaded = files.filter((f) => !f.loaded);
  const loadedEstimated = loaded.some((f) => f.estimated);
  const unloadedBytes = sumBytes(unloaded);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(conversation.sourceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context) — ignore.
    }
  };

  return (
    <div className="card">
      <div className="row space-between summary-head">
        <h2 className="ellipsis" title={conversation.title}>
          {conversation.title}
        </h2>
        <span className="row">
          <a className="link-button" href={conversation.sourceUrl} target="_blank" rel="noreferrer">
            Open in Drive
          </a>
          <button className="link-button" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button className="link-button" onClick={onReload} disabled={reloading}>
            {reloading ? 'Reloading…' : 'Reload folder'}
          </button>
        </span>
      </div>

      <p className="muted tally-line">
        {loaded.length} of {files.length} files loaded
        {loaded.length > 0 && (
          <>
            {' · '}
            {loadedEstimated ? '~' : ''}
            {formatBytes(sumBytes(loaded))}
          </>
        )}
        {files.length > 0 && (
          <>
            {' · '}
            <TypeTally files={files} />
          </>
        )}
      </p>

      {unloaded.length > 0 && (
        <p className="muted tally-line">
          {unloaded.length} not loaded
          {unloadedBytes > 0 && ` · ${formatBytes(unloadedBytes)}`}
          {' · '}
          <TypeTally files={unloaded} />
          {' · '}
          <button className="link-button" onClick={onLoadAll} disabled={loadingAll}>
            {loadingAll ? 'Loading all…' : 'Load all'}
          </button>
        </p>
      )}

      {files.length > 0 && (
        <div className="file-section">
          {files.length > 8 && (
            <input
              className="file-search"
              type="text"
              placeholder="Search files…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {q && filtered.length === 0 && <p className="muted small">No files match “{query}”.</p>}
          <ul className={`file-list${showAll || q ? ' scroll' : ''}`}>
            {visible.map((file) => {
              const folder = (file.path ?? '').replace(/^\//, '');
              const fullPath = folder ? `${folder}/${file.name}` : file.name;
              const isLoading = loadingFiles.has(file.fileId);
              return (
                <li key={file.fileId} className={file.loaded ? '' : 'unloaded'}>
                  <span className="file-info">
                    {file.link ? (
                      <a
                        className="file-name link"
                        href={file.link}
                        target="_blank"
                        rel="noreferrer"
                        title={fullPath}
                      >
                        {file.name}
                      </a>
                    ) : (
                      <span className="file-name" title={fullPath}>
                        {file.name}
                      </span>
                    )}
                    {folder && <span className="file-folder">{folder}</span>}
                  </span>
                  <span className="file-meta">
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
                    {!file.loaded && (
                      <button
                        className="load-btn"
                        onClick={() => onLoadFile(file.fileId)}
                        disabled={isLoading}
                        title="Load into session"
                      >
                        <LoadIcon />
                        {isLoading ? 'Loading…' : 'Load'}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {!q && hidden > 0 && (
            <button className="link-button" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show fewer' : `Show all ${filtered.length}`}
            </button>
          )}
        </div>
      )}

      {skipped.length > 0 && (
        <details className="skip-list">
          <summary>
            {skipped.length} file{skipped.length === 1 ? '' : 's'} could not be read
          </summary>
          <ul>
            {skipped.map((s) => (
              <li key={s.fileId}>
                <strong>{s.name}</strong> — {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
