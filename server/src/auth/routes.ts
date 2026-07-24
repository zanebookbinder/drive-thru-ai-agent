import crypto from 'crypto';
import { Router } from 'express';
import { Config } from '../config';
import { SessionStore } from '../store/sessions';
import { log } from '../util/log';
import { encrypt, sign, verify } from './crypto';
import { requireSession } from './middleware';
import { buildAuthUrl, createPkcePair, exchangeCode, fetchEmail, newOAuthClient } from './oauth';

interface OAuthTx {
  verifier: string;
  state: string;
}

export function createAuthRouter(config: Config, store: SessionStore): Router {
  const router = Router();

  router.get('/auth/google', (_req, res) => {
    const client = newOAuthClient(config);
    const { verifier, challenge } = createPkcePair();
    const state = crypto.randomUUID();

    res.cookie('oauth_tx', sign({ verifier, state }, config.sessionSecret), {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax',
      maxAge: 600_000,
    });
    res.redirect(buildAuthUrl(client, state, challenge));
  });

  router.get('/auth/google/callback', async (req, res, next) => {
    try {
      const tx = verify<OAuthTx>(req.cookies?.oauth_tx, config.sessionSecret);
      if (!tx || tx.state !== req.query.state) {
        res.status(400).send('Invalid OAuth state. Please try signing in again.');
        return;
      }

      const tokens = await exchangeCode(newOAuthClient(config), String(req.query.code), tx.verifier);
      if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
        res.status(400).send('Google did not return the expected tokens. Please try again.');
        return;
      }

      const userEmail = await fetchEmail(tokens.access_token);
      const encryptedRefreshToken = encrypt(tokens.refresh_token, config.tokenEncryptionKey);

      // Re-attach to an existing session for this user (e.g. after a soft logout)
      // so their conversations come back; otherwise start a fresh one.
      const existing = store.findByEmail(userEmail);
      let sessionId: string;
      if (existing) {
        sessionId = existing.id;
        existing.encryptedRefreshToken = encryptedRefreshToken;
        existing.accessToken = tokens.access_token;
        existing.accessTokenExpiry = tokens.expiry_date;
        existing.lastActivity = Date.now();
        store.flush();
        log.info('session resumed', { sessionId });
      } else {
        sessionId = crypto.randomUUID();
        store.set({
          id: sessionId,
          userEmail,
          encryptedRefreshToken,
          accessToken: tokens.access_token,
          accessTokenExpiry: tokens.expiry_date,
          lastActivity: Date.now(),
          conversations: [],
          corpora: new Map(),
        });
        log.info('session created', { sessionId });
      }

      res.clearCookie('oauth_tx');
      res.cookie('sid', sessionId, { httpOnly: true, secure: config.isProd, sameSite: 'lax' });
      res.redirect(config.clientOrigin);
    } catch (err) {
      next(err);
    }
  });

  router.get('/api/me', requireSession(store), (_req, res) => {
    res.json({ email: res.locals.session!.userEmail });
  });

  // Soft logout: forget the cookie but keep the session so signing back in with
  // the same Google account restores the conversations. The session is still
  // swept on idle. (A hard "delete my data" action would call store.delete.)
  router.post('/auth/logout', (_req, res) => {
    res.clearCookie('sid');
    res.json({ ok: true });
  });

  return router;
}
