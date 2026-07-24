import fs from 'fs';
import { StoredConversation } from '../types';

// Persists session auth plus conversation metadata + history so folders and their
// conversations survive a restart. Extracted document text is NEVER persisted —
// it stays in the in-memory corpus and is re-ingested on demand (ARCHITECTURE §8.1).
//
// Both tokens are encrypted at rest. `accessToken` is a legacy plaintext field kept
// only so records written before token encryption can still be read once.
export interface PersistedSession {
  id: string;
  userEmail: string;
  encryptedRefreshToken: string;
  encryptedAccessToken?: string;
  accessToken?: string;
  accessTokenExpiry: number;
  lastActivity: number;
  conversations: StoredConversation[];
  activeConversationId?: string;
}

// Seals/opens the access token at the persistence boundary. The default is
// identity — used in tests; production injects the AES-256-GCM cipher.
export interface TokenCipher {
  seal(plain: string): string;
  open(sealed: string): string;
}

export const identityCipher: TokenCipher = {
  seal: (v) => v,
  open: (v) => v,
};

export interface Persistence {
  load(): PersistedSession[];
  save(sessions: PersistedSession[]): void;
}

export class FilePersistence implements Persistence {
  constructor(private file: string) {}

  load(): PersistedSession[] {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8')) as PersistedSession[];
    } catch {
      return [];
    }
  }

  save(sessions: PersistedSession[]): void {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(sessions), { mode: 0o600 });
    fs.renameSync(tmp, this.file); // atomic replace
  }
}

export class NullPersistence implements Persistence {
  load(): PersistedSession[] {
    return [];
  }
  save(): void {}
}
