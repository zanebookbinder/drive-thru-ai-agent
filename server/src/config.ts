import path from 'path';
import { config as loadEnv } from 'dotenv';

// The .env lives at the repo root; resolve it from this file so the server finds
// it whether launched from server/ (dev) or the repo root (prod).
loadEnv({ path: path.resolve(__dirname, '../../.env') });

export interface Config {
  port: number;
  isProd: boolean;
  clientOrigin: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  anthropicApiKey: string;
  anthropicModel: string;
  sessionSecret: string;
  tokenEncryptionKey: string;
  maxCorpusTokens: number;
  sessionIdleMs: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

let cached: Config | undefined;

export function getConfig(): Config {
  if (!cached) {
    cached = {
      port: Number(process.env.PORT ?? 3000),
      isProd: process.env.NODE_ENV === 'production',
      clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
      googleClientId: required('GOOGLE_CLIENT_ID'),
      googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
      googleRedirectUri: required('GOOGLE_REDIRECT_URI'),
      anthropicApiKey: required('ANTHROPIC_API_KEY'),
      anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
      sessionSecret: required('SESSION_SECRET'),
      tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY'),
      maxCorpusTokens: Number(process.env.MAX_CORPUS_TOKENS ?? 800_000),
      sessionIdleMs: Number(process.env.SESSION_IDLE_MS ?? 86_400_000),
    };
  }
  return cached;
}
