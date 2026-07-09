# Proposal: Missing API Routes

## Intent

Complete the REST API surface for all domain entities. Currently only 3 API routes exist (`/api/auth/login`, `POST /api/leads`, `/api/docs/openapi.json`). All entity CRUD, status transitions, and resource relationships are inaccessible via API — forcing frontend to operate on DB concepts directly.

## Scope

### In Scope
- `src/lib/api/` helpers: `with-auth.ts`, `api-handler.ts`
- Route files for Ideas, Activities, Pipeline + Stages, Tags, Notes, Profile
- Expand Leads: GET (list + single), PATCH (update), DELETE, status transition
- OpenAPI spec updated with all new endpoints
- Chained into 4 independently-deployable PRs

### Out of Scope
- Refactoring existing `POST /api/leads` to use shared helpers (deferred)
- OpenAPI schema auto-generation from Zod (deferred — manual expand for now)
- Rate limiting, request logging middleware
- Webhook/event emission from API handlers

## Capabilities

### New Capabilities
- `api-rest`: Complete REST API for all domain entities — Ideas, Activities, Pipeline, Stages, Tags, Notes, Profile, and expanded Leads. Covers auth enforcement, Zod validation, typed error mapping, and English-field request/response schemas.

### Modified Capabilities
- None — this is the first set of API specs.

## Approach

**Option B — Shared Handler Pattern** (selected in exploration):

1. Create `src/lib/api/with-auth.ts` (extract auth) and `src/lib/api/api-handler.ts` (standard try/catch → HTTP error mapping)
2. Implement routes per entity: Profile → Tags → Ideas → Activities → Notes → Pipeline+Stages → Expand Leads
3. New endpoints use **English field names** (user decision). Existing `POST /api/leads` keeps Spanish fields for backward compat.
4. Pipeline stages nested under `/api/pipelines/[id]/stages/`. Reorder via `PUT /api/pipelines/[id]/stages/reorder` (routed before `[stageId]` to avoid collision).
5. 4 chained PRs: A (helpers + Profile/Tags/Notes), B (Ideas + Activities), C (Pipeline + stages + expand Leads), D (OpenAPI spec).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/api/with-auth.ts` | **New** | Auth enforcement helper (createClient + getUser) |
| `src/lib/api/api-handler.ts` | **New** | Error boundary wrapper (typed errors → HTTP status) |
| `src/app/api/ideas/` | **New** | 6 route files (list, get, create, update, status, delete) |
| `src/app/api/activities/` | **New** | 6 route files (list, get, create, update, complete, delete) |
| `src/app/api/pipelines/` | **New** | 10 route files (pipelines CRUD + nested stages CRUD + reorder) |
| `src/app/api/tags/` | **New** | 5 route files (list, create, delete, assign, remove) |
| `src/app/api/notes/` | **New** | 4 route files (list, create, update, delete) |
| `src/app/api/profile/` | **New** | 1 route file (GET + PUT) |
| `src/app/api/leads/` | **Modified** | Expand from single POST to full CRUD + status |
| `src/app/api/docs/openapi.json` | **Modified** | Add all new endpoints + schemas |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `POST /api/leads` backward compat (Spanish fields vs English) | Medium | Leave as-is; new leads endpoints use English. Spec documents the asymmetry. |
| Pipeline stage reorder route collision with `[stageId]` | Low | Route `reorder` before `[stageId]` in filesystem order; document the constraint. |
| OpenAPI spec drift with 25+ manual endpoints | High | Add all paths in PR D immediately; accept manual for now, flag for future Zod→OpenAPI generation. |
| Chained PR merge conflicts | Low | Each PR targets main sequentially; shared helpers are non-overlapping. |

## Rollback Plan

Each chained PR is independently deployable. Rollback per PR:
- **PR A**: Revert `src/lib/api/`, route files for Profile/Tags/Notes
- **PR B**: Revert route files for Ideas/Activities
- **PR C**: Revert Pipeline + stage routes, lead route changes
- **PR D**: Revert OpenAPI spec changes
Existing `POST /api/leads` is never modified — zero regression risk for the one existing endpoint.

## Dependencies

- All repositories and use cases already exist (exploration confirmed)
- No new packages required

## Success Criteria

- [ ] All 25+ endpoints respond with correct HTTP status codes (200/201/204/400/401/404/409/500)
- [ ] Auth middleware rejects unauthenticated requests with 401
- [ ] Zod validation rejects invalid payloads with 400 + formatted errors
- [ ] Typed errors (NotFoundError, ConflictError) map to correct HTTP statuses
- [ ] `POST /api/leads` continues working unchanged (backward compat)
- [ ] OpenAPI spec lists all endpoints with request/response schemas
- [ ] `pnpm build` passes, `pnpm test` passes (existing tests green)
- [ ] Each chained PR passes CI independently
