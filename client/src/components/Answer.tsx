import { Fragment, ReactNode } from 'react';
import { Citation } from '../types';

interface Props {
  text: string;
  citations: Citation[];
}

const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[(\d+)(?::p(\d+))?\]/g;
const BULLET = /^\s*[-*]\s+/;
const ORDERED = /^\s*\d+\.\s+/;

// Renders a safe subset of Markdown — bold, italic, and lists — plus [n] /
// [n:p<page>] citation links. Everything is built from React elements; document
// content never reaches the DOM as HTML, so there is no XSS surface.
function renderInline(text: string, byMarker: Map<string, Citation>): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  // matchAll clones the regex, so its lastIndex is not shared across the
  // recursive calls below (a shared global regex would loop forever).
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    if (match[1] !== undefined) {
      nodes.push(<strong key={key++}>{renderInline(match[1], byMarker)}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(<em key={key++}>{renderInline(match[2], byMarker)}</em>);
    } else {
      const citation = byMarker.get(match[0]);
      if (citation) {
        nodes.push(
          <a
            key={key++}
            className="citation"
            href={citation.link}
            target="_blank"
            rel="noreferrer"
            title={`${citation.name}${citation.page ? ` · page ${citation.page}` : ''}`}
          >
            {match[0]}
          </a>,
        );
      } else {
        nodes.push(match[0]);
      }
    }
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Answer({ text, citations }: Props) {
  const byMarker = new Map(citations.map((c) => [c.marker, c]));
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const listItems = (pattern: RegExp) => {
    const items: ReactNode[] = [];
    while (i < lines.length && pattern.test(lines[i])) {
      items.push(<li key={items.length}>{renderInline(lines[i].replace(pattern, ''), byMarker)}</li>);
      i += 1;
    }
    return items;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (BULLET.test(line)) {
      blocks.push(<ul key={key++}>{listItems(BULLET)}</ul>);
    } else if (ORDERED.test(line)) {
      blocks.push(<ol key={key++}>{listItems(ORDERED)}</ol>);
    } else if (line.trim() === '') {
      i += 1;
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !BULLET.test(lines[i]) && !ORDERED.test(lines[i])) {
        para.push(lines[i]);
        i += 1;
      }
      blocks.push(<p key={key++}>{renderInline(para.join('\n'), byMarker)}</p>);
    }
  }

  return (
    <div className="answer">
      {blocks.map((b, idx) => (
        <Fragment key={idx}>{b}</Fragment>
      ))}
    </div>
  );
}
