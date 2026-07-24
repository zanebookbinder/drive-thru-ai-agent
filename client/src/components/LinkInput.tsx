import { FormEvent, useState } from 'react';
import { parseDriveLink } from '../parseLink';
import { GATE_NOTE } from '../limits';

interface Props {
  onSubmit: (link: string, summarize: boolean) => void;
  disabled: boolean;
  error?: string;
}

const SUMMARIZE_KEY = 'drive-chat-summarize';

export function LinkInput({ onSubmit, disabled, error }: Props) {
  const [link, setLink] = useState('');
  const [pasted, setPasted] = useState(false);
  const [summarize, setSummarize] = useState(
    () => localStorage.getItem(SUMMARIZE_KEY) !== 'off',
  );
  const valid = parseDriveLink(link) !== null;

  const toggleSummarize = (next: boolean) => {
    setSummarize(next);
    localStorage.setItem(SUMMARIZE_KEY, next ? 'on' : 'off');
  };

  // If the clipboard holds a Drive link and the box is empty, drop it in.
  const autoPaste = async () => {
    if (link.trim()) return;
    try {
      const text = await navigator.clipboard.readText();
      if (parseDriveLink(text)) {
        setLink(text.trim());
        setPasted(true);
        setTimeout(() => setPasted(false), 3000);
      }
    } catch {
      // Clipboard blocked or denied — ignore.
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid && !disabled) onSubmit(link.trim(), summarize);
  };

  return (
    <form className="card" onSubmit={submit}>
      {pasted && <span className="paste-alert">Auto-pasted from clipboard!</span>}
      <h2>Paste a Google Drive link</h2>
      <p className="muted">Link a folder or a specific file located in Drive.</p>
      <input
        type="text"
        placeholder="https://drive.google.com/drive/folders/…"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        onFocus={autoPaste}
        disabled={disabled}
      />
      {link.length > 0 && !valid && <p className="error">That does not look like a Drive link.</p>}

      <div className="settings">
        <label className="setting">
          <span className="toggle">
            <input
              type="checkbox"
              checked={summarize}
              onChange={(e) => toggleSummarize(e.target.checked)}
              disabled={disabled}
            />
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
          </span>
          <span>
            Generate a folder summary
            <span className="muted small"> — a short overview shown above the file list</span>
          </span>
        </label>
      </div>

      <p className="muted small gate-note gate-note-input">{GATE_NOTE}</p>

      {error && <p className="error">{error}</p>}
      <button className="button" type="submit" disabled={!valid || disabled}>
        {disabled ? 'Reading…' : 'Read folder'}
      </button>
    </form>
  );
}
