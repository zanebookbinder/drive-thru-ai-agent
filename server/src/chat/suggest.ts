import Anthropic from '@anthropic-ai/sdk';
import { Config } from '../config';

const SYSTEM = `
Given a list of file paths from a Google Drive folder, propose four short, specific
questions a user might ask about the folder's contents. Base them on the actual
names and structure. Output ONLY the four questions, one per line, with no
numbering, bullets, or extra text.
`.trim();

// Generates starter questions from the file list (names/paths only — no document
// text needed, so this is cheap and needs no ingest).
export async function suggestQuestions(
  config: Config,
  files: Array<{ path: string; name: string }>,
): Promise<string[]> {
  const sample = files
    .slice(0, 400)
    .map((f) => (f.path ? `${f.path}/${f.name}` : f.name))
    .join('\n');

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const res = await client.messages.create({
    model: config.anthropicModel,
    max_tokens: 300,
    thinking: { type: 'disabled' },
    system: SYSTEM,
    messages: [{ role: 'user', content: sample || '(empty folder)' }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return text
    .split('\n')
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 4);
}
