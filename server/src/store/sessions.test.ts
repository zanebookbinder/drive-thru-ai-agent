import { describe, expect, it } from 'vitest';
import { SessionStore } from './sessions';
import { Session } from '../types';

function session(id: string, lastActivity: number): Session {
  return {
    id,
    userEmail: 'a@b.com',
    encryptedRefreshToken: '',
    accessToken: '',
    accessTokenExpiry: 0,
    lastActivity,
    conversations: [],
    corpora: new Map(),
  };
}

describe('SessionStore', () => {
  it('sweeps sessions idle past the cutoff', () => {
    const store = new SessionStore(1000);
    const now = 100_000;
    store.set(session('fresh', now - 500));
    store.set(session('stale', now - 2000));
    const removed = store.sweep(now);
    expect(removed).toBe(1);
    expect(store.get('fresh')).toBeDefined();
    expect(store.get('stale')).toBeUndefined();
  });

  it('touch resets the idle clock', () => {
    const store = new SessionStore(1000);
    const now = 100_000;
    store.set(session('s', now - 2000));
    store.touch('s');
    expect(store.sweep(now)).toBe(0);
  });

  it('finds an existing session by email so a returning user re-attaches', () => {
    const store = new SessionStore(1_000_000);
    const s = session('s1', Date.now());
    s.userEmail = 'zane@example.com';
    store.set(s);
    expect(store.findByEmail('zane@example.com')?.id).toBe('s1');
    expect(store.findByEmail('nobody@example.com')).toBeUndefined();
  });
});
