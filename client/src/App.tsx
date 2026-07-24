import { useEffect, useMemo, useState } from 'react';
import * as api from './api';
import { ReauthError } from './api';
import { Conversation, StoredMessage } from './types';
import { downloadMarkdown } from './export';
import { LoginScreen } from './components/LoginScreen';
import { LinkInput } from './components/LinkInput';
import { IngestSummary } from './components/IngestSummary';
import { ChatView } from './components/ChatView';
import { Sidebar } from './components/Sidebar';

type Phase = 'loading' | 'unauthenticated' | 'authenticated';
type Theme = 'dark' | 'light';

const THEME_KEY = 'drive-chat-theme';

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [email, setEmail] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [composing, setComposing] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string>();
  const [chatBusy, setChatBusy] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored) return stored;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    api
      .fetchMe()
      .then(async (me) => {
        if (!me) return setPhase('unauthenticated');
        setEmail(me.email);
        const { conversations, activeConversationId } = await api.fetchConversations();
        setConversations(conversations);
        setActiveId(activeConversationId ?? conversations[0]?.id);
        setComposing(conversations.length === 0);
        setPhase('authenticated');
      })
      .catch(() => setPhase('unauthenticated'));
  }, []);

  const toLogin = (message?: string) => {
    setPhase('unauthenticated');
    setConversations([]);
    setActiveId(undefined);
    setIngestError(message);
  };

  const patchConversation = (id: string, patch: (c: Conversation) => Conversation) =>
    setConversations((prev) => prev.map((c) => (c.id === id ? patch(c) : c)));

  const handleIngest = async (link: string, summarize: boolean) => {
    setIngesting(true);
    setIngestError(undefined);
    try {
      const { conversation } = await api.ingest(link, summarize);
      setConversations((prev) => [conversation, ...prev.filter((c) => c.id !== conversation.id)]);
      setActiveId(conversation.id);
      setComposing(false);
    } catch (err) {
      if (err instanceof ReauthError) return toLogin(err.message);
      setIngestError(err instanceof Error ? err.message : 'Ingest failed.');
    } finally {
      setIngesting(false);
    }
  };

  const handleSelect = async (id: string) => {
    setComposing(false);
    setActiveId(id);
    try {
      const { conversation } = await api.selectConversation(id);
      patchConversation(id, () => conversation);
    } catch (err) {
      if (err instanceof ReauthError) toLogin(err.message);
    }
  };

  const handleReload = async () => {
    if (!activeId) return;
    setReloading(true);
    try {
      const { conversation } = await api.reloadConversation(activeId);
      patchConversation(activeId, () => conversation);
    } catch (err) {
      if (err instanceof ReauthError) toLogin(err.message);
    } finally {
      setReloading(false);
    }
  };

  const handleLoadFile = async (fileId: string) => {
    setLoadingFiles((prev) => new Set(prev).add(fileId));
    try {
      const { conversation } = await api.loadFile(fileId);
      patchConversation(conversation.id, () => conversation);
    } catch (err) {
      if (err instanceof ReauthError) toLogin(err.message);
    } finally {
      setLoadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  const handleAsk = async (question: string) => {
    if (!activeId) return;
    const userMsg: StoredMessage = { role: 'user', content: question };
    patchConversation(activeId, (c) => ({ ...c, messages: [...c.messages, userMsg] }));
    setChatBusy(true);
    try {
      const { answer, citations, usage } = await api.chat(question);
      patchConversation(activeId, (c) => ({
        ...c,
        messages: [...c.messages, { role: 'assistant', content: answer, citations, usage }],
      }));
    } catch (err) {
      if (err instanceof ReauthError) return toLogin(err.message);
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      patchConversation(activeId, (c) => ({
        ...c,
        messages: [...c.messages, { role: 'assistant', content: message, error: true }],
      }));
    } finally {
      setChatBusy(false);
    }
  };

  const handleRetry = () => {
    if (!active) return;
    const lastUser = [...active.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    // Drop the failed answer and its question, then re-ask.
    patchConversation(active.id, (c) => {
      const m = [...c.messages];
      if (m.at(-1)?.role === 'assistant') m.pop();
      if (m.at(-1)?.role === 'user') m.pop();
      return { ...c, messages: m };
    });
    handleAsk(lastUser.content);
  };

  const handleLoadAll = async () => {
    if (!activeId) return;
    setLoadingAll(true);
    try {
      const { conversation } = await api.loadAll();
      patchConversation(conversation.id, () => conversation);
    } catch (err) {
      if (err instanceof ReauthError) toLogin(err.message);
    } finally {
      setLoadingAll(false);
    }
  };

  const handleRename = async (id: string, title: string) => {
    patchConversation(id, (c) => ({ ...c, title }));
    try {
      await api.renameConversation(id, title);
    } catch (err) {
      if (err instanceof ReauthError) toLogin(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { conversations, activeConversationId } = await api.deleteConversation(id);
      setConversations(conversations);
      setActiveId(activeConversationId);
      setComposing(conversations.length === 0);
    } catch (err) {
      if (err instanceof ReauthError) toLogin(err.message);
    }
  };

  const handlePin = async (id: string, pinned: boolean) => {
    patchConversation(id, (c) => ({ ...c, pinned }));
    try {
      await api.pinConversation(id, pinned);
    } catch (err) {
      if (err instanceof ReauthError) toLogin(err.message);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    toLogin();
  };

  if (phase === 'loading') return <div className="center muted">Loading…</div>;
  if (phase === 'unauthenticated')
    return (
      <main className="layout">
        {ingestError && <p className="banner">{ingestError}</p>}
        <LoginScreen />
      </main>
    );

  const showInput = composing || !active;

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={active && !composing ? activeId : undefined}
        onSelect={handleSelect}
        onNew={() => setComposing(true)}
        onRename={handleRename}
        onDelete={handleDelete}
        onPin={handlePin}
      />
      <main className="layout">
        <header className="topbar">
          <span className="brand">Drive Chat</span>
          <span className="row">
            <button
              className="link-button icon-only"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title="Toggle light / dark theme"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              )}
            </button>
            <span className="muted">{email}</span>
            <button className="link-button" onClick={handleLogout}>
              Sign out
            </button>
          </span>
        </header>

        {showInput ? (
          <LinkInput onSubmit={handleIngest} disabled={ingesting} error={ingestError} />
        ) : (
          active && (
            <>
              <IngestSummary
                conversation={active}
                onReload={handleReload}
                reloading={reloading}
                onLoadFile={handleLoadFile}
                loadingFiles={loadingFiles}
                onLoadAll={handleLoadAll}
                loadingAll={loadingAll}
              />
              <ChatView
                key={active.id}
                messages={active.messages}
                onAsk={handleAsk}
                onRetry={handleRetry}
                onExport={() => downloadMarkdown(active)}
                busy={chatBusy}
              />
            </>
          )
        )}
      </main>
    </div>
  );
}
