import { ReactNode } from 'react';

// Types recognizable enough to show as an icon alone; others keep their label.
export const ICON_ONLY = new Set(['Google Doc', 'Google Sheet', 'Google Slides']);

function Doc({ color, corner, children }: { color: string; corner: string; children?: ReactNode }) {
  return (
    <svg className="ftype-icon" width="19" height="19" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4.5 1.5h4L12 5v8.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
        fill={color}
      />
      <path d="M8.5 1.5 12 5H9a.5.5 0 0 1-.5-.5V1.5Z" fill={corner} />
      {children}
    </svg>
  );
}

const lines = (
  <g stroke="#fff" strokeWidth="0.9" strokeLinecap="round">
    <line x1="5.3" y1="7.6" x2="10.2" y2="7.6" />
    <line x1="5.3" y1="9.4" x2="10.2" y2="9.4" />
    <line x1="5.3" y1="11.2" x2="8.6" y2="11.2" />
  </g>
);

const grid = (
  <g stroke="#fff" strokeWidth="0.8" fill="none">
    <rect x="5" y="7" width="6" height="5.2" rx="0.4" />
    <line x1="5" y1="9.6" x2="11" y2="9.6" />
    <line x1="8" y1="7" x2="8" y2="12.2" />
  </g>
);

const slide = (
  <rect x="5" y="7.4" width="6" height="4.4" rx="0.5" fill="none" stroke="#fff" strokeWidth="0.9" />
);

// Icon for a friendly file-type label. Google types get brand-ish colors; Text /
// PDF / JSON / etc. get sensible made-up glyphs (paired with their word elsewhere).
export function FileTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'Google Doc':
      return <Doc color="#4285F4" corner="#A6C5FA">{lines}</Doc>;
    case 'Google Sheet':
      return <Doc color="#0F9D58" corner="#9CD9BC">{grid}</Doc>;
    case 'Google Slides':
      return <Doc color="#F4B400" corner="#FADE93">{slide}</Doc>;
    case 'PDF':
      return <Doc color="#EA4335" corner="#F6A9A2">{lines}</Doc>;
    case 'CSV':
      return <Doc color="#2E9E6B" corner="#A9DcC5">{grid}</Doc>;
    case 'JSON':
      return <Doc color="#C98A2B" corner="#EAC591">{lines}</Doc>;
    case 'Text':
    case 'Markdown':
      return <Doc color="#8A93A6" corner="#C3C9D4">{lines}</Doc>;
    default:
      return <Doc color="#6B7280" corner="#B3B9C4">{lines}</Doc>;
  }
}
