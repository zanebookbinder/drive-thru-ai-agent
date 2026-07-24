# Extensions

Deliberately deferred from v1. Ordered by what would be built first if this
became a real product, not by difficulty.

> **Already shipped** (was deferred, now built — see `CLAUDE.md`): file-backed
> persistence of auth + conversation history (document text stays ephemeral);
> Sheets export; the size-gated ingest with per-file load-on-demand; a manifest +
> `count_tokens`-measured budget for large folders; per-conversation file
> selection to scope the chat; a **per-user $5 spend cap** with running-spend
> display; and a batch of product features — conversation sidebar/resume,
> reload/copy-link, export to Markdown, folder summary, generated starter
> questions, file search, per-answer sources, theme toggle, rename/delete/pin.
>
> **Near-term production blockers** (the two things between "demo" and "public"):
> publishing past Google's Testing status (§1.5) and making the persisted session
> file durable in production (§4). Highest-value quality work remains the agentic
> `read_file` retrieval loop (§2.1) and the eval harness (§5.1).

Listing known limitations accurately is a stronger signal than a longer feature
list. Everything here was considered and cut for a stated reason.

---

## 1. Security

### 1.1 Per-file access control — *first priority for multi-user*

v1 inherits whatever the authenticated user can see. That is correct for a
single-user app and **unsafe the moment a corpus is shared or cached across
users** (`ARCHITECTURE.md` §9.3).

Needed for multi-tenancy: corpora keyed by `(userId, folderId)` and never
shared; ACL re-verification on cache hit, since Drive permissions change after
ingest; and a decision about domain-shared files, where "the user could see it
at ingest time" and "the user can see it now" diverge.

Do not defer this past the first multi-user deployment. A cached corpus served
to a user who lost access is a data leak with an audit trail pointing at you.

### 1.2 Prompt injection hardening

v1 mitigates but does not solve (`ARCHITECTURE.md` §9.1). Beyond the current
delimiting and read-only tool surface:

- A classifier pass over ingested text flagging imperative language directed at
  an assistant, surfaced to the user as "this document contains text that looks
  like an instruction"
- Structured output for citations so injected content cannot forge a citation
  to a document it did not come from
- Adversarial test corpus in CI — a folder of documents containing known
  injection patterns, with assertions that answers stay grounded
- Per-document provenance in the answer, so a user can see which file steered a
  suspicious response

The bound worth preserving: injection causes **wrong answers**, never
**unauthorized actions**. That holds only while every tool is read-only. Any
tool that writes, sends, or calls out invalidates the threat model and requires
re-deriving §9.1 from scratch.

### 1.3 Token and credential handling

- Rotate `TOKEN_ENCRYPTION_KEY` with envelope encryption rather than a single
  static key (both tokens are already AES-256-GCM encrypted at rest, but under
  one static key)
- Move refresh tokens to a KMS or secret manager rather than app-managed
  encryption
- Explicit revocation endpoint calling Google's token revocation, so "sign out"
  means something on Google's side too (logout is currently soft — it clears the
  cookie but keeps the session for resume)

### 1.4 Standard hardening

Per-session **request** rate limiting on ingest and chat (a per-user *cost* cap
of $5 exists, but not a requests-per-minute limit); CSRF tokens on state-changing
routes beyond the OAuth `state`; a strict CSP; dependency scanning; audit logging
of which user ingested which folder and when (metadata only — never content).

### 1.5 Publish past Testing → public launch — *production blocker*

The OAuth consent screen is in **Testing** status. Consequences: only listed
test users can sign in, and refresh tokens expire after seven days
(`ARCHITECTURE.md` §3.3). To let anyone sign in, the app must move to Production,
and because `drive.readonly` is a **restricted scope** that requires a
third-party security assessment (CASA) — weeks of work and cost
(`ARCHITECTURE.md` §3.2).

The cheaper route to a public launch is to add the **Google Picker + `drive.file`
scope** path (see §6) alongside the paste-link flow: the user picks specific
files via Google's UI, which is a non-sensitive scope needing no assessment.
Offer both — pasted links under the restricted scope for verified/internal users,
the Picker for everyone else.

---

## 2. Scale and retrieval

### 2.1 Agentic `read_file` loop, then hybrid retrieval

Today a large folder is handled by sending the file manifest plus as many
document bodies as fit a measured token budget (`ARCHITECTURE.md` §5.3). The
next step is the agentic **`read_file(fileId)` tool** so the model pulls only the
files a question needs, instead of a budget-fitted prefix — cheaper and more
relevant. Beyond that, for folders too large for even manifest-plus-`read_file`:

- Chunk **structure-aware**, not fixed-width — headings for Docs, per-slide,
  per-sheet row blocks, per-page for PDFs
- Embeddings in pgvector **plus** BM25/`tsvector` keyword search, fused with
  reciprocal rank fusion. Hybrid matters disproportionately here because Drive
  folders are full of proper nouns, project codenames, and ticket IDs that
  embeddings handle badly
- A reranker over the fused candidates
- Retain `list_files` and `read_file` alongside `search` — retrieval
  supplements the agent loop rather than replacing it, or aggregate questions
  regress (`ARCHITECTURE.md` §5.1)

Build the eval harness (§5.1 below) **before** the retrieval rework, not after.
Otherwise there is no way to know whether it improved anything.

### 2.2 Ingestion at scale

Durable queue (BullMQ, Inngest, Cloud Tasks) so ingestion survives restarts;
resumable jobs with per-file checkpointing; parallel workers with a shared rate
limiter respecting Drive per-user quotas; and incremental sync via the Drive
`changes` API with `startPageToken`, so re-opening a folder re-exports only what
changed.

### 2.3 Caching across sessions

Content-hash exported text so the same file ingested twice is exported once.
Gated on §1.1 — a shared cache without ACL re-verification is exactly the leak
described there.

---

## 3. Coverage

- **Google Slides.** Currently deferred — decks land in the skip list. Export via
  `files.export` to text, one block per slide.
- **OCR** for scanned PDFs. Currently they extract as empty. Tesseract, or a
  vision model per page.
- **Images** via a vision model, either described at ingest or read on demand
  through a `describe_image` tool.
- **Office `.xlsx` / `.pptx`** uploaded files (as opposed to native Google
  Sheets/Slides), via a parser library.
- **Audio and video** via transcription — Drive folders contain a lot of
  meeting recordings.
- **Nested archives** (.zip) — currently skipped, occasionally where the
  interesting content is.
- **Large Docs** exceeding Drive's ~10MB export cap, which need a chunked
  export path.
- **Password-protected PDFs** — detect and report clearly rather than failing
  with a parse error.

---

## 4. Durable persistence in production — *production blocker*

Session auth and conversation metadata/history **already persist** to
`server/.sessions.json` (both tokens AES-256-GCM encrypted; document text is
never written). The `ARCHITECTURE.md` §8.1 boundary holds: tokens, identity, and
conversation metadata persist; exported document text does not.

What remains is making that durable in production. Container filesystems are
**ephemeral** (`DEPLOYMENT.md` §5), so the JSON file is lost on every deploy —
which resets everyone's conversations and logins. Options, in order of effort: a
mounted volume (Render Disks, Fly Volumes); a hosted SQLite (Turso/libSQL); or
managed Postgres (often less work than making a file durable in a container).

If document persistence is ever genuinely wanted — for offline conversation
resume without a re-ingest — it needs its own decision with an explicit
user-facing retention setting, a delete path, and a revised §8 in the
architecture doc. It should not arrive as a side effect of adding a database.

---

## 5. Quality

### 5.1 Eval harness — *highest-value quality item*

A golden set of question/answer pairs over a fixed corpus, measuring:

- **Answer accuracy** — graded against reference answers
- **Citation precision** — does the cited document actually support the claim
- **Citation recall** — are claims that need citations carrying them
- **Refusal correctness** — does it say "not in these documents" when true

This is what turns every other item on this list from an opinion into a
measurement. It is also the prerequisite for §2.1: without it, "we added
retrieval" is a claim with no evidence attached.

### 5.2 Grounding verification

Post-generation, verify each cited span actually appears in the claimed source.
Flag or strip citations that fail. Cheap to build and it catches the failure
mode users find most damaging — a plausible answer attached to a real-looking
citation that does not support it.

### 5.3 Native citations

Anthropic's citations feature is more precise than manual `[n]` markers.
Deferred because it constrains document passing in ways that complicate the
caching strategy (`ARCHITECTURE.md` §6.2). Worth revisiting once the eval harness
can measure whether it actually improves citation precision.

---

## 6. Product

- **Google Picker** alongside pasted links, enabling a `drive.file` path for
  users who cannot or will not grant `drive.readonly` — and the route to public
  launch without the restricted-scope assessment (see §1.5)
- **Multiple folders** in one conversation
- **Pre-ingest cost estimate** — the per-user $5 cap and running-spend display
  exist; still missing is an *estimate shown before* ingesting a large folder, so
  a 500-file spend is visible up front
- **Answer confidence** signals when a question is only weakly supported

---

## 7. Operations

Per-corpus cost attribution (per-*user* spend is now tracked for the $5 cap, but
not persisted or attributed per corpus); alerting on ingest failure rate, p95
latency, and cache hit ratio (a collapsed hit ratio means costs several times the
model in `ARCHITECTURE.md` §5.2); graceful degradation to a smaller model under
load; and a data processing agreement plus ZDR arrangement before any
customer-facing deployment (`ARCHITECTURE.md` §8.4).

---

## 8. Explicitly not planned

Worth stating, because absence otherwise reads as oversight.

**Write access to Drive.** Read-only is a security property, not a missing
feature — it is what bounds prompt injection to wrong answers rather than
unauthorized actions (§1.2).

**Local or self-hosted models.** Document content going to a third party is
disclosed and addressed via ZDR (`ARCHITECTURE.md` §8.4). Self-hosting trades a
large capability gap for a privacy improvement most users do not need.

**Cross-user knowledge sharing.** "Answers from your team's folders" is a
different product with a fundamentally different access control model. Not an
extension of this one.
