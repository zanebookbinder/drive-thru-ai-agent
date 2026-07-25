# Deployment

> **Changes since this spec.** There is now on-disk state:
> `server/.sessions.json` (auth + conversation metadata/history, both tokens
> AES-256-GCM encrypted). §5's note therefore applies today, not just "when
> persistence arrives" — a container's ephemeral filesystem loses this on deploy,
> so mount a volume or move it to a store if you want conversations to survive
> across deploys. Config gained `SESSION_IDLE_MS` (default 24h).
>
> **Now live on Render** via [`render.yaml`](../render.yaml) (Blueprint). Notes
> that differ from §3 below:
> - Build command is **`npm ci --include=dev && npm run build`** — `NODE_ENV=production`
>   makes npm omit devDependencies, but the build needs `tsc`/`vite`/types, so dev
>   deps are force-included. (`react`/`react-dom` are now declared as real
>   `dependencies`, not just transitive peers of the test tooling.)
> - `NODE_ENV=production` is **required** — it's the flag that makes the server
>   serve `client/dist`.
> - The API's `requireSession` guard is scoped to `/api` so `/` and other SPA
>   paths reach `express.static` instead of 401-ing.
> - The OAuth callback handles `?error=…` (e.g. `access_denied`) by redirecting to
>   `/?auth=denied` instead of failing on a missing code.
> - [`.github/workflows/keep-warm.yml`](../.github/workflows/keep-warm.yml) pings
>   `/healthz` every 5 min to avoid free-tier cold starts.

## 1. Recommendation

**Render, Railway, or Fly.io — a single long-running Node service.**

The constraint that decides this: ingestion takes minutes and cannot live
inside an HTTP request, and SSE needs a connection held open. A long-running
process handles both with no additional machinery. Serverless forces a queue
and a worker on day one, which is three mental models where one will do
(`ARCHITECTURE.md` §10).

There is no database in v1, so there is nothing to provision beyond the service
itself. That is the entire deployment.

For a take-home, the boring choice is the right one — and saying so in the
README is itself a signal.

### Shape

```
┌──────────────────────────────────────┐
│  Single Node service                 │
│  • serves built React bundle (static)│
│  • /auth/*  /api/*                   │
│  • in-memory sessions + corpora      │
└──────────────────────────────────────┘
```

One origin for client and API means no CORS configuration and a first-party
session cookie. Worth the trivial cost of having Express serve `client/dist`.

---

## 2. Configuration

```bash
NODE_ENV=production
PORT=3000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://<app>.onrender.com/auth/google/callback

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5

SESSION_SECRET=              # openssl rand -hex 32
TOKEN_ENCRYPTION_KEY=        # openssl rand -hex 32

CLIENT_ORIGIN=https://<app>.onrender.com
MAX_CORPUS_TOKENS=800000
SESSION_IDLE_MS=1800000
```

Every value is a secret except `PORT`, `NODE_ENV`, and the two tuning
constants. None of them appear in the client bundle — Vite inlines anything
prefixed `VITE_`, so keep that prefix off everything here.

### OAuth redirect URIs

Register **both** in the Google Console, exactly:

```
http://localhost:3000/auth/google/callback
https://<app>.onrender.com/auth/google/callback
```

Byte-for-byte, trailing slash included. `redirect_uri_mismatch` is the single
most common deployment failure and it is always this.

If your platform assigns per-deploy preview URLs, either register a stable
custom domain or accept that OAuth works only on the primary URL. Google will
not accept wildcards.

---

## 3. Steps

1. Push to GitHub.
2. Create a Web Service pointed at the repo.
   - Build: `npm ci && npm run build` (builds client and server)
   - Start: `node server/dist/index.js`
   - Health check path: `/healthz`
3. Set environment variables from §2.
4. Deploy, note the assigned URL.
5. Add that URL's callback to the Google Console (§2).
6. Update `GOOGLE_REDIRECT_URI` and `CLIENT_ORIGIN` to match; redeploy.
7. Add reviewer emails under **Test users** in the OAuth consent screen.
8. Walk the smoke test in §7.

Steps 4–6 are circular by nature — the URL is not known until after the first
deploy. Expect two deploys.

### Instance size

Corpus memory is roughly 6MB per active session at the 800k-token cap
(`ARCHITECTURE.md` §7). Twenty concurrent sessions is ~130MB. A 512MB instance
is comfortable; 1GB removes all doubt. Set `MAX_CORPUS_TOKENS` and a max-session
cap so a pathological folder cannot OOM the box.

### Sleep-on-idle

Free tiers on Render and Railway sleep after inactivity. Two consequences:

- Cold start adds ~30s to a reviewer's first request. A brief note in the
  README prevents it reading as a bug.
- **Sleeping wipes in-memory sessions.** Users return to the login screen. This
  is correct behavior given §8.2 of the architecture doc — but it means a
  reviewer who leaves the tab open over lunch will re-authenticate. Call it out
  as intentional rather than letting it look accidental.

A paid instance avoids both and is worth the few dollars for a submission that
will be evaluated asynchronously.

---

## 4. Alternatives

**Vercel + Inngest (or a separate worker).** Fastest path to a polished
deployment if the project is Next.js. The auth callback and SSE both work.
The catch is function duration limits: ingestion must be offloaded to a
queue-backed worker rather than run inline, and in-memory session state stops
working across invocations — you need Redis or a database from the start. More
moving parts than v1 justifies, but a reasonable choice if the deliverable is
Next.js anyway.

**Google Cloud Run + Cloud SQL.** Has a real narrative advantage: you are
already in Google's ecosystem for OAuth and Drive, so the consent screen, API
quotas, and service credentials live in one console. Cloud Run tolerates long
requests and scales to zero. Slightly more setup than Render for no benefit at
this scale, but the most defensible answer if asked "what if this were a Google
Workspace add-on."

**AWS (App Runner or ECS Fargate + RDS + SQS).** What you would choose if this
were a real product at scale, and the wrong amount of work for a take-home.
Mention it in the README as the production path rather than building it.

**Supabase as all-in-one.** Tempting — Postgres with pgvector, auth, storage,
edge functions in one dashboard. But its auth wants to own the Google OAuth
flow while we need the provider refresh token for Drive calls. Extractable, but
the indirection buys nothing in v1. It becomes attractive at the point where
retrieval arrives (`EXTENSIONS.md` §1), since pgvector is already there.

---

## 5. What changes when persistence arrives

The SQLite step in `EXTENSIONS.md` §4 has a deployment consequence worth
flagging now: most container platforms have ephemeral filesystems, so a SQLite
file is lost on every deploy — which defeats the point of adding it.

Options, in order of effort: a mounted persistent volume (Render Disks, Fly
Volumes, Railway Volumes); Turso or libSQL as a hosted SQLite; or skipping
straight to managed Postgres. The last is often less work than making SQLite
durable in a container.

Regardless of choice, the §8.1 boundary holds: tokens and metadata persist,
document text never does.

---

## 6. Observability

Minimal but sufficient:

- `/healthz` returning 200 with uptime and active session count
- Structured logs at ingest start/end: file count, bytes, duration, skip count
- Per-request Anthropic token usage, including
  `cache_creation_input_tokens` and `cache_read_input_tokens`

That last one is the important one. If cache reads are always zero, the prefix
is being invalidated somewhere and costs are several times what the model in
`ARCHITECTURE.md` §5.2 predicts.

**What must never be logged:** document text, user questions, model output,
access or refresh tokens. Log identifiers and counts (`IMPLEMENTATION.md` §7).
If you wire up error tracking, scrub exception context — local variables at a
parse failure contain the document that failed.

---

## 7. Pre-submission checklist

Deployment-specific. Functional testing belongs in the smoke test below.

- [ ] Both redirect URIs registered, byte-for-byte
- [ ] Reviewer emails added as OAuth test users
- [ ] No secret reachable from the client bundle — grep `client/dist` for your
      client secret and API key
- [ ] Cookies `Secure` and `httpOnly` in production
- [ ] HTTPS enforced; HTTP redirects
- [ ] `MAX_CORPUS_TOKENS` and max-session caps set
- [ ] `/healthz` responding
- [ ] Instance is paid, or cold-start and session-loss behavior noted in README
- [ ] README states the seven-day Testing-mode refresh token expiry
      (`IMPLEMENTATION.md` §3) — otherwise a late reviewer sees a broken app

### Smoke test on the deployed URL

Run it in a private window, signed out of Google:

1. Sign in with Google, consent, land back in the app authenticated
2. Paste a folder link containing at least one Doc, one Sheet with multiple
   tabs, one PDF, and one unsupported file
3. Watch ingest progress; confirm the unsupported file appears in the skip list
4. Ask a question spanning two documents
5. Click a citation — confirm it opens the right file at the right page
6. Ask "what's in this folder" — confirm it enumerates rather than guessing
7. Log out, confirm returning requires re-auth

Step 5 is the one a reviewer will remember.
