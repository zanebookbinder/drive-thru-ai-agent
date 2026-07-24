import Anthropic from '@anthropic-ai/sdk';
import { Config } from '../config';

const SYSTEM = `
You are given the list of file paths in a Google Drive folder. Write a short
summary (2-3 sentences) of what the folder contains and how it is organized —
the main topics, subjects, or projects, and the structure. Base it only on the
names and paths. Output the summary text only, no preamble.
`.trim();

// Generates a folder summary from the file list (names/paths only — cheap, no
// document text needed).
export async function summarizeFolder(
  config: Config,
  files: Array<{ path: string; name: string }>,
): Promise<string> {
  const sample = files
    .slice(0, 500)
    .map((f) => (f.path ? `${f.path}/${f.name}` : f.name))
    .join('\n');

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const res = await client.messages.create({
    model: config.anthropicModel,
    max_tokens: 400,
    thinking: { type: 'disabled' },
    system: SYSTEM,
    messages: [{ role: 'user', content: sample || '(empty folder)' }],
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}
