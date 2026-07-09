# Tasks: Missing API Routes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650–750 (32 files: 30 create + 2 modify) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR A (helpers + Profile/Tags/Notes) → PR B (Ideas + Activities) → PR C (Pipeline + Stages + expand Leads) → PR D (OpenAPI) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Shared helpers + Profile, Tags, Notes routes | PR A → main | Unit tests for apiHandler + withAuth error mapping |
| 2 | Activity use cases + Ideas + Activities routes | PR B → main | Depends on PR A for shared helpers |
| 3 | Pipeline + stages + expand Leads routes | PR C → main | Depends on PR A for shared helpers |
| 4 | OpenAPI spec update | PR D → main | Depends on all prior PRs |

Chain preference: stacked-to-main (each PR merges to main sequentially). Confirm before apply.

## Phase 1: Shared Helpers Foundation (PR A)

- [x] 1.1 Create `src/lib/api/with-auth.ts` — `createClient()` + `getUser()` → returns `{ supabase, user }` or throws `UnauthorizedError`
- [x] 1.2 Create `src/lib/api/api-handler.ts` — wraps handler; maps `NotFoundError`→404, `ConflictError`→409, `UnauthorizedError`→401, `ZodError`→400, `DatabaseError`→500

## Phase 2: PR A — Profile, Tags, Notes Routes

- [x] 2.1 Create `src/app/api/profile/route.ts` — GET (current user) + PUT (update), `runtime = 'nodejs'`
- [x] 2.2 Create `src/app/api/tags/route.ts` (GET list + POST 201) + `src/app/api/tags/[id]/route.ts` (DELETE 204)
- [x] 2.3 Create `src/app/api/tags/assign/route.ts` (POST) + `src/app/api/tags/remove/route.ts` (POST) — body: `{ tagId, entityId, entityType }`
- [x] 2.4 Create `src/app/api/notes/route.ts` — GET (query: `entityId`+`entityType`) + POST (201)
- [x] 2.5 Create `src/app/api/notes/[id]/route.ts` — PATCH (200) + DELETE (204)

## Phase 3: PR B — Ideas + Activities Routes

- [x] 3.1 Create `src/core/application/activities/GetActivities.ts`, `UpdateActivity.ts`, `DeleteActivity.ts` — thin use cases calling existing repo methods
- [x] 3.2 Create `src/app/api/ideas/route.ts` (GET list filters `?status&leadId` + POST 201) + `src/app/api/ideas/[id]/route.ts` (GET + PATCH + DELETE 204)
- [x] 3.3 Create `src/app/api/ideas/[id]/status/route.ts` — PATCH status transition (200)
- [x] 3.4 Create `src/app/api/activities/route.ts` (GET list `?leadId&ideaId` + POST 201) + `src/app/api/activities/[id]/route.ts` (GET + PATCH + DELETE 204)
- [x] 3.5 Create `src/app/api/activities/[id]/complete/route.ts` — PATCH mark complete (200)

## Phase 4: PR C — Pipeline + Stages + Expand Leads

- [x] 4.1 Create `src/app/api/pipelines/route.ts` (GET list + POST 201) + `src/app/api/pipelines/[id]/route.ts` (GET include stages + PATCH + DELETE 204)
- [x] 4.2 Create `src/app/api/pipelines/[id]/stages/route.ts` (GET + POST 201) + `src/app/api/pipelines/[id]/stages/reorder/route.ts` (PUT — body: `stageId[]`)
- [x] 4.3 Create `src/app/api/pipelines/[id]/stages/[stageId]/route.ts` — PATCH + DELETE 204
- [x] 4.4 Modify `src/app/api/leads/route.ts` — add GET list (keeping existing POST backward compat)
- [x] 4.5 Create `src/app/api/leads/[id]/route.ts` (GET + PATCH English fields + DELETE 204) + `src/app/api/leads/[id]/status/route.ts` (PATCH `{ status }`)

## Phase 5: PR D — OpenAPI Spec Update

- [x] 5.1 Modify `src/app/api/docs/openapi.json/route.ts` — add all 25+ endpoints with request/response schemas and error responses

## Phase 6: Build & Test Verification Per PR

- [ ] 6.1 Per PR: `pnpm build` + `pnpm test` pass; verify `POST /api/leads` unchanged; run auth enforcement scenario (401); test each endpoint's success + error status codes
