export interface Citation {
  marker: string;
  index: number;
  page?: number;
  name: string;
  path: string;
  link: string;
}

export interface SkipRecord {
  fileId: string;
  name: string;
  reason: string;
}

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
  // Client-only: marks a failed answer so the UI can offer a retry.
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  sourceUrl: string;
  rootId: string;
  tier: 1 | 2;
  createdAt: number;
  files: StoredFile[];
  skipped: SkipRecord[];
  messages: StoredMessage[];
  suggestions?: string[];
  pinned?: boolean;
  summary?: string;
}

export interface ChatResult {
  answer: string;
  citations: Citation[];
  usage: Usage;
}
