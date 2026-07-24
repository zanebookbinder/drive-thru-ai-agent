import { describe, expect, it } from 'vitest';
import { SessionStore } from './sessions';
import { Persistence, PersistedSession, TokenCipher } from './persistence';
import { Session } from '../types';

class MemoryPersistence implements Persistence {
  data: PersistedSession[] = [];
  load() {
    return this.data;
  }
  save(sessions: PersistedSession[]) {
    this.data = sessions;
  }
}

// A reversible non-identity cipher, enough to prove the token is transformed at rest.
const reverseCipher: TokenCipher = {
  seal: (v) => `enc:${[...v].reverse().join('')}`,
  open: (v) => [...v.replace(/^enc:/, '')].reverse().join(''),
};

function session(id: string): Session {
  return {
    id,
    userEmail: 'a@b.com',
    encryptedRefreshToken: 'enc',
    accessToken: 'tok',
    accessTokenExpiry: 0,
    lastActivity: Date.now(),
    activeConversationId: 'conv1',
    conversations: [
      {
        id: 'conv1',
        title: 'My Folder',
        sourceUrl: 'https://drive.google.com/drive/folders/x',
        rootId: 'x',
        tier: 1,
        createdAt: Date.now(),
        files: [],
        skipped: [],
        messages: [{ role: 'user', content: 'my question' }],
      },
    ],
    // In-memory corpus text — must never be persisted.
    corpora: new Map([['conv1', { documents: [{ text: 'secret document text' }] } as never]]),
  };
}

describe('SessionStore persistence', () => {
  it('persists auth on set and reloads it into a fresh store', () => {
    const backend = new MemoryPersistence();
    const store = new SessionStore(1_000_000, backend);
    store.set(session('s1'));

    const reloaded = new SessionStore(1_000_000, backend);
    expect(reloaded.get('s1')?.userEmail).toBe('a@b.com');
    expect(reloaded.get('s1')?.encryptedRefreshToken).toBe('enc');
  });

  it('persists conversation history but never the extracted document text', () => {
    const backend = new MemoryPersistence();
    const store = new SessionStore(1_000_000, backend);
    store.set(session('s1'));

    const serialized = JSON.stringify(backend.data);
    // Conversation history resumes across restarts.
    expect(serialized).toContain('my question');
    // Extracted document text never touches disk.
    expect(serialized).not.toContain('secret document text');

    // Reloaded session keeps conversations but starts with an empty corpus map.
    const reloaded = new SessionStore(1_000_000, backend);
    expect(reloaded.get('s1')?.conversations[0].messages[0].content).toBe('my question');
    expect(reloaded.get('s1')?.corpora.size).toBe(0);
  });

  it('drops persisted sessions already past the idle cutoff on load', () => {
    const backend = new MemoryPersistence();
    backend.data = [
      {
        id: 'old',
        userEmail: 'a@b.com',
        encryptedRefreshToken: 'enc',
        accessToken: 'tok',
        accessTokenExpiry: 0,
        lastActivity: Date.now() - 10_000,
        conversations: [],
      },
    ];
    const store = new SessionStore(1_000, backend);
    expect(store.get('old')).toBeUndefined();
  });

  it('encrypts the access token at rest and never writes it in plaintext', () => {
    const backend = new MemoryPersistence();
    const store = new SessionStore(1_000_000, backend, reverseCipher);
    store.set(session('s1')); // accessToken is 'tok'

    const record = backend.data[0] as PersistedSession & { accessToken?: string };
    expect(record.accessToken).toBeUndefined();
    expect(record.encryptedAccessToken).toBe('enc:kot');
    expect(JSON.stringify(backend.data)).not.toContain('"tok"');

    const reloaded = new SessionStore(1_000_000, backend, reverseCipher);
    expect(reloaded.get('s1')?.accessToken).toBe('tok');
  });

  it('reads a legacy plaintext access token once, then re-encrypts on next write', () => {
    const backend = new MemoryPersistence();
    backend.data = [
      {
        id: 'legacy',
        userEmail: 'a@b.com',
        encryptedRefreshToken: 'enc',
        accessToken: 'plain-tok',
        accessTokenExpiry: 0,
        lastActivity: Date.now(),
        conversations: [],
      },
    ];
    const store = new SessionStore(1_000_000, backend, reverseCipher);
    expect(store.get('legacy')?.accessToken).toBe('plain-tok');

    store.flush();
    const record = backend.data[0] as PersistedSession & { accessToken?: string };
    expect(record.accessToken).toBeUndefined();
    expect(record.encryptedAccessToken).toBe('enc:kot-nialp');
  });

  it('removes a session from the persisted set on delete', () => {
    const backend = new MemoryPersistence();
    const store = new SessionStore(1_000_000, backend);
    store.set(session('s1'));
    store.delete('s1');
    expect(backend.data).toHaveLength(0);
  });
});
