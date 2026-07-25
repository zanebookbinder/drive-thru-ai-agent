import { describe, expect, it } from 'vitest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createAuthRouter } from './routes';
import { SessionStore } from '../store/sessions';
import { Config } from '../config';

const config = {
  isProd: false,
  clientOrigin: 'http://localhost:5173',
  googleClientId: 'client-id',
  googleClientSecret: 'client-secret',
  googleRedirectUri: 'http://localhost:3000/auth/google/callback',
  sessionSecret: 'session-secret',
} as Config;

function makeApp(): Express {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(createAuthRouter(config, new SessionStore(1_000_000)));
  return app;
}

describe('GET /auth/google/callback (regression: access_denied must return to login)', () => {
  it('redirects a denied consent to the login screen instead of erroring on a missing code', async () => {
    const res = await request(makeApp()).get(
      '/auth/google/callback?error=access_denied&state=abc',
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/?auth=denied');
  });
});

describe('GET /auth/google', () => {
  it('redirects to Google and sets the PKCE transaction cookie', async () => {
    const res = await request(makeApp()).get('/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
    expect(String(res.headers['set-cookie'])).toContain('oauth_tx');
  });
});

describe('POST /auth/logout', () => {
  it('clears the session cookie', async () => {
    const res = await request(makeApp()).post('/auth/logout');
    expect(res.status).toBe(200);
    expect(String(res.headers['set-cookie'])).toContain('sid=;');
  });
});
