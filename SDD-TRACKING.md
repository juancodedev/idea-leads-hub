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

## Sequencing

Tasks are executed one change at a time, in order: 1 → 2 → 3.