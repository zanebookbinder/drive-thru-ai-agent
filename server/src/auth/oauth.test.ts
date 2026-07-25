import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { buildAuthUrl, createPkcePair, newOAuthClient, DRIVE_READONLY, USERINFO_EMAIL } from './oauth';
import { Config } from '../config';

const config = {
  googleClientId: 'client-id',
  googleClientSecret: 'client-secret',
  googleRedirectUri: 'http://localhost:3000/auth/google/callback',
} as Config;

describe('createPkcePair', () => {
  it('derives the challenge as base64url(sha256(verifier)) — S256', () => {
    const { verifier, challenge } = createPkcePair();
    const expected = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('produces a fresh verifier on each call', () => {
    expect(createPkcePair().verifier).not.toBe(createPkcePair().verifier);
  });
});

describe('buildAuthUrl', () => {
  it('requests offline access with the Drive + email scopes and an S256 PKCE challenge', () => {
    const url = new URL(buildAuthUrl(newOAuthClient(config), 'state-123', 'challenge-456'));
    const p = url.searchParams;
    expect(p.get('access_type')).toBe('offline');
    expect(p.get('state')).toBe('state-123');
    expect(p.get('code_challenge')).toBe('challenge-456');
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(p.get('client_id')).toBe('client-id');
    expect(p.get('scope')).toContain(DRIVE_READONLY);
    expect(p.get('scope')).toContain(USERINFO_EMAIL);
  });
});
