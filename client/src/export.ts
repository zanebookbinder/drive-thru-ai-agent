import { Conversation } from './types';

// Renders a conversation as Markdown, turning [n] citation markers into real
// links so the exported file stands on its own.
export function conversationToMarkdown(conv: Conversation): string {
  const lines: string[] = [`# ${conv.title}`, '', `Source: ${conv.sourceUrl}`, ''];

  for (const m of conv.messages) {
    if (m.role === 'user') {
      lines.push(`## ${m.content}`, '');
      continue;
    }
    let body = m.content;
    for (const c of m.citations ?? []) {
      body = body.split(c.marker).join(`[${c.marker}](${c.link})`);
    }
    lines.push(body, '');
    if (m.citations && m.citations.length > 0) {
      lines.push('Sources:');
      for (const c of m.citations) {
        lines.push(`- ${c.marker} [${c.name}](${c.link})`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function downloadMarkdown(conv: Conversation): void {
  const blob = new Blob([conversationToMarkdown(conv)], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${conv.title.replace(/[^\w.-]+/g, '_')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
