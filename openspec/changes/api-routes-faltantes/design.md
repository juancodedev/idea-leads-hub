# Design: Missing API Routes

## Technical Approach

**Shared Handler Pattern**: Two lightweight helpers (`with-auth.ts`, `api-handler.ts`) eliminate auth + error boilerplate from every route. Each route file becomes ~10–15 lines — instantiate repo + use case, execute, respond. Composition: `apiHandler(withAuth(handler))`.

Codebase has a **hybrid architecture**: `core/` (hexagonal — Lead, Profile, Tag, Note, Pipeline) and `modules/` (feature-based — Idea, Activity with mapper + schema + repo). Routes import from whichever layer owns the entity. All repos throw typed errors from `errors.ts` which `apiHandler` maps to HTTP status codes.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Shared helpers vs pure boilerplate | `with-auth.ts` + `api-handler.ts` | 25+ route files duplicating auth + try/catch is unsustainable. Edge middleware is fragile with cookie-based Supabase auth. |
| Error mapping | `instanceof` in apiHandler | Errors have `statusCode` but no common base. `instanceof NotFoundError/ConflictError/etc.` is explicit. Also maps `ZodError` + `SyntaxError` → 400. |
| Pipeline reorder collision | Filesystem order | App Router matches static segments (`reorder`) before dynamic (`[stageId]`) by design — no special handling needed. |
| English vs Spanish | English for new endpoints | Existing `POST /api/leads` untouched. New routes use English. Backward compat guaranteed. |
| Missing Activity use cases | Create in PR B | `GetActivities`, `UpdateActivity`, `DeleteActivity` needed. Repo has all methods — thin use cases maintain consistency. |

## Data Flow

```
req → apiHandler → withAuth(request)
   ├─ createClient() → supabase.auth.getUser()
   ├─ ✗ throw UnauthorizedError → apiHandler catches → 401
   └─ ✓ { supabase, user } → route handler
        ├─ request.json() / query params
        ├─ Zod parse → ✗ throw ZodError → apiHandler → 400
        ├─ new Repo(supabase) + new UseCase(repo)
        ├─ useCase.execute() → ✗ typed error → apiHandler → status
        └─ NextResponse.json(data, 200|201)
```

## File Changes

| PR | File | Action |
|----|------|--------|
| A | `src/lib/api/api-handler.ts` | Create |
| A | `src/lib/api/with-auth.ts` | Create |
| A | `src/app/api/profile/route.ts` | Create — GET + PUT |
| A | `src/app/api/tags/route.ts` | Create — GET + POST |
| A | `src/app/api/tags/[id]/route.ts` | Create — DELETE |
| A | `src/app/api/tags/assign/route.ts` | Create — POST |
| A | `src/app/api/tags/remove/route.ts` | Create — POST |
| A | `src/app/api/notes/route.ts` | Create — GET + POST |
| A | `src/app/api/notes/[id]/route.ts` | Create — PATCH + DELETE |
| B | `src/core/application/activities/GetActivities.ts` | Create |
| B | `src/core/application/activities/UpdateActivity.ts` | Create |
| B | `src/core/application/activities/DeleteActivity.ts` | Create |
| B | `src/app/api/ideas/route.ts` | Create — GET + POST |
| B | `src/app/api/ideas/[id]/route.ts` | Create — GET + PATCH + DELETE |
| B | `src/app/api/ideas/[id]/status/route.ts` | Create — PATCH |
| B | `src/app/api/activities/route.ts` | Create — GET + POST |
| B | `src/app/api/activities/[id]/route.ts` | Create — GET + PATCH + DELETE |
| B | `src/app/api/activities/[id]/complete/route.ts` | Create — PATCH |
| C | `src/app/api/pipelines/route.ts` | Create — GET + POST |
| C | `src/app/api/pipelines/[id]/route.ts` | Create — GET + PATCH + DELETE |
| C | `src/app/api/pipelines/[id]/stages/route.ts` | Create — GET + POST |
| C | `src/app/api/pipelines/[id]/stages/reorder/route.ts` | Create — PUT |
| C | `src/app/api/pipelines/[id]/stages/[stageId]/route.ts` | Create — PATCH + DELETE |
| C | `src/app/api/leads/route.ts` | Modify — add GET |
| C | `src/app/api/leads/[id]/route.ts` | Create — GET + PATCH + DELETE |
| C | `src/app/api/leads/[id]/status/route.ts` | Create — PATCH |
| D | `src/app/api/docs/openapi.json/route.ts` | Modify |

**Total**: 30 create + 2 modify = **32 files**

## Interfaces

```typescript
type ApiHandler = (req: NextRequest, ctx?: { params: any }) => Promise<NextResponse>;
export function apiHandler(handler: ApiHandler): ApiHandler;
export async function withAuth(req: NextRequest): Promise<{ supabase: SupabaseClient<Database>; user: User }>;
// Success: NextResponse.json(data, { status: 200|201 })
// Empty:   new NextResponse(null, { status: 204 })
// Error:   NextResponse.json({ error: string, details?: any }, { status })
```

All routes export `runtime = 'nodejs'`. DELETE handlers return `new NextResponse(null, { status: 204 })`.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `apiHandler` error mapping | Stub each error type; assert status + body shape |
| Unit | `withAuth` | Mock `getUser`; assert 401 on missing user |
| Integration | Per-entity route | Instantiate handler with mocked supabase client; assert status + body |
| E2E | `POST /api/leads` compat | Verify Spanish-field payload returns 201 unchanged |

## Migration / Rollout

No migration. Each PR is independently deployable — rollback reverts that PR's files with zero overlap. `POST /api/leads` never modified.

## Open Questions

- [ ] Activity routes need `ideaId` filter — `activitySchema` only has `leadId`. Extend schema in PR B or define API-level query schema?
