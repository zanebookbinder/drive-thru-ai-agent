import { ReactNode } from 'react';

// Types recognizable enough to show as an icon alone; others keep their label.
// PDF's glyph literally reads "PDF", so it needs no word beside it.
export const ICON_ONLY = new Set(['Google Doc', 'Google Sheet', 'Google Slides', 'PDF']);

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

// Google Drive's PDF file glyph — a filled red tile with the letters knocked out.
function PdfIcon() {
  return (
    <svg className="ftype-icon" width="19" height="19" viewBox="-2.5 -2.5 21 21" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.778 0h12.444C15.2 0 16 .8 16 1.778v12.444C16 15.2 15.2 16 14.222 16H1.778C.8 16 0 15.2 0 14.222V1.778C0 .8.8 0 1.778 0zm2.666 7.556h-.888v-.89h.888v.89zm1.334 0c0 .737-.596 1.333-1.334 1.333h-.888v1.778H2.222V5.333h2.222c.738 0 1.334.596 1.334 1.334v.889zm6.666-.89h2.223V5.334H11.11v5.334h1.333V8.889h1.334V7.556h-1.334v-.89zm-2.222 2.667c0 .738-.595 1.334-1.333 1.334H6.667V5.333h2.222c.738 0 1.333.596 1.333 1.334v2.666zm-1.333 0H8V6.667h.889v2.666z"
        fill="#EA4335"
      />
    </svg>
  );
}

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
      return <PdfIcon />;
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
