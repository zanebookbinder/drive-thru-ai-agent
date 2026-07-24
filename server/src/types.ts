export interface FileMeta {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  path: string;
}

export interface SkipRecord {
  fileId: string;
  name: string;
  reason: string;
}

export interface Anchor {
  type: 'page';
  index: number;
  charOffset: number;
}

export interface CorpusDocument {
  fileId: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  path: string;
  text: string;
  tokenEstimate: number;
  anchors: Anchor[];
}

export interface Corpus {
  id: string;
  title: string;
  sourceUrl: string;
  rootId: string;
  tier: 1 | 2;
  documents: CorpusDocument[];
  manifest: FileMeta[];
  // Supported files not parsed at ingest (too large, or past the eager-load cap).
  // The user can load these on demand.
  unloaded: FileMeta[];
  tokensLoaded: number;
  skipped: SkipRecord[];
}

export interface Citation {
  marker: string;
  index: number;
  page?: number;
  name: string;
  path: string;
  link: string;
}

// A file as shown in the sidebar / summary — metadata only, no text.
export interface StoredFile {
  fileId: string;
  name: string;
  path: string;
  link: string;
  type: string;
  sizeBytes: number;
  estimated: boolean;
  loaded: boolean;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  usage?: Usage;
}

// A resumable conversation. Persisted across restarts — metadata and history
// only. The document text needed to answer new questions lives in the in-memory
// corpus and is re-ingested on demand (ARCHITECTURE §8.1: text is never stored).
export interface StoredConversation {
  id: string;
  title: string;
  sourceUrl: string;
  rootId: string;
  tier: 1 | 2;
  createdAt: number;
  files: StoredFile[];
  skipped: SkipRecord[];
  messages: StoredMessage[];
  // File IDs the user explicitly loaded past the size gate — re-applied when the
  // corpus is re-ingested (e.g. after a restart) so manual loads survive.
  manuallyLoaded: string[];
  // Cached starter questions generated from the file list (see chat/suggest).
  suggestions?: string[];
  pinned?: boolean;
  // Optional folder summary, generated at ingest when the user opts in.
  summary?: string;
  // If non-empty, chat is scoped to these files only (default: all loaded files).
  selectedFileIds?: string[];
}

export interface Session {
  id: string;
  userEmail: string;
  encryptedRefreshToken: string;
  accessToken: string;
  accessTokenExpiry: number;
  lastActivity: number;
  conversations: StoredConversation[];
  activeConversationId?: string;
  // In-memory only — never persisted. Keyed by conversation id.
  corpora: Map<string, Corpus>;
}
