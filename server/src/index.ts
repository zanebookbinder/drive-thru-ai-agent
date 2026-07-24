import path from 'path';
import fs from 'fs/promises';
import express, { ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { getConfig } from './config';
import { SessionStore } from './store/sessions';
import { FilePersistence, TokenCipher } from './store/persistence';
import { decrypt, encrypt } from './auth/crypto';
import { createAuthRouter } from './auth/routes';
import { createApiRouter } from './api/routes';
import { log } from './util/log';

const TMP_ROOT = path.join(process.cwd(), '.tmp');
// Beside the server package, so the path is stable in dev (cwd=server) and prod.
const SESSIONS_FILE = path.resolve(__dirname, '../.sessions.json');

async function main() {
  const config = getConfig();

  // Clear the temp root at startup — a crashed process can leave document text behind.
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
  await fs.mkdir(TMP_ROOT, { recursive: true });

  const cipher: TokenCipher = {
    seal: (v) => encrypt(v, config.tokenEncryptionKey),
    open: (v) => decrypt(v, config.tokenEncryptionKey),
  };
  const store = new SessionStore(config.sessionIdleMs, new FilePersistence(SESSIONS_FILE), cipher);
  store.startSweeping();
  store.startFlushing();

  // Flush auth to disk on shutdown so a restart (deploy, or dev file-watch) does
  // not log everyone out.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      store.stop();
      process.exit(0);
    });
  }

  const app = express();
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), sessions: store.size });
  });

  app.use(createAuthRouter(config, store));
  app.use(createApiRouter(config, store));

  // Serve the built client bundle in production (single-origin deploy).
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (config.isProd) {
    app.use(express.static(clientDist));
    app.get('/*splat', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    log.error('unhandled error', { message: err instanceof Error ? err.message : 'unknown' });
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  };
  app.use(errorHandler);

  app.listen(config.port, () => log.info('server listening', { port: config.port }));
}

main().catch((err) => {
  log.error('failed to start', { message: err instanceof Error ? err.message : 'unknown' });
  process.exit(1);
});
