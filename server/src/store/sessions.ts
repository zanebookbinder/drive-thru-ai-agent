import { Session } from '../types';
import { identityCipher, NullPersistence, Persistence, TokenCipher } from './persistence';

// Deleting a session drops its corpus and history with it — document text has
// no other reference. The idle sweep is the ephemerality guarantee.
//
// Session auth (tokens + identity) is persisted so the process can restart — on a
// deploy or, in dev, on every file change — without logging everyone out. Corpus
// and history are never persisted (ARCHITECTURE §8.1).
export class SessionStore {
  private sessions = new Map<string, Session>();
  private sweepTimer?: NodeJS.Timeout;
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private idleMs: number,
    private persistence: Persistence = new NullPersistence(),
    private cipher: TokenCipher = identityCipher,
  ) {
    const cutoff = Date.now() - idleMs;
    for (const p of persistence.load()) {
      if (p.lastActivity < cutoff) continue;
      this.sessions.set(p.id, {
        id: p.id,
        userEmail: p.userEmail,
        encryptedRefreshToken: p.encryptedRefreshToken,
        accessToken: this.openAccessToken(p),
        accessTokenExpiry: p.accessTokenExpiry,
        lastActivity: p.lastActivity,
        conversations: p.conversations ?? [],
        activeConversationId: p.activeConversationId,
        // Corpus text is not persisted; it is re-ingested on demand.
        corpora: new Map(),
      });
    }
  }

  // A failed decrypt (rotated key) or a stale token yields ''; the Drive client
  // then refreshes on the first 401, so this never blocks a returning user.
  private openAccessToken(p: { encryptedAccessToken?: string; accessToken?: string }): string {
    if (p.encryptedAccessToken) {
      try {
        return this.cipher.open(p.encryptedAccessToken);
      } catch {
        return '';
      }
    }
    return p.accessToken ?? '';
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  // Lets a returning user re-attach to their existing session (and conversations)
  // after a soft logout, rather than orphaning it behind a new session id.
  findByEmail(email: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.userEmail === email) return session;
    }
    return undefined;
  }

  set(session: Session): void {
    this.sessions.set(session.id, session);
    this.flush();
  }

  delete(id: string): void {
    this.sessions.delete(id);
    this.flush();
  }

  touch(id: string): void {
    const session = this.sessions.get(id);
    if (session) session.lastActivity = Date.now();
  }

  get size(): number {
    return this.sessions.size;
  }

  sweep(now = Date.now()): number {
    const cutoff = now - this.idleMs;
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (session.lastActivity < cutoff) {
        this.sessions.delete(id);
        removed += 1;
      }
    }
    if (removed > 0) this.flush();
    return removed;
  }

  // Persist auth only. Corpus and history are stripped by construction — they are
  // not part of the persisted shape.
  flush(): void {
    this.persistence.save(
      [...this.sessions.values()].map((s) => ({
        id: s.id,
        userEmail: s.userEmail,
        encryptedRefreshToken: s.encryptedRefreshToken,
        // Access token is encrypted at rest; the plaintext field is never written.
        encryptedAccessToken: this.cipher.seal(s.accessToken),
        accessTokenExpiry: s.accessTokenExpiry,
        lastActivity: s.lastActivity,
        conversations: s.conversations,
        activeConversationId: s.activeConversationId,
      })),
    );
  }

  startSweeping(intervalMs = 60_000): void {
    this.sweepTimer = setInterval(() => this.sweep(), intervalMs);
    this.sweepTimer.unref();
  }

  // Periodic flush captures in-place changes (touch, token refresh) that don't
  // pass through set()/delete().
  startFlushing(intervalMs = 15_000): void {
    this.flushTimer = setInterval(() => this.flush(), intervalMs);
    this.flushTimer.unref();
  }

  stop(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flush();
  }
}
