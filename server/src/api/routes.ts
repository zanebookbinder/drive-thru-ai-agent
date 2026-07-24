import { Router } from 'express';
import { Config } from '../config';
import { SessionStore } from '../store/sessions';
import { requireSession } from '../auth/middleware';
import { ReauthRequired } from '../auth/oauth';
import { DriveClient } from '../drive/client';
import { describeFiles } from '../drive/describe';
import { exportFile, isSupported } from '../drive/export';
import { ingest } from '../drive/ingest';
import { parseDriveLink } from '../drive/parseLink';
import { answer } from '../chat/anthropic';
import { extractCitations } from '../chat/citations';
import { CostTracker, SPEND_LIMIT_USD, usdForAnthropicUsage } from '../chat/cost';
import { suggestQuestions } from '../chat/suggest';
import { summarizeFolder } from '../chat/summarize';
import { selectDocuments } from '../context/assemble';
import { Corpus, Session, StoredConversation } from '../types';
import { limitConcurrency } from '../util/limit';
import { log } from '../util/log';

// The corpus text is not persisted, so after a restart (or when switching to a
// conversation whose text isn't loaded) we re-ingest the folder on demand.
async function ensureCorpus(
  config: Config,
  store: SessionStore,
  session: Session,
  conv: StoredConversation,
): Promise<Corpus> {
  const loaded = session.corpora.get(conv.id);
  if (loaded) return loaded;

  const client = new DriveClient(config, store, session);
  const corpus = await ingest(
    client,
    conv.sourceUrl,
    conv.rootId,
    config.maxCorpusTokens,
    new Set(conv.manuallyLoaded ?? []),
  );
  session.corpora.set(conv.id, corpus);
  conv.files = describeFiles(corpus);
  conv.tier = corpus.tier;
  conv.skipped = corpus.skipped;
  store.flush();
  return corpus;
}

export function createApiRouter(config: Config, store: SessionStore): Router {
  const router = Router();
  const cost = new CostTracker();
  router.use(requireSession(store));

  router.get('/api/conversations', (_req, res) => {
    const session = res.locals.session!;
    res.json({
      conversations: session.conversations,
      activeConversationId: session.activeConversationId,
      spend: { usd: cost.get(session.userEmail), limit: SPEND_LIMIT_USD },
    });
  });

  router.post('/api/ingest', async (req, res, next) => {
    const session = res.locals.session!;
    const link = String(req.body?.link ?? '');
    const summarize = req.body?.summarize !== false; // default on
    const rootId = parseDriveLink(link);
    if (!rootId) {
      res.status(400).json({ error: 'That does not look like a Google Drive link.' });
      return;
    }

    try {
      const client = new DriveClient(config, store, session);
      const corpus = await ingest(client, link, rootId, config.maxCorpusTokens);
      session.corpora.set(corpus.id, corpus);

      const conversation: StoredConversation = {
        id: corpus.id,
        title: corpus.title,
        sourceUrl: link,
        rootId,
        tier: corpus.tier,
        createdAt: Date.now(),
        files: describeFiles(corpus),
        skipped: corpus.skipped,
        messages: [],
        manuallyLoaded: [],
      };
      if (summarize && !cost.isOverLimit(session.userEmail)) {
        try {
          const result = await summarizeFolder(config, conversation.files);
          conversation.summary = result.summary;
          cost.add(session.userEmail, usdForAnthropicUsage(result.usage));
        } catch (err) {
          log.warn('folder summary failed', { conversationId: conversation.id });
        }
      }
      session.conversations.unshift(conversation);
      session.activeConversationId = conversation.id;
      store.flush();
      res.json({ conversation });
    } catch (err) {
      if (err instanceof ReauthRequired) {
        res.status(401).json({ code: 'REAUTH_REQUIRED', error: err.message });
        return;
      }
      next(err);
    }
  });

  router.post('/api/conversations/select', (req, res) => {
    const session = res.locals.session!;
    const id = String(req.body?.id ?? '');
    const conv = session.conversations.find((c) => c.id === id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    session.activeConversationId = id;
    store.flush();
    res.json({ conversation: conv });
  });

  router.post('/api/conversations/rename', (req, res) => {
    const session = res.locals.session!;
    const conv = session.conversations.find((c) => c.id === String(req.body?.id ?? ''));
    const title = String(req.body?.title ?? '').trim();
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    if (title) conv.title = title.slice(0, 200);
    store.flush();
    res.json({ conversation: conv });
  });

  router.post('/api/conversations/pin', (req, res) => {
    const session = res.locals.session!;
    const conv = session.conversations.find((c) => c.id === String(req.body?.id ?? ''));
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    conv.pinned = Boolean(req.body?.pinned);
    store.flush();
    res.json({ conversation: conv });
  });

  // Narrow chat to a subset of files (empty = all). Ids not currently loaded are
  // simply ignored when the prompt is built.
  router.post('/api/conversations/select-files', (req, res) => {
    const session = res.locals.session!;
    const conv = session.conversations.find((c) => c.id === session.activeConversationId);
    if (!conv) {
      res.status(400).json({ error: 'No active conversation.' });
      return;
    }
    const ids = Array.isArray(req.body?.fileIds) ? req.body.fileIds.map(String) : [];
    conv.selectedFileIds = ids;
    store.flush();
    res.json({ conversation: conv });
  });

  router.post('/api/conversations/delete', (req, res) => {
    const session = res.locals.session!;
    const id = String(req.body?.id ?? '');
    session.conversations = session.conversations.filter((c) => c.id !== id);
    session.corpora.delete(id);
    if (session.activeConversationId === id) {
      session.activeConversationId = session.conversations[0]?.id;
    }
    store.flush();
    res.json({ conversations: session.conversations, activeConversationId: session.activeConversationId });
  });

  // Starter questions derived from the file list. Cached on the conversation.
  router.post('/api/conversations/suggestions', async (req, res, next) => {
    const session = res.locals.session!;
    const conv = session.conversations.find((c) => c.id === session.activeConversationId);
    if (!conv) {
      res.status(400).json({ error: 'No active conversation.' });
      return;
    }
    if (conv.suggestions && conv.suggestions.length > 0) {
      res.json({ suggestions: conv.suggestions });
      return;
    }
    if (cost.isOverLimit(session.userEmail)) {
      res.json({ suggestions: [] }); // over budget — client falls back to generic prompts
      return;
    }
    try {
      const result = await suggestQuestions(config, conv.files);
      cost.add(session.userEmail, usdForAnthropicUsage(result.usage));
      conv.suggestions = result.questions;
      store.flush();
      res.json({ suggestions: conv.suggestions });
    } catch (err) {
      next(err);
    }
  });

  // Parse every remaining unloaded file (user-requested; can be slow on big folders).
  router.post('/api/conversations/load-all', async (req, res, next) => {
    const session = res.locals.session!;
    const conv = session.conversations.find((c) => c.id === session.activeConversationId);
    if (!conv) {
      res.status(400).json({ error: 'No active conversation.' });
      return;
    }
    try {
      const corpus = await ensureCorpus(config, store, session, conv);
      const client = new DriveClient(config, store, session);
      const limit = limitConcurrency(5);
      conv.manuallyLoaded = conv.manuallyLoaded ?? [];

      await Promise.all(
        [...corpus.unloaded].map((file) =>
          limit(async () => {
            try {
              corpus.documents.push(await exportFile(client, file));
              if (!conv.manuallyLoaded.includes(file.id)) conv.manuallyLoaded.push(file.id);
            } catch (err) {
              log.warn('file skipped during load-all', { fileId: file.id });
            }
          }),
        ),
      );

      const loadedIds = new Set(corpus.documents.map((d) => d.fileId));
      corpus.unloaded = corpus.unloaded.filter((f) => !loadedIds.has(f.id));
      conv.files = describeFiles(corpus);
      conv.tier = corpus.tier;
      store.flush();
      res.json({ conversation: conv });
    } catch (err) {
      if (err instanceof ReauthRequired) {
        res.status(401).json({ code: 'REAUTH_REQUIRED', error: err.message });
        return;
      }
      next(err);
    }
  });

  // Re-read the folder from Drive, replacing the stored files and in-memory corpus.
  // Conversation history is kept; the document contents are refreshed.
  router.post('/api/conversations/reload', async (req, res, next) => {
    const session = res.locals.session!;
    const id = String(req.body?.id ?? '');
    const conv = session.conversations.find((c) => c.id === id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    try {
      const client = new DriveClient(config, store, session);
      const corpus = await ingest(
        client,
        conv.sourceUrl,
        conv.rootId,
        config.maxCorpusTokens,
        new Set(conv.manuallyLoaded ?? []),
      );
      session.corpora.set(conv.id, corpus);
      conv.title = corpus.title;
      conv.files = describeFiles(corpus);
      conv.tier = corpus.tier;
      conv.skipped = corpus.skipped;
      store.flush();
      res.json({ conversation: conv });
    } catch (err) {
      if (err instanceof ReauthRequired) {
        res.status(401).json({ code: 'REAUTH_REQUIRED', error: err.message });
        return;
      }
      next(err);
    }
  });

  // Parse a single file the user chose to load past the size gate, add it to the
  // in-memory corpus, and remember it so it survives a re-ingest.
  router.post('/api/conversations/load-file', async (req, res, next) => {
    const session = res.locals.session!;
    const conv = session.conversations.find((c) => c.id === session.activeConversationId);
    const fileId = String(req.body?.fileId ?? '');
    if (!conv) {
      res.status(400).json({ error: 'No active conversation.' });
      return;
    }
    try {
      conv.manuallyLoaded = conv.manuallyLoaded ?? [];
      if (!conv.manuallyLoaded.includes(fileId)) conv.manuallyLoaded.push(fileId);

      const corpus = await ensureCorpus(config, store, session, conv);
      // If the corpus was already warm, ensureCorpus didn't re-ingest — load the
      // one file directly.
      if (!corpus.documents.some((d) => d.fileId === fileId)) {
        const meta = corpus.manifest.find((f) => f.id === fileId);
        if (!meta || !isSupported(meta.mimeType)) {
          res.status(400).json({ error: 'That file cannot be loaded.' });
          return;
        }
        const client = new DriveClient(config, store, session);
        corpus.documents.push(await exportFile(client, meta));
        corpus.unloaded = corpus.unloaded.filter((f) => f.id !== fileId);
      }

      conv.files = describeFiles(corpus);
      conv.tier = corpus.tier;
      store.flush();
      res.json({ conversation: conv });
    } catch (err) {
      if (err instanceof ReauthRequired) {
        res.status(401).json({ code: 'REAUTH_REQUIRED', error: err.message });
        return;
      }
      next(err);
    }
  });

  router.post('/api/chat', async (req, res, next) => {
    const session = res.locals.session!;
    const question = String(req.body?.question ?? '').trim();
    const conv = session.conversations.find((c) => c.id === session.activeConversationId);
    if (!conv) {
      res.status(400).json({ error: 'Paste a Drive folder link before asking questions.' });
      return;
    }
    if (!question) {
      res.status(400).json({ error: 'Ask a question.' });
      return;
    }
    if (cost.isOverLimit(session.userEmail)) {
      res.status(402).json({
        error: `You've reached the $${SPEND_LIMIT_USD} usage limit for this session. It resets when the server restarts.`,
      });
      return;
    }

    try {
      const corpus = await ensureCorpus(config, store, session, conv);

      // Scope to the user's selection if any, else use the whole corpus.
      const selected = conv.selectedFileIds?.length ? new Set(conv.selectedFileIds) : null;
      const scopedDocs = selected
        ? corpus.documents.filter((d) => selected.has(d.fileId))
        : corpus.documents;
      const scopedManifest = selected
        ? corpus.manifest.filter((f) => selected.has(f.id))
        : corpus.manifest;

      const { included, omitted } = selectDocuments(scopedDocs, config.maxCorpusTokens);
      const history = conv.messages.map((m) => ({ role: m.role, content: m.content }));
      const { text, usage, documents } = await answer(
        config,
        {
          documents: included,
          manifest: scopedManifest,
          omitted,
          scoped: Boolean(selected),
          scopedExcluded: selected ? corpus.manifest.length - scopedManifest.length : 0,
        },
        history,
        question,
      );
      const citations = extractCitations(text, documents);
      const messageUsage = {
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
      };

      cost.add(session.userEmail, usdForAnthropicUsage(usage));

      conv.messages.push({ role: 'user', content: question });
      conv.messages.push({ role: 'assistant', content: text, citations, usage: messageUsage });
      store.flush();

      log.info('chat answered', {
        sessionId: session.id,
        cacheRead: usage.cache_read_input_tokens ?? 0,
        cacheWrite: usage.cache_creation_input_tokens ?? 0,
      });
      res.json({
        answer: text,
        citations,
        usage: messageUsage,
        spend: { usd: cost.get(session.userEmail), limit: SPEND_LIMIT_USD },
      });
    } catch (err) {
      if (err instanceof ReauthRequired) {
        res.status(401).json({ code: 'REAUTH_REQUIRED', error: err.message });
        return;
      }
      next(err);
    }
  });

  return router;
}
