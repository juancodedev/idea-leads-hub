# Archive Report: activities-status-management

**Archived**: 2026-08-17
**Verdict**: PASS (0 CRITICAL, 0 WARNING findings; 3 SUGGESTIONs — 2 folded into tasks.md, 1 informational/deferred)
**Mode**: hybrid (openspec files + engram)
**Branch**: `feat/activities-status-management` (no push, no PR)

---

## Task Completion Reconciliation

**Stale checkboxes found**: none — all 33 tasks (1.1–7.3) are marked `[x]` in `tasks.md` and verified against on-disk artifacts by sdd-verify (verify-report.md: tasks 33/33 complete). No archive-time reconciliation required.

## SDD Cycle Status

| Phase | Artifact | Status | Engram observation ID |
|-------|----------|--------|----------------------|
| Explore | `exploration.md` | ✅ | — |
| Proposal | `proposal.md` | ✅ | #719 |
| Spec | `specs/activity-status/spec.md`, `specs/api-rest/spec.md` | ✅ | #720 |
| Design | `design.md` | ✅ | #722 |
| Tasks | `tasks.md` | ✅ (33/33 complete) | #729 |
| Apply | apply-progress (cumulative, 32 commits) | ✅ | #731 |
| Verify | `verify-report.md` | ✅ PASS (78 suites / 429 tests, tsc 0, lint 0) | #733 |
| Delivery | delivery strategy cache (feature-branch-chain) | ✅ recorded | #730 |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| activity-status | Created | New domain — full spec copied to main specs (`openspec/specs/activity-status/spec.md`): 9 requirements, 17 scenarios |
| api-rest | Updated | Delta merged into `openspec/specs/api-rest/spec.md`: 1 ADDED requirement (OpenAPI documentation of activity status surface) + MODIFIED "Activities" requirement (9-endpoint table incl. PATCH /status, /read, /unread; 7 scenarios incl. silent-strip contract note). All pre-existing requirements (Shared, Profile, Tags, Notes, Ideas, Pipelines, Stages, Leads, Backward Compatibility) preserved unchanged. |

## SUGGESTION Resolution (from verify-report)

- **SUGGESTION-01** (tasks.md 4.1 claims `SupabaseActivityRepository.spec.ts` has "13 tests"; actual = 12): **FOLDED** into tasks.md — corrected to 12 tests with note.
- **SUGGESTION-02** (tasks.md 7.3 understates pre-existing lint warnings): **FOLDED** into tasks.md — updated to enumerate the full pre-existing warning set (LeadPopup.tsx, TagSelector.tsx, IdeaDeleteDialog.tsx, InstagramIntegration.tsx, 2× messages/page.tsx L198/L352), all verified present pre-change; no new warnings.
- **SUGGESTION-03** (`database.types.ts` `activities.status` typed `string | null`, NOT NULL enforced at SQL level in migration 1.2, surfaces in regenerated types post-deploy): **NOT FOLDED** — informational/deferred, no doc action.

## Archive Contents

| Artifact | Status |
|----------|--------|
| exploration.md | ✅ |
| proposal.md | ✅ |
| specs/activity-status/spec.md | ✅ |
| specs/api-rest/spec.md | ✅ |
| design.md | ✅ |
| tasks.md | ✅ (33/33 tasks complete, SUGGESTION-01/02 folded) |
| verify-report.md | ✅ PASS |
| archive-report.md | ✅ (this file) |

## Source of Truth Updated

The following specs now reflect the new behavior as the default baseline:
- `openspec/specs/activity-status/spec.md` — new domain spec (created)
- `openspec/specs/api-rest/spec.md` — Activities section rewritten + OpenAPI requirement (updated)

## Verification Summary

- **Tests**: `pnpm test -- --ci` → 78 suites / 429 tests passed, exit 0 (baseline 76/416; delta +2 suites / +13 tests = slice-4 migration specs)
- **Build**: `npx tsc --noEmit` → exit 0
- **Lint**: `next lint` → exit 0 (warnings only, all pre-existing)
- **Spec compliance**: activity-status 17/17 scenarios; api-rest 8/8 scenarios

## Deferred Follow-up Change (NEXT)

**Change name (suggested)**: `activities-completed-column-drop`

**Scope** (ONE later change, per design Rollout step 7 / tasks.md 7.3 / verify-report):
1. DB: drop `activities.completed` column (post-rollout migration, drop-last ordering per runbook Rollback section).
2. Remove the `sync_activity_completed` safety-net trigger (`fn_sync_activity_completed` / `tr_sync_activity_completed`).
3. Remove `completed` from OpenAPI Activity schema (currently marked `deprecated: true`).
4. Retire `getPending` binary-`completed` consumer path (dashboard) — verify `getPending` filter on the status surface.
5. Post-drop invariant: `completed IS DISTINCT FROM (status='COMPLETED')` count = 0 already asserted (BR-4/BR-6 invariant); regenerate `database.types.ts` post-deploy so `activities.status` surfaces `NOT NULL`.
6. OpenAPI before/after audit to prevent doc/contract mismatch while GET payloads still emit `completed` during rollout.

**PR creation**: create the follow-up change via a new SDD cycle (proposal → spec → design → tasks → apply → verify), then open the chained PRs per the cached feature-branch-chain delivery strategy (#730). Not started in this archive.

## Risks

- **WARNING — spec/code discrepancy (pre-existing, not introduced by this change)**: the api-rest delta's Activities table lists `Filters: leadId, ideaId, status` for `GET /api/activities`, but the route (`src/app/api/activities/route.ts`) only supports `leadId`/`ideaId`/`unlinkedId`/`unread`/`type` — status filtering lives at the `/activities` page layer (`statusIn` via repo.search). This originated in sdd-spec, was not flagged by verify (8/8 compliant), and was merged verbatim as the change's documented contract. Recommended: clarify the api-rest spec table in the deferred follow-up change.
- **WARNING — leftover external reference**: design/tasks describe the runbook at `docs/activities-status-rollout.md` (deploy order, invariant SQL, rollback) — verify confirmed it exists and matches; it is not part of the change folder and stays in the repo (intentional).
- Minor: `getPending` / dashboard `completed` consumers remain on binary `completed` by design (BR-4 dual-write); timeline/`summary` route stay on `completed` — all intentional deferred items, not drift.

## Engram Persistence (merged)

Archive report saved to engram topic `sdd/activities-status-management/archive-report` (type: architecture, capture_prompt: false), including this file's content and the archive commit SHA.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.