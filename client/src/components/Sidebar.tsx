import { FormEvent, useState } from 'react';
import { Conversation } from '../types';

interface Props {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
}

// Lists previously loaded folders (persisted server-side). Pinned folders sort to
// the top; each entry can be renamed inline, pinned, or deleted, and the list is
// searchable by title.
export function Sidebar({ conversations, activeId, onSelect, onNew, onRename, onDelete, onPin }: Props) {
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = conversations
    .filter((c) => !q || c.title.toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false));

  const startEdit = (c: Conversation) => {
    setEditingId(c.id);
    setDraft(c.title);
  };

  const commitEdit = (e: FormEvent) => {
    e.preventDefault();
    if (editingId && draft.trim()) onRename(editingId, draft.trim());
    setEditingId(undefined);
  };

  const confirmDelete = (c: Conversation) => {
    if (window.confirm(`Delete "${c.title}" and its conversation?`)) onDelete(c.id);
  };

  return (
    <aside className="sidebar">
      <button className="button full" onClick={onNew}>
        + New folder
      </button>
      {conversations.length > 6 && (
        <input
          className="conv-search"
          type="text"
          placeholder="Search folders…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <nav className="conv-list">
        {conversations.length === 0 && <p className="muted small">No folders yet.</p>}
        {shown.map((c) =>
          editingId === c.id ? (
            <form key={c.id} className="conv-edit" onSubmit={commitEdit}>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
              />
            </form>
          ) : (
            <div key={c.id} className={`conv-item${c.id === activeId ? ' active' : ''}`}>
              <button className="conv-select" onClick={() => onSelect(c.id)} title={c.title}>
                <span className="conv-title">
                  {c.pinned && <span className="pin-dot">★ </span>}
                  {c.title}
                </span>
                <span className="conv-sub muted small">
                  {c.files.length} file{c.files.length === 1 ? '' : 's'}
                  {c.messages.length > 0 &&
                    ` · ${Math.ceil(c.messages.length / 2)} question${
                      Math.ceil(c.messages.length / 2) === 1 ? '' : 's'
                    }`}
                </span>
              </button>
              <span className="conv-actions">
                <button
                  className={`icon-btn${c.pinned ? ' on' : ''}`}
                  title={c.pinned ? 'Unpin' : 'Pin'}
                  onClick={() => onPin(c.id, !c.pinned)}
                >
                  ★
                </button>
                <button className="icon-btn" title="Rename" onClick={() => startEdit(c)}>
                  ✎
                </button>
                <button className="icon-btn" title="Delete" onClick={() => confirmDelete(c)}>
                  ✕
                </button>
              </span>
            </div>
          ),
        )}
      </nav>
    </aside>
  );
}
