# activity-status Specification

## Purpose

Enumerated lifecycle management for activities. `ActivityStatus` (PENDING | IN_PROGRESS | COMPLETED) is persisted as `activities.status` with a DB CHECK, mirroring the Ideas module. Instagram "read" is decoupled into its own marker (`read_at`). Transitions are free, owner-only, audited, and served through a repository verb, a use case, a REST endpoint, and an inline list control. During rollout the legacy `completed` column is kept and dual-written from `status`; its drop is a follow-up change.

## Assumptions (resolved open questions)

- **Default filter**: `/activities` defaults to `status != COMPLETED` (PENDING + IN_PROGRESS), replacing today's `completed=false` default — the same visible set as today for backfilled data.
- **Read marker**: a single nullable `read_at timestamptz`; unread = `read_at IS NULL`. No `is_read` boolean — a null timestamp already encodes it and mirrors `completed_at`.

## Requirements

### Requirement: ActivityStatus enum with DB CHECK (BR-1)

The system MUST persist `ActivityStatus` (`PENDING` | `IN_PROGRESS` | `COMPLETED`) as `status TEXT NOT NULL DEFAULT 'PENDING'` on `public.activities` with a CHECK over the three values, and MUST expose the enum end to end (domain enum, entity, DTOs, mapper, `database.types.ts`, Zod schema).

#### Scenario: Backfill from completed flag

- GIVEN rows with `completed=true`
- WHEN the migration runs
- THEN those rows are `COMPLETED` and all others `PENDING`

#### Scenario: Invalid status rejected

- GIVEN a `status` value outside the enum
- WHEN it is persisted
- THEN the DB CHECK rejects the write

### Requirement: Free status transitions (BR-2)

The system MUST allow any status → any status with no transition map. The repository MUST expose a `moveStatus(id, status)` verb; `MoveActivityStatus` MUST throw NotFoundError when the activity does not exist.

#### Scenario: Pending to completed

- GIVEN an activity with `status=PENDING`
- WHEN `moveStatus(id, COMPLETED)` runs
- THEN it returns the activity with `status=COMPLETED`

#### Scenario: Reopen a completed activity

- GIVEN an activity with `status=COMPLETED`
- WHEN `moveStatus(id, PENDING)` runs
- THEN it returns `status=PENDING` (free transition)

#### Scenario: Unknown activity

- GIVEN no activity for the id
- WHEN `MoveActivityStatus.execute(id, status)` runs
- THEN NotFoundError is thrown

### Requirement: Read/completed decoupling (BR-3)

The system MUST store Instagram read state in `read_at` and MUST NOT let status transitions touch `read_at`, nor read operations touch `status`/`completed`. The unread badge MUST count `INSTAGRAM_MESSAGE` rows with `read_at IS NULL`.

#### Scenario: Completing does not mark read

- GIVEN an `INSTAGRAM_MESSAGE` with `read_at=null` and `status=PENDING`
- WHEN it transitions to `COMPLETED`
- THEN `read_at` stays null and it still counts as unread

#### Scenario: Reading does not complete

- GIVEN the same activity marked read
- WHEN the read endpoint sets `read_at`
- THEN `status` stays `PENDING` and `completed` stays false

### Requirement: Migration and dual-write rollout (BR-4)

The system MUST backfill `completed=true → COMPLETED` and Instagram read from `completed`, keep the `completed` column during rollout, and dual-write it as `completed = (status='COMPLETED')` on every transition so existing consumers (dashboard `getPending`, timelines, `/read`, `/unread`) keep functioning. Dropping `completed` is deferred to a follow-up change.

#### Scenario: Consistent dual-write

- GIVEN any status transition
- WHEN it is persisted
- THEN `completed` equals `(status='COMPLETED')`

#### Scenario: Instagram read backfill

- GIVEN `INSTAGRAM_MESSAGE` rows with `completed=true`
- WHEN the migration runs
- THEN `read_at` is set (from `completed_at`, fallback `created_at`/now) and other rows keep `read_at=null`

### Requirement: Owner-only transitions (BR-5)

The system MUST restrict status transitions to the row owner via RLS; a non-owner MUST observe the activity as not found (404).

#### Scenario: Non-owner transition

- GIVEN an activity owned by another user
- WHEN the status endpoint is called
- THEN RLS hides the row and the API returns 404

### Requirement: completed_at lifecycle (BR-6)

The system MUST set `completed_at=now()` when a row enters `COMPLETED` (only if null) and MUST clear it when a row leaves `COMPLETED`.

#### Scenario: Complete then reopen

- GIVEN a `COMPLETED` row with `completed_at` set
- WHEN it moves to `PENDING`
- THEN `completed_at` becomes null; moving back to `COMPLETED` re-stamps it

### Requirement: Status REST endpoint

The system MUST expose `PATCH /api/activities/[id]/status` accepting `{ status }` validated via `z.nativeEnum(ActivityStatus)` (invalid → 400), returning 200 with the updated activity and 404 for unknown/not-owned ids, executed through `MoveActivityStatus`.

#### Scenario: Valid transition via API

- GIVEN an existing owned activity
- WHEN PATCH `/api/activities/{id}/status` with `{"status":"IN_PROGRESS"}`
- THEN 200 with the updated activity

#### Scenario: Invalid status value

- GIVEN a valid session
- WHEN PATCH with `{"status":"DONE"}`
- THEN 400 with Zod error details

### Requirement: Inline list management (UI)

The `/activities` page MUST render a per-row status control with free transitions, an optimistic update reverting on error, `revalidatePath` + toast, and a status filter replacing the "Completadas" checkbox. The default filter MUST be `status != COMPLETED`; an optional `status` URL param (`pending|in_progress|completed|all`) overrides it.

#### Scenario: Transition persists on reload

- GIVEN the user changes a row's status
- WHEN the control is used
- THEN the row updates optimistically, the transition persists, and reload shows the new status

#### Scenario: Failed transition reverts

- GIVEN the server action errors
- WHEN the transition is submitted
- THEN the row reverts and a toast reports the error

#### Scenario: Default filter

- GIVEN no `status` param
- WHEN the page loads
- THEN it lists only rows with `status != COMPLETED`

### Requirement: Audit log on transitions

The system MUST write a `createAuditLog` row (`entityType ACTIVITY`, action `UPDATE`, `changes.status.{old,new}`) for every transition via server action and REST route.

#### Scenario: Transition audited

- GIVEN a successful transition
- THEN an audit row records the status change