import { FormEvent, useState } from 'react';
import { parseDriveLink } from '../parseLink';

interface Props {
  onSubmit: (link: string) => void;
  disabled: boolean;
  error?: string;
}

export function LinkInput({ onSubmit, disabled, error }: Props) {
  const [link, setLink] = useState('');
  const valid = parseDriveLink(link) !== null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid && !disabled) onSubmit(link.trim());
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>Paste a Google Drive link</h2>
      <p className="muted">A folder, or a single Doc, PDF, or text file.</p>
      <input
        type="text"
        placeholder="https://drive.google.com/drive/folders/…"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        disabled={disabled}
      />
      {link.length > 0 && !valid && <p className="error">That does not look like a Drive link.</p>}
      {error && <p className="error">{error}</p>}
      <button className="button" type="submit" disabled={!valid || disabled}>
        {disabled ? 'Reading…' : 'Read folder'}
      </button>
    </form>
  );
}
