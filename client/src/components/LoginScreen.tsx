import { useEffect, useState } from 'react';
import { FileTypeIcon } from './FileTypeIcon';

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

const EXAMPLES = [
  'Summarize each contract in this folder…',
  'Which of these mention the Q3 target?',
  'What classes did I take Senior Fall?',
  'Do any of these proposals conflict?',
];

// Types the current phrase out, pauses, deletes, and moves to the next.
function Typewriter({ phrases }: { phrases: string[] }) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[index];

    if (!deleting && text === current) {
      const t = setTimeout(() => setDeleting(true), 1600);
      return () => clearTimeout(t);
    }
    if (deleting && text === '') {
      setDeleting(false);
      setIndex((i) => (i + 1) % phrases.length);
      return;
    }
    const t = setTimeout(
      () =>
        setText((prev) => (deleting ? prev.slice(0, -1) : current.slice(0, prev.length + 1))),
      deleting ? 35 : 65,
    );
    return () => clearTimeout(t);
  }, [text, deleting, index, phrases]);

  return (
    <span className="typewriter">
      “{text}
      <span className="cursor" aria-hidden="true" />”
    </span>
  );
}

const TYPES = ['Google Doc', 'Google Sheet', 'PDF', 'Text', 'JSON'];

export function LoginScreen() {
  return (
    <div className="hero">
      <div className="hero-badge">Drive Chat</div>
      <h1 className="hero-title">Chat with your Google Drive.</h1>
      <p className="hero-example">
        <Typewriter phrases={EXAMPLES} />
      </p>
      <p className="hero-sub">
        Sign in, paste a Drive link, and have a conversation about what's inside — with citations
        that link straight back to the source.
      </p>

      <a className="google-btn" href="/auth/google">
        <GoogleLogo />
        Sign in with Google
      </a>

      <div className="types-strip">
        <span className="types-icons">
          {TYPES.map((t) => (
            <FileTypeIcon key={t} type={t} />
          ))}
        </span>
        <span className="muted small">Reads Docs, Sheets, PDFs, and more.</span>
      </div>

      <div className="faq">
        <details>
          <summary>What can it see?</summary>
          <p className="muted small">
            Read-only access to the Drive files you point it at — it can't edit, delete, move, or
            send anything. It only reads a folder after you paste its link.
          </p>
        </details>
        <details>
          <summary>Where does my data go?</summary>
          <p className="muted small">
            Your document text is read on demand and held only in memory — never written to disk. To
            answer a question it's sent to Anthropic's API (not retained by default). Conversations
            are saved so you can resume them, but the file contents are re-read from Drive each time,
            not stored.
          </p>
        </details>
        <details>
          <summary>Which files does it read?</summary>
          <p className="muted small">
            Google Docs, Sheets, PDFs, and text files. To stay fast it loads smaller files up front
            and lists the rest with a “Load” button so you can pull in exactly what you need.
          </p>
        </details>
      </div>
    </div>
  );
}
