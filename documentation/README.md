# Drive Thru

Sign in with Google, paste a Google Drive link, and have a conversation with Claude
about the folder's contents. Answers carry inline citations that deep-link back into
Drive.

Built past the v1 core described in `ARCHITECTURE.md` / `IMPLEMENTATION.md`: it
now has a conversation sidebar with persistence, Sheets export, size-gated ingest
with on-demand file loading, measured-budget retrieval for large folders, and a
batch of product features (starter questions, export, file search, sources,
themes, rename/delete). `CLAUDE.md` (repo root) is the up-to-date map; this README
covers setup and the original scope. See [Scope](#scope-what-is-and-isnt-built).

## Stack

- **Client** — React 18 + Vite + TypeScript (component state only)
- **Server** — Node 20 + Express + TypeScript, single long-running process
- **Google** — `googleapis` (Drive read, OAuth with PKCE)
- **Claude** — `@anthropic-ai/sdk` (Messages API, prompt caching)
- **PDF** — `pdf-parse` (buffer-based, page-delimited for citations)

No database, queue, or cache server. Corpora (document text) live in memory and
are never written to disk. Auth and conversation metadata/history are mirrored to
`server/.sessions.json` (both tokens AES-256-GCM encrypted) so sessions and
conversations survive restarts; sessions are swept after 24h idle.

## Repo layout

```
client/   React SPA (login, link input, ingest summary, chat, citations)
server/   Express API (OAuth, Drive traversal + export, context, Claude loop)
```

## Google Cloud setup

1. Create a project at `console.cloud.google.com`.
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **OAuth consent screen** → External → publishing status **Testing**.
4. Add reviewer Google accounts under **Test users** (only listed accounts can sign in
   while in Testing).
5. Add scopes `.../auth/drive.readonly` and `.../auth/userinfo.email`.
6. **Credentials → Create OAuth client ID → Web application.** Authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback`
   - `https://<your-deployment>/auth/google/callback`

> **Seven-day clock (known constraint, not a bug).** In Testing status, Google refresh
> tokens expire after seven days. If you open the app more than a week after it was set
> up, you will be silently logged out — the app detects the resulting `invalid_grant`,
> drops the session, and returns you to the login screen with an explanation. Just sign
> in again.

## Local development

```bash
cp .env.example .env      # fill in the credentials from the setup above
npm install
npm run dev               # server :3000, client :5173 (proxied)
```

Then open `http://localhost:5173`.

`SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` should each be 32 random bytes of hex —
generate with `openssl rand -hex 32`.

## Scripts

| Command | Effect |
|---|---|
| `npm run dev` | Server + client with hot reload |
| `npm run build` | Build client bundle, then compile the server |
| `npm start` | Run the built server (serves the client bundle in production) |
| `npm test` | Run the server and client test suites |

## How it works

1. **Auth** — OAuth 2.0 authorization-code flow with PKCE. The token exchange is
   server-side; the browser only ever holds an opaque `httpOnly` session cookie. Refresh
   tokens are encrypted at rest with AES-256-GCM.
2. **Ingest** — The pasted link resolves to a file ID. A folder is enumerated
   (paginated, shortcut- and cycle-safe); a single file becomes a one-file corpus. Each
   file is exported to text with bounded concurrency and per-file error isolation — one
   unreadable file lands in the skip list rather than aborting the ingest.
3. **Context** — If the whole corpus fits the token budget (Tier 1) every document is
   loaded and numbered `[1]…[n]`. Larger corpora fall back to Tier 2 (deferred; see
   below).
4. **Chat** — Documents, conversation history, and the question go to Claude. Document
   text is wrapped in labelled, untrusted-content boundaries and carries a prompt-cache
   breakpoint. The model cites inline; the client resolves each `[n]` / `[n:p<page>]`
   marker to a Drive deep link.

## Security notes

- The token exchange never reaches the browser — a pure SPA would have to hold Google
  credentials in JavaScript, where any XSS becomes full Drive access.
- Document contents are untrusted input. They are delimited and labelled, and the system
  prompt instructs Claude to analyse them but never follow embedded instructions. The
  tool surface is read-only, so the blast radius of a prompt injection is bounded to a
  *wrong answer*, never an unauthorized action.
- Model output is rendered as text — never `dangerouslySetInnerHTML`.
- `invalid_grant` (revocation or the seven-day Testing expiry) fails closed: the session
  and its corpus are dropped rather than serving stale data.

## Scope: what is and isn't built

**Built (v1 core):** Google OAuth with PKCE, link parsing, folder traversal, export for
Google Docs / PDFs / plain-text files, Tier 1 context assembly, a conversational agent
with inline citations and Drive deep links, refresh handling, prompt-injection
boundaries, and the idle-sweep ephemerality guarantee.

**Deferred** (documented, not shipped — see `IMPLEMENTATION.md` §13 and `EXTENSIONS.md`):
streaming responses, Google Sheets / Slides export, the Tier 2 `read_file` tool loop,
and vector retrieval. Sheets and Slides currently land in the skip list with a clear
reason rather than failing silently.

## Deployment

A single long-running Node service (Render / Railway / Fly.io). One origin serves both
the built client bundle and the API, so there is no CORS to configure and the session
cookie stays first-party. See `DEPLOYMENT.md` for the full walkthrough, including the
two required redirect URIs and the note that free-tier sleep wipes in-memory sessions
(returning users re-authenticate — correct behaviour given the ephemerality design).

- Build: `npm ci && npm run build`
- Start: `node server/dist/index.js`
- Health check: `/healthz`
