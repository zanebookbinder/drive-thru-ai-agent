import { FormEvent, useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { Citation, StoredMessage } from '../types';
import { Answer } from './Answer';

interface Props {
  messages: StoredMessage[];
  onAsk: (question: string) => void;
  onRetry: () => void;
  onExport: () => void;
  busy: boolean;
}

const STARTERS = [
  "What's in this folder?",
  'Summarize the main topics.',
  'What are the most important documents?',
  'List everything grouped by subject.',
];

// Dedupe cited files by link for the "Sources" list under an answer.
function uniqueSources(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of citations) {
    const key = c.link || c.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function AssistantMessage({ message, onRetry }: { message: StoredMessage; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  const sources = uniqueSources(message.citations ?? []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — ignore.
    }
  };

  if (message.error) {
    return (
      <div className="turn assistant error-turn">
        <span>{message.content}</span>
        <button className="link-button small" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="turn assistant">
      <Answer text={message.content} citations={message.citations ?? []} />
      {sources.length > 0 && (
        <div className="sources">
          <span className="muted small">Sources:</span>
          {sources.map((c) => (
            <a key={c.link || c.name} className="source-chip" href={c.link} target="_blank" rel="noreferrer">
              {c.name}
              {c.page ? ` · p${c.page}` : ''}
            </a>
          ))}
        </div>
      )}
      <div className="turn-footer">
        <button className="link-button small" onClick={copy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {message.usage && (
          <span className="muted small">
            {(message.usage.inputTokens + message.usage.outputTokens).toLocaleString()} tokens
          </span>
        )}
      </div>
    </div>
  );
}

export function ChatView({ messages, onAsk, onRetry, onExport, busy }: Props) {
  const [question, setQuestion] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  // Fetch folder-specific starter questions once, when the conversation is empty.
  useEffect(() => {
    if (messages.length === 0 && suggestions === undefined) {
      api
        .getSuggestions()
        .then((r) => setSuggestions(r.suggestions))
        .catch(() => setSuggestions([]));
    }
  }, [messages.length, suggestions]);

  const starters = suggestions && suggestions.length > 0 ? suggestions : STARTERS;

  const send = () => {
    const q = question.trim();
    if (!q || busy) return;
    onAsk(q);
    setQuestion('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };

  return (
    <div className="card chat">
      <div className="chat-head">
        <span className="muted small">Conversation</span>
        <button
          className="link-button small"
          onClick={onExport}
          disabled={messages.length === 0}
          title="Export this conversation as Markdown"
        >
          Export
        </button>
      </div>
      <div className="messages">
        {messages.length === 0 && (
          <div className="starters">
            <p className="muted">Ask anything about the documents in this folder, or start with:</p>
            <div className="starter-chips">
              {starters.map((s) => (
                <button key={s} className="starter-chip" onClick={() => onAsk(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="turn user">
              {m.content}
            </div>
          ) : (
            <AssistantMessage key={i} message={m} onRetry={onRetry} />
          ),
        )}
        {busy && <div className="turn assistant muted">Thinking…</div>}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={submit}>
        <textarea
          className="composer-input"
          placeholder="Ask a question…  (Enter to send, Shift+Enter for a new line)"
          value={question}
          rows={1}
          autoFocus
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={busy}
        />
        <button className="button" type="submit" disabled={busy || question.trim().length === 0}>
          Ask
        </button>
      </form>
    </div>
  );
}
