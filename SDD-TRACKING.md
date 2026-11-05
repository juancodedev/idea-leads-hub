# SDD Tracking — idea-leads-hub

Session-scoped tracking for Spec-Driven Development changes on this repository.

## Session Preflight

| Setting | Value |
| --- | --- |
| Execution mode | `interactive` |
| Artifact store | `both` (openspec files + engram memory) |
| Chained PR strategy | `ask-always` |
| Review budget | `review_budget_lines: 800` |

Language contract: technical artifacts in English by default; UI copy follows the
existing project language (Spanish). Code identifiers/comments stay in English.

## Changes

### 1. `activities-status-management` — IN PROGRESS (design approved)

- **Area**: `/activities` listing page
- **Objective**: activities are listed but cannot be managed — there is no way to
  transition an activity from one status (e.g., a created task) to another
  (e.g., completed).
- **Status**: exploration ✅ → proposal ✅ → spec ✅ → design ✅ (Judgment Day APPROVED,
  Round 3, 2 fix iterations) → tasks → apply → verify → archive
- **Judgment Day carry-forward (must land in tasks)**:
  1. Migration files must use the repo's 14-digit `YYYYMMDDHHMMSS` naming convention;
     enforce deployment order: add columns → deploy code (migrate writers) → `SET NOT NULL`
     → trigger last. Never 8-digit names.
  2. `PATCH /api/activities/[id]/complete` must log the audit for the transition
     (spec requires audit for every transition via server action AND REST route).

### 2. `activity-attachments` — PENDING

- **Area**: `/leads/[id]`, "Registrar Nueva Actividad" modal
- **Objective**: the modal currently only captures type, title, details, and due
  date. It must also allow uploading files, managed through Supabase Storage.

### 3. `email-attachments` — PENDING

- **Area**: `/leads/[id]`, "Enviar Email" modal
- **Objective**: the email modal currently only has recipient, subject, and body.
  It must also allow attaching files to send.

### 4. `messaging-pipeline` — IN PROGRESS (apply: T1–T4 done)

- **Area**: Instagram DM / Messenger (later WhatsApp): webhook, data model, send path, `/messages` inbox
- **Objective**: port the messaging pipeline patterns from `builder-crm` (conversations/messages
  tables, webhook idempotency, echo dedup, 24h window with `HUMAN_AGENT`, single `DeliverMessage`
  path, delivery statuses) into the hexagonal architecture of this repo, as a `MessagingChannel`
  port with Meta adapters.
- **Source analysis**: [`docs/mejoras-mensajeria-desde-builder-crm.md`](docs/mejoras-mensajeria-desde-builder-crm.md)
  (comparison, 7 phases, WhatsApp reference, handoff section).
- **Status**: exploration ✅ → proposal ✅ (approved 2026-11-03 —
  [`openspec/changes/messaging-pipeline/proposal.md`](openspec/changes/messaging-pipeline/proposal.md))
  → spec ✅ (approved 2026-11-03 — `specs/{messaging-pipeline,api-rest,activity-status}`)
  → design ✅ (Judgment Day APPROVED round 1, 13 warnings incorporated — `design.md` §9,
  `judgment-day.md`; approved 2026-11-03) → tasks ✅ (T1–T10) → apply (T1–T4 done; T5 next)
  → verify → archive
- **Decision (2026-11-03)**: option (a) — new `conversations`/`messages`/`webhook_events` tables
  (plus `channel_accounts`) and migrate existing `INSTAGRAM_MESSAGE` activities into them; activities
  remain only as lead timeline events. This supersedes the `activities`-as-message-store choice in
  `openspec/changes/instagram-messaging/design.md`. Rejected: (b) new tables without migrating history,
  (c) keep activities and add `mid`/direction columns.
- **Carry-forward**: 14-digit migration names; Phase 1 touches persisted data → full SDD lane with review.

## Sequencing

Tasks are executed one change at a time, in order: 1 → 4 → 2 → 3.

- 2026-11-03: `messaging-pipeline` (4) moved ahead of the attachment changes (2, 3) — the current
  webhook duplicates messages on Meta retries, so delaying it grows the data to clean during migration.