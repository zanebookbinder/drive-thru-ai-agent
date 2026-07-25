# CLAUDE.md

Repo overview for anyone (human or agent) picking this up. Design rationale and
the original take-home brief live in [`documentation/`](./documentation); this
file is the practical map of what exists and how it fits together.

## What this is

A web app to chat with the contents of a Google Drive folder. You sign in with
Google, paste a Drive link, and ask questions about the documents in it. Answers
carry inline `[n]` citations that deep-link back into Drive (page-anchored for
PDFs). Conversations persist across restarts; the folder's document text does not
(it is re-read from Drive on demand).

## Stack

- **Client** — React 18 + Vite + TypeScript, component state only (no state lib).
- **Server** — Node 20 + Express + TypeScript, one long-running process.
- **Google** — `googleapis` (Drive read + Sheets API), OAuth 2.0 with PKCE.
- **Claude** — `@anthropic-ai/sdk` (Messages API, `count_tokens`, prompt caching).
- **PDF** — `pdf-parse` (per-page text for citation anchors).

An npm workspace: `client/` and `server/`. No database — sessions and corpora are
in-memory, with auth + conversation metadata mirrored to a JSON file on disk.

## Run it

```bash
cp .env.example .env   # fill in the keys — see README.md
npm install
npm run dev            # server :3000, client :5173 (proxied)
```

Open `http://localhost:5173`. Requires a Google Cloud OAuth client (Drive API +
Sheets API enabled, redirect URI `http://localhost:3000/auth/google/callback`,
your email added as a Test user) and an Anthropic API key. Full setup:
[`README.md`](./README.md).

`npm test` runs both suites (~95 tests). `npm run build` compiles client + server.
Tests cover pure logic (scope/tri-state, context assembly, citations, prompt/anthropic,
crypto, persistence/sessions, parsing, cost, retry), route + auth integration
(`supertest`: the `/api` guard, select-files, OAuth callback/redirects), Drive
traversal (fake client), and the file-select UI. Remaining gaps: Drive export, a
full `/api/chat` integration, and most other client components (see README → Testing).

## Repo layout

```
client/src/
  App.tsx              session/conversation state machine
  api.ts               fetch helpers
  components/
    LoginScreen, LinkInput, Sidebar, IngestSummary (read-only folder view),
    FileSelectModal (choose which files the chat reads), FileTypeIcon,
    Logo (theme-aware wordmark), ChatView, Answer (safe markdown + citation links)
server/src/
  index.ts             express app, session store wiring, temp cleanup
  auth/                PKCE OAuth, AES-256-GCM crypto, session middleware
  drive/               parseLink, traverse, export (Docs/Sheets/PDF/text),
                       sheets, ingest (size gate), describe (file metadata)
  context/             token estimate, deep-link anchors, budget selection
  chat/                prompt (system + manifest + injection boundaries),
                       anthropic (count_tokens trim + call), citations
  store/               in-memory sessions + file persistence
  api/routes.ts        /api/* — conversations, chat, file loading
documentation/         the original spec (ARCHITECTURE/IMPLEMENTATION/
                       EXTENSIONS/DEPLOYMENT) + README + this repo's setup
```

## How a request flows

1. **Auth** — `/auth/google` → PKCE redirect → `/auth/google/callback` exchanges
   the code server-side, encrypts the refresh token, sets an `httpOnly` `sid`
   cookie. Tokens never reach the browser. Returning users re-attach to their
   existing session by email (soft logout keeps the session).
2. **Ingest** — `POST /api/ingest` resolves the link, traverses the folder, and
   eagerly parses only supported files **under 20 KB, up to 100 of them**. Larger
   or over-cap files are left *unloaded* (loadable on demand). A conversation is
   created and persisted.
3. **Chat** — `POST /api/chat` builds a prompt of the **full file manifest** plus
   as many document bodies as fit the context window. The fit is *measured* with
   `count_tokens` and trimmed (a char estimate undercounts dense content). Claude
   answers with `[n]` markers; the server resolves them to Drive deep links.
4. **File scoping** — `selectedFileIds` is tri-state: absent = all loaded files,
   `[]` = none, `[ids]` = those. Set via `POST /api/conversations/select-files`
   from the FileSelectModal. Before answering, the chat handler force-loads any
   selected-but-unloaded file so scoping can never silently send zero documents.
5. **On-demand load** — `POST /api/conversations/load-file` parses one gated file
   and remembers it (in `manuallyLoaded`) so it survives a re-ingest.

## Deployment

Single Node service, one origin serves API + client bundle. `render.yaml` is a
Render Blueprint (`NODE_ENV=production` serves the bundle; `npm ci --include=dev`
in the build installs the build-only devDeps). `.github/workflows/keep-warm.yml`
pings `/healthz` every 5 min to dodge free-tier cold starts. The API's
`requireSession` guard is scoped to `/api` so non-API paths fall through to the
static SPA; the OAuth callback redirects to `/?auth=denied` on `error=...`.

## Key design decisions (and where they're documented)

- **No vector DB / RAG in v1.** Stuff the context, because the questions are
  mostly aggregate. See `documentation/ARCHITECTURE.md` §5. For large folders this
  is bounded by the manifest + measured token budget above; the deferred proper
  fix is an agentic `read_file` tool (`documentation/EXTENSIONS.md` §2).
- **Ephemerality boundary.** Document *text* is never written to disk — only auth
  and conversation metadata/history. This is a deliberate relaxation of the
  original "history is never stored" stance to support conversation resume; see
  the changes notes in `documentation/ARCHITECTURE.md`.
- **Prompt injection.** Document text is untrusted: delimited, labelled, and the
  tool surface is read-only, so the blast radius is bounded to *wrong answers*.
- **Both tokens encrypted at rest** (AES-256-GCM); `sid` cookie is `httpOnly`.

## Conventions

- TypeScript throughout; server is CommonJS (bundler module resolution), client is
  ESM. Server dev uses `node --watch-path=./src` (not `tsx watch`, which watched
  the hoisted `node_modules`).
- Tests are Vitest, colocated as `*.test.ts(x)`.
- Logs carry identifiers and counts only — never document text, questions, or
  tokens (`server/src/util/log.ts`).
- Secrets live in `.env` (gitignored). Session state is `server/.sessions.json`
  (gitignored, `0600`).
