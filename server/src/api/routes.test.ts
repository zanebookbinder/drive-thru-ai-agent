import { beforeEach, describe, expect, it } from 'vitest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createApiRouter } from './routes';
import { SessionStore } from '../store/sessions';
import { Config } from '../config';
import { Session, StoredConversation } from '../types';

const config = {
  port: 3000,
  isProd: false,
  clientOrigin: 'http://localhost:5173',
  googleClientId: 'x',
  googleClientSecret: 'x',
  googleRedirectUri: 'x',
  anthropicApiKey: 'x',
  anthropicModel: 'claude-sonnet-5',
  sessionSecret: 'x',
  tokenEncryptionKey: '00'.repeat(32),
  maxCorpusTokens: 800_000,
  sessionIdleMs: 1_000_000,
} as Config;

function makeApp(store: SessionStore): Express {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(createApiRouter(config, store));
  app.get('/', (_req, res) => res.send('SPA')); // stand-in for the static bundle
  return app;
}

function seedSession(store: SessionStore, id = 'sid1'): Session {
  const s: Session = {
    id,
    userEmail: 'z@example.com',
    encryptedRefreshToken: '',
    accessToken: '',
    accessTokenExpiry: 0,
    lastActivity: Date.now(),
    conversations: [],
    corpora: new Map(),
  };
  store.set(s);
  return s;
}

describe('API session guard (regression: root path must reach the SPA, not 401)', () => {
  let store: SessionStore;
  beforeEach(() => {
    store = new SessionStore(1_000_000);
  });

  it('401s an /api request with no session cookie', async () => {
    const res = await request(makeApp(store)).get('/api/conversations');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('lets a non-/api path fall through the guard to the SPA', async () => {
    const res = await request(makeApp(store)).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe('SPA');
  });

  it('allows an /api request with a valid session', async () => {
    seedSession(store);
    const res = await request(makeApp(store))
      .get('/api/conversations')
      .set('Cookie', 'sid=sid1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('conversations');
  });
});

describe('POST /api/conversations/select-files (tri-state persistence)', () => {
  let app: Express;

  beforeEach(() => {
    const store = new SessionStore(1_000_000);
    const session = seedSession(store);
    session.activeConversationId = 'conv1';
    session.conversations.push({
      id: 'conv1',
      title: 't',
      sourceUrl: '',
      rootId: 'r',
      tier: 1,
      createdAt: 0,
      files: [],
      skipped: [],
      messages: [],
      manuallyLoaded: [],
    } as StoredConversation);
    app = makeApp(store);
  });

  const post = (body: unknown) =>
    request(app).post('/api/conversations/select-files').set('Cookie', 'sid=sid1').send(body);

  it('stores an explicit subset', async () => {
    const res = await post({ fileIds: ['a', 'b'] });
    expect(res.status).toBe(200);
    expect(res.body.conversation.selectedFileIds).toEqual(['a', 'b']);
  });

  it('stores an empty array as "no files"', async () => {
    const res = await post({ fileIds: [] });
    expect(res.body.conversation.selectedFileIds).toEqual([]);
  });

  it('clears the scope back to "all files" when fileIds is null', async () => {
    await post({ fileIds: ['a'] });
    const res = await post({ fileIds: null });
    expect(res.body.conversation.selectedFileIds).toBeUndefined();
  });
});
