import { useState } from 'react';
import { Conversation, StoredFile } from '../types';
import { formatBytes } from '../format';
import { FileTypeIcon, ICON_ONLY } from './FileTypeIcon';

interface Props {
  conversation: Conversation;
  onReload: () => void;
  reloading: boolean;
}

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

// The Google Drive triangle mark, shown next to the "Open" link.
function DriveLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 87.3 78" aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

function sumBytes(files: StoredFile[]): number {
  return files.reduce((sum, f) => sum + (f.sizeBytes > 0 ? f.sizeBytes : 0), 0);
}

// The folder overview: a loaded/unloaded tally up top, then a read-only per-file
// list with sizes and types. Choosing which files the chat reads happens in the
// "Select files to chat with" dialog, opened from the composer.
export function IngestSummary({ conversation, onReload, reloading }: Props) {
  const [query, setQuery] = useState('');
  const { files, skipped } = conversation;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? files.filter((f) => `${f.path}/${f.name}`.toLowerCase().includes(q))
    : files;

  const loaded = files.filter((f) => f.loaded);
  const loadedEstimated = loaded.some((f) => f.estimated);

  return (
    <div className="card">
      <div className="row space-between summary-head">
        <h2 className="ellipsis" title={conversation.title}>
          {conversation.title}
        </h2>
        <span className="row">
          <a className="open-drive" href={conversation.sourceUrl} target="_blank" rel="noreferrer">
            Open
            <DriveLogo />
          </a>
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

      {conversation.summary && (
        <div className="folder-summary">
          <span className="folder-summary-label muted small">Folder summary</span>
          <p>{conversation.summary}</p>
        </div>
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
          <ul className="file-list scroll">
            {filtered.map((file) => {
              const folder = (file.path ?? '').replace(/^\//, '');
              const fullPath = folder ? `${folder}/${file.name}` : file.name;
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
                    {!file.loaded && <span className="not-loaded-tag">Not loaded</span>}
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
                </li>
              );
            })}
          </ul>
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
