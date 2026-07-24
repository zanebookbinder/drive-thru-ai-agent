import Anthropic from '@anthropic-ai/sdk';
import { Config } from '../config';
import { CorpusDocument, FileMeta } from '../types';
import { SYSTEM, buildDocumentBlocks, buildManifest } from './prompt';

export interface AnswerResult {
  text: string;
  usage: Anthropic.Usage;
  documents: CorpusDocument[];
}

export interface PromptContext {
  documents: CorpusDocument[];
  manifest: FileMeta[];
  omitted: number;
  // True when the user narrowed the chat to a subset of files.
  scoped?: boolean;
  // Folder files excluded by that narrowing (for an honest "there may be more" note).
  scopedExcluded?: number;
}

type HistoryTurn = { role: 'user' | 'assistant'; content: string };

// Leave the input comfortably under the 1M-token context window; output is
// counted separately, so this is headroom against count-vs-generation variance.
const MAX_INPUT_TOKENS = 900_000;

function scopedNote(shown: number, excluded: number): string {
  const others =
    excluded > 0
      ? ` ${excluded} other file(s) in the folder were NOT included in this chat. If the answer isn't in the included file(s), say so, and add that other files in the folder weren't selected — the answer may be in one of those, so the user could select more files or switch back to "all files".`
      : '';
  return `\n\n[This conversation is narrowed to the ${shown} file(s) above; the manifest and text cover only those. Answer only from them.${others}]`;
}

function omissionNote(shown: number, omitted: number): string {
  if (omitted <= 0) return '';
  return `\n\n[Full text is loaded for ${shown} of ${
    shown + omitted
  } files. The rest appear in the manifest above but their contents are not loaded — the folder is too large to load in full.]`;
}

function buildMessages(
  documents: CorpusDocument[],
  manifest: FileMeta[],
  omitted: number,
  scoped: boolean,
  scopedExcluded: number,
  history: HistoryTurn[],
  question: string,
): Anthropic.MessageParam[] {
  const note =
    (scoped ? scopedNote(documents.length, scopedExcluded) : '') +
    omissionNote(documents.length, omitted);
  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: buildManifest(manifest) },
        {
          type: 'text',
          text: buildDocumentBlocks(documents) + note,
          cache_control: { type: 'ephemeral' },
        },
      ],
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];
}

// The 4-char/token estimate is unreliable for dense content, so measure the real
// count and trim documents until the prompt fits the context window. count_tokens
// is fast and free; the char-based pre-selection keeps this input small enough to
// count safely.
async function fitDocuments(
  client: Anthropic,
  model: string,
  context: PromptContext,
  history: HistoryTurn[],
  question: string,
): Promise<{ documents: CorpusDocument[]; omitted: number }> {
  let documents = context.documents;
  let omitted = context.omitted;

  for (let attempt = 0; attempt < 6 && documents.length > 0; attempt++) {
    const messages = buildMessages(documents, context.manifest, omitted, Boolean(context.scoped), context.scopedExcluded ?? 0, history, question);
    const { input_tokens } = await client.messages.countTokens({ model, system: SYSTEM, messages });
    if (input_tokens <= MAX_INPUT_TOKENS) break;

    // Drop proportionally to the overage, minus one to guarantee progress.
    const keep = Math.max(0, Math.floor(documents.length * (MAX_INPUT_TOKENS / input_tokens)) - 1);
    omitted += documents.length - keep;
    documents = documents.slice(0, keep);
  }

  return { documents, omitted };
}

// Sends the manifest + budget-fitted document bodies + history + question to Claude.
export async function answer(
  config: Config,
  context: PromptContext,
  history: HistoryTurn[],
  question: string,
): Promise<AnswerResult> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const fitted = await fitDocuments(client, config.anthropicModel, context, history, question);

  const response = await client.messages.create({
    model: config.anthropicModel,
    max_tokens: 4096,
    thinking: { type: 'disabled' },
    system: SYSTEM,
    messages: buildMessages(fitted.documents, context.manifest, fitted.omitted, Boolean(context.scoped), context.scopedExcluded ?? 0, history, question),
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return { text, usage: response.usage, documents: fitted.documents };
}
