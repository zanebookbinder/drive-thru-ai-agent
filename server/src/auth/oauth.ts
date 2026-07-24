import crypto from 'crypto';
import { google, Auth } from 'googleapis';
import { Config } from '../config';

// Use googleapis' bundled OAuth2 so its type matches drive/sheets `auth` params.
export type OAuth2Client = Auth.OAuth2Client;
export type Credentials = Auth.Credentials;

export const DRIVE_READONLY = 'https://www.googleapis.com/auth/drive.readonly';
export const USERINFO_EMAIL = 'https://www.googleapis.com/auth/userinfo.email';

export class ReauthRequired extends Error {
  readonly code = 'REAUTH_REQUIRED';
}

export function newOAuthClient(config: Config): OAuth2Client {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri,
  );
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthUrl(client: OAuth2Client, state: string, challenge: string): string {
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [DRIVE_READONLY, USERINFO_EMAIL],
    state,
    code_challenge: challenge,
    // The SDK types only accept 'plain' here, but S256 is what Google expects.
    code_challenge_method: 'S256' as never,
  });
}

export async function exchangeCode(
  client: OAuth2Client,
  code: string,
  verifier: string,
): Promise<Credentials> {
  const { tokens } = await client.getToken({ code, codeVerifier: verifier });
  return tokens;
}

export async function fetchEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo request failed: ${res.status}`);
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error('userinfo response missing email');
  return data.email;
}
