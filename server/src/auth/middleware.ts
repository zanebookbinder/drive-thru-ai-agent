import { RequestHandler } from 'express';
import { SessionStore } from '../store/sessions';
import { Session } from '../types';

declare module 'express-serve-static-core' {
  interface Locals {
    session?: Session;
  }
}

export function requireSession(store: SessionStore): RequestHandler {
  return (req, res, next) => {
    const sid = req.cookies?.sid as string | undefined;
    const session = sid ? store.get(sid) : undefined;
    if (!session) {
      res.status(401).json({ code: 'UNAUTHENTICATED', error: 'Please sign in with Google.' });
      return;
    }
    store.touch(session.id);
    res.locals.session = session;
    next();
  };
}
