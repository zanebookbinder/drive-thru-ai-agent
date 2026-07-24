# Extensions

Deliberately deferred from v1. Ordered by what would be built first if this
became a real product, not by difficulty.

> **Some of these have since shipped.** Persistence (§4) is built — a JSON-backed
> session store holding auth + conversation history, with document text kept
> ephemeral. Sheets export and larger-folder handling (a manifest + measured
> token budget, plus a per-file load-on-demand gate) are in. Several **Product**
> items (§6) now exist: conversation resume via the sidebar, reload/copy-link,
> and a batch of client features (starter questions, export to markdown, file
> search, per-answer sources, theme toggle, rename/delete conversations). Still
> open and highest-value: the agentic `read_file` retrieval loop (§2.1) and the
> eval harness (§5.1).

Listing known limitations accurately is a stronger signal than a longer feature
list. Everything here was considered and cut for a stated reason.

---

## 1. Security

### 1.1 Per-file access control — *first priority*

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
delimiting, read-only tool surface, and manifest-scoped `read_file`:

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
  static key
- Move refresh tokens to a KMS or secret manager rather than app-managed
  encryption
- Explicit revocation endpoint calling Google's token revocation, so "sign out"
  means something on Google's side too
- Publish the app past Testing status, which requires the restricted-scope
  security assessment (`ARCHITECTURE.md` §3.2) and removes the seven-day
  refresh token expiry

### 1.4 Standard hardening

Rate limiting per session on ingest and chat; CSRF tokens on state-changing
routes beyond the OAuth `state`; a strict CSP; dependency scanning; audit
logging of which user ingested which folder and when (metadata only — never
content).

---

## 2. Scale and retrieval

### 2.1 Hybrid retrieval — Tier 3

`ARCHITECTURE.md` §5.3 defines the threshold: folders too large for even the
manifest-plus-`read_file` approach. At that point:

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

Build the eval harness (§5.1 below) **before** this, not after. Otherwise there
is no way to know whether retrieval improved anything.

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

- **OCR** for scanned PDFs. Currently they extract as empty and land in the
  skip list. Tesseract, or a vision model per page.
- **Images** via a vision model, either described at ingest or read on demand
  through a `describe_image` tool.
- **Audio and video** via transcription — Drive folders contain a lot of
  meeting recordings.
- **Nested archives** (.zip) — currently skipped, occasionally where the
  interesting content is.
- **Large Docs** exceeding Drive's ~10MB export cap, which need a chunked
  export path.
- **Password-protected PDFs** — detect and report clearly rather than failing
  with a parse error.

---

## 4. Persistence

**SQLite for sessions**, roughly thirty lines, surviving restarts so users are
not logged out by every deploy.

The boundary from `ARCHITECTURE.md` §8.1 holds without exception: tokens,
session identity, and corpus *metadata* persist. **Exported document text never
does.** Re-authenticating after a restart is fine. Re-ingesting is fine.
Recovering documents is not a feature.

Note the deployment consequence in `DEPLOYMENT.md` §5 — container filesystems
are ephemeral, so SQLite needs a mounted volume or a hosted equivalent, and
managed Postgres is often less work than making SQLite durable.

If document persistence is ever genuinely wanted — for conversation resume —
it needs its own decision with encryption at rest, an explicit user-facing
retention setting, a delete path, and a revised §8 in the architecture doc.
It is not a small change and should not arrive as a side effect of adding a
database.

---

## 5. Quality

### 5.1 Eval harness — *highest-value item here*

A golden set of question/answer pairs over a fixed corpus, measuring:

- **Answer accuracy** — graded against reference answers
- **Citation precision** — does the cited document actually support the claim
- **Citation recall** — are claims that need citations carrying them
- **Refusal correctness** — does it say "not in these documents" when true

This is what turns every other item on this list from an opinion into a
measurement. It is also the prerequisite for §2.1: without it, "we added
retrieval" is a claim with no evidence attached, and §5.5 of the architecture
doc stays an open question rather than a resolved tradeoff.

### 5.2 Grounding verification

Post-generation, verify each cited span actually appears in the claimed source.
Flag or strip citations that fail. Cheap to build and it catches the failure
mode users find most damaging — a plausible answer attached to a real-looking
citation that does not support it.

### 5.3 Native citations

Anthropic's citations feature is more precise than manual `[n]` markers.
Deferred in v1 because it constrains document passing in ways that complicate
the caching strategy (`ARCHITECTURE.md` §6.2). Worth revisiting once the eval
harness can measure whether it actually improves citation precision.

---

## 6. Product

- **Google Picker** alongside pasted links, enabling a `drive.file` path for
  users who cannot or will not grant `drive.readonly` — and a route to public
  launch without the restricted-scope assessment
- **Multiple folders** in one conversation
- **Conversation history**, which requires §4 and a real answer on document
  retention
- **Export the conversation** to Docs or Markdown, with citations preserved
- **Suggested questions** generated at ingest from the manifest, solving the
  blank-page problem
- **Cost controls** — estimate and display token cost before ingesting a large
  folder, since a 500-file folder is a real spend
- **Answer confidence** signals when a question is only weakly supported

---

## 7. Operations

Cost attribution per user and per corpus; alerting on ingest failure rate,
p95 latency, and cache hit ratio (a collapsed hit ratio means costs several
times the model in `ARCHITECTURE.md` §5.2); graceful degradation to a smaller
model under load; and a data processing agreement plus ZDR arrangement before
any customer-facing deployment (`ARCHITECTURE.md` §8.4).

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
