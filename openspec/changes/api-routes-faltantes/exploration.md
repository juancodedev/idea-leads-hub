# Exploration: Missing API Routes

## Current State

The project has exactly **3 API route files**:

| Route | Method | Pattern | Auth |
|-------|--------|---------|------|
| `/api/auth/login` | POST | Inline Zod validation, Supabase auth | No (login) |
| `/api/leads` | POST | Use case + repository, Zod via LeadSchema | Inline `auth.getUser()` |
| `/api/docs/openapi.json` | GET | Static JSON response | No |

**Missing entirely**: Ideas, Activities, Pipeline (including stages), Tags, Notes, Profile. Also missing for Leads: GET (list + single), PATCH (update), DELETE, and status transitions.

### Architecture Pattern (from POST /api/leads)

1. Create supabase client via `createClient()`
2. Check auth inline: `supabase.auth.getUser()`
3. Parse + validate body with Zod schema
4. Instantiate repository + use case (manual DI)
5. Map API fields → DTO → execute → respond
6. Catch errors → return JSON with status codes

### Available Infrastructure

**BaseRepository** (`src/infrastructure/repositories/BaseRepository.ts`):
- Provides: `requireUser()`, `findAll<T>()`, `findById<T>()`, `createEntity<T>()`, `updateEntity<T>()`, `deleteEntity()`
- All methods throw typed errors

**Typed errors** (`errors.ts`):
| Error | Status Code |
|-------|-------------|
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `UnauthorizedError` | 401 |
| `DatabaseError` | 500 |

**Repositories**: All 6 repositories extend BaseRepository and implement their respective ports:
- `SupabaseLeadRepository` — full CRUD + `updateStatus()`
- `SupabaseIdeaRepository` — full CRUD + `archive()` / `restore()` / `moveStatus()`
- `SupabaseActivityRepository` — CRUD + `getForLead()` / `getForIdea()` / `getPending()` / `complete()`
- `SupabasePipelineRepository` — CRUD + stage management (`getStages`, `createStage`, `updateStage`, `deleteStage`, `reorderStages`)
- `SupabaseTagRepository` — CRUD + `assignToEntity()` / `removeFromEntity()` / `getForEntity()`
- `SupabaseNoteRepository` — CRUD scoped to `getForEntity()` (lead/idea)

**Use Cases** already exist for:
- Leads: `CreateLead`, `UpdateLead`, `MoveLeadToStage`
- Ideas: `CreateIdea`, `GetIdeas`, `UpdateIdea`, `DeleteIdea`, `MoveIdeaStatus`
- Activities: `CreateActivity`, `CompleteActivity` (list/update/delete use cases missing)
- Shared: `AssignTag`, `RemoveTag`, `CreateNote`, `UpdateNote`, `DeleteNote`
- Profile: `GetProfile`, `UpdateProfile`, `UploadAvatar`

### OpenAPI Spec

The spec at `/api/docs/openapi.json` is a static object with paths for only 2 endpoints (`/api/auth/login` and `/api/leads`). Missing all entities. Schemas are defined as raw JSON objects (not generated from Zod). The Swagger UI page loads this via SwaggerUIBundle from CDN.

---

## Proposed Endpoints

### 1. Leads (expand from single POST)

| Method | Path | Auth | Use Case | Description |
|--------|------|------|----------|-------------|
| GET | `/api/leads` | Required | none (repo.getAll) | List all leads |
| GET | `/api/leads/[id]` | Required | none (repo.getById) | Get single lead |
| POST | `/api/leads` | Required | `CreateLead` | ✅ Already exists |
| PATCH | `/api/leads/[id]` | Required | `UpdateLead` | Update lead fields |
| PATCH | `/api/leads/[id]/status` | Required | `MoveLeadToStage?` | Update status |
| DELETE | `/api/leads/[id]` | Required | none (repo.delete) | Delete lead |

### 2. Ideas (full CRUD + status)

| Method | Path | Auth | Use Case |
|--------|------|------|----------|
| GET | `/api/ideas` | Required | `GetIdeas` |
| GET | `/api/ideas/[id]` | Required | repo.getById |
| POST | `/api/ideas` | Required | `CreateIdea` |
| PATCH | `/api/ideas/[id]` | Required | `UpdateIdea` |
| PATCH | `/api/ideas/[id]/status` | Required | `MoveIdeaStatus` |
| DELETE | `/api/ideas/[id]` | Required | `DeleteIdea` |

### 3. Activities

| Method | Path | Auth | Use Case |
|--------|------|------|----------|
| GET | `/api/activities` | Required | repo.getPending(userId) — filter by `leadId` or `ideaId` query params |
| GET | `/api/activities/[id]` | Required | repo.getById |
| POST | `/api/activities` | Required | `CreateActivity` |
| PATCH | `/api/activities/[id]` | Required | repo.update |
| PATCH | `/api/activities/[id]/complete` | Required | `CompleteActivity` |
| DELETE | `/api/activities/[id]` | Required | repo.delete |

### 4. Pipeline (with stages as nested resource or sub-routes)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/pipelines` | Required | List pipelines |
| GET | `/api/pipelines/[id]` | Required | Get pipeline with stages |
| POST | `/api/pipelines` | Required | Create pipeline |
| PATCH | `/api/pipelines/[id]` | Required | Update pipeline |
| DELETE | `/api/pipelines/[id]` | Required | Delete pipeline |
| GET | `/api/pipelines/[id]/stages` | Required | List stages |
| POST | `/api/pipelines/[id]/stages` | Required | Create stage |
| PATCH | `/api/pipelines/[id]/stages/[stageId]` | Required | Update stage |
| DELETE | `/api/pipelines/[id]/stages/[stageId]` | Required | Delete stage |
| PUT | `/api/pipelines/[id]/stages/reorder` | Required | Reorder stages |

### 5. Tags

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tags` | Required | List all tags |
| POST | `/api/tags` | Required | Create tag |
| DELETE | `/api/tags/[id]` | Required | Delete tag |
| POST | `/api/tags/assign` | Required | Assign tag to entity |
| POST | `/api/tags/remove` | Required | Remove tag from entity |

### 6. Notes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notes` | Required | List notes for entity (query: `entityId` + `entityType`) |
| POST | `/api/notes` | Required | Create note |
| PATCH | `/api/notes/[id]` | Required | Update note |
| DELETE | `/api/notes/[id]` | Required | Delete note |

### 7. Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/profile` | Required | Get user profile |
| PUT | `/api/profile` | Required | Update profile |

---

## Approaches

### Option A: Individual Route Files (Next.js App Router)

Create `route.ts` files per resource following the exact pattern of `POST /api/leads`.

**Structure:**
```
src/app/api/
├── leads/
│   ├── route.ts              ← GET + POST (list + create)
│   └── [id]/
│       ├── route.ts          ← GET + PATCH + DELETE
│       └── status/route.ts   ← PATCH
├── ideas/
│   ├── route.ts              ← GET + POST
│   └── [id]/
│       ├── route.ts          ← GET + PATCH + DELETE
│       └── status/route.ts   ← PATCH
├── activities/
│   ├── route.ts              ← GET + POST
│   └── [id]/
│       ├── route.ts          ← GET + PATCH + DELETE
│       └── complete/route.ts ← PATCH
├── pipelines/
│   ├── route.ts
│   ├── [id]/
│   │   ├── route.ts
│   │   └── stages/
│   │       ├── route.ts      ← GET + POST
│   │       └── [stageId]/route.ts ← PATCH + DELETE
├── tags/
│   ├── route.ts              ← GET + POST
│   ├── [id]/route.ts         ← DELETE
│   ├── assign/route.ts       ← POST
│   └── remove/route.ts       ← POST
├── notes/
│   ├── route.ts              ← GET + POST
│   └── [id]/route.ts         ← PATCH + DELETE
└── profile/
    └── route.ts              ← GET + PUT
```

**Pros:**
- Follows Next.js conventions exactly — predictable file discovery
- Matches existing codebase pattern (POST /api/leads)
- No additional abstractions to learn
- Easy to test in isolation

**Cons:**
- **Massive boilerplate duplication** — auth check repeated in ~25+ route handlers
- Error handling pattern duplicated everywhere
- No consistent way to handle `NotFoundError` / typed errors → HTTP mapping
- Harder to enforce consistent API response shapes
- ~20-25 new route files

**Effort: High** — simple per-file but the sheer volume of duplication is costly.

---

### Option B: Shared Handler Pattern

Create a thin helper layer that standardizes the auth + error handling while keeping per-resource route files.

**Proposed helpers:**

```typescript
// src/lib/api/with-auth.ts
export async function withAuth(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new UnauthorizedError('No autorizado');
  }
  return { supabase, user };
}

// src/lib/api/api-handler.ts — wraps a handler with try/catch
export function apiHandler(handler: ApiHandler) {
  return async (request: NextRequest, context: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof UnauthorizedError) return json({ error: error.message }, 401);
      if (error instanceof NotFoundError) return json({ error: error.message }, 404);
      if (error instanceof ConflictError) return json({ error: error.message }, 409);
      if (error instanceof DatabaseError) return json({ error: error.message }, 500);
      if (error instanceof SyntaxError) return json({ error: 'JSON inválido' }, 400);
      if (error instanceof z.ZodError) return json({ error: 'Error de validación', details: error.format() }, 400);
      return json({ error: 'Error interno' }, 500);
    }
  };
}

// src/lib/api/with-validation.ts — wraps a handler with Zod validation
export function withValidation<T>(schema: z.ZodSchema, handler: BodyHandler<T>) {
  return async (data: T) => {
    const result = schema.safeParse(data);
    if (!result.success) throw result.error;
    return handler(result.data);
  };
}
```

**Route example:**
```typescript
// src/app/api/ideas/route.ts
export const runtime = 'nodejs';
export const GET = apiHandler(async (request) => {
  const { supabase } = await withAuth(request);
  const repository = new SupabaseIdeaRepository(supabase);
  const useCase = new GetIdeas(repository);
  const { searchParams } = new URL(request.url);
  const filters = { status: searchParams.get('status'), leadId: searchParams.get('leadId') };
  const ideas = await useCase.execute(filters);
  return NextResponse.json(ideas);
});

export const POST = apiHandler(async (request) => {
  const { supabase } = await withAuth(request);
  const body = await request.json();
  const data = ApiCreateIdeaSchema.parse(body); // Zod parse (throws ZodError)
  const repository = new SupabaseIdeaRepository(supabase);
  const useCase = new CreateIdea(repository);
  const idea = await useCase.execute(data);
  return NextResponse.json(idea, { status: 201 });
});
```

**Pros:**
- Centralized error → HTTP response mapping (handles typed errors in one place)
- Auth check extracted into one helper
- Response shape consistency enforced
- ZodError automatically becomes 400
- New routes are ~10-15 lines each instead of ~60+
- Easy to add logging/metrics to the wrapper

**Cons:**
- New abstraction not yet in the codebase — introduces a pattern shift
- Route files look different from existing POST /api/leads (inconsistency during transition)
- Need to choose: refactor existing routes or leave them as-is

**Effort: Medium** — create 2-3 helper files, then each route is ~10 lines.

---

### Option C: Full Middleware + Registry Pattern

Extract auth into Next.js middleware (`middleware.ts` at app root) that checks Supabase session for all `/api/*` routes except `/api/auth/login`. Plus a route registry that maps method+path → handler.

**Pros:**
- Auth is truly centralized (not even imported per route)
- Cleanest separation of concerns

**Cons:**
- Next.js middleware runs at edge — can't use `createClient()` from `@supabase/ssr` easily (cookies vs headers)
- Route registry fights the App Router conventions (files ARE the router)
- Over-engineered for this scope
- Would need to refactor existing routes regardless

**Effort: Very High** — fighting framework conventions + auth complexity at middleware level.

---

## Recommendation

**Option B (Shared Handler Pattern)** with a pragmatic split:

1. **Phase 1** — Create `src/lib/api/` helpers:
   - `with-auth.ts` — `createClient()` + `getUser()` wrapper
   - `api-handler.ts` — error mapping wrapper
   - `api-errors.ts` — re-export typed errors for routes (optional, they can import from errors.ts)

2. **Phase 2** — Implement routes per entity using helpers, in this order:
   - Profile (simplest, no use case needed)
   - Tags (small surface, no sub-resources)
   - Ideas (full CRUD, use cases exist)
   - Activities (CRUD + complete)
   - Notes (scoped CRUD)
   - Pipeline + stages (most complex — nested resources, reorder)
   - Expand Leads (GET list, GET by id, PATCH, DELETE)

3. **Phase 3** — Update OpenAPI spec with new endpoints
   - Ideally extract schema generation or at least add all paths to the static JSON

**Why not Option A?** — 25+ route files each duplicating auth + try/catch + error mapping is unsustainable and error-prone.

**Why not Option C?** — Next.js middleware auth is fragile with `@supabase/ssr`, and fighting the App Router with a custom registry adds complexity without proportionally more benefit.

---

## Risks

1. **Backward compatibility**: Existing `POST /api/leads` must keep working. Consider deprecating after the PATCH route is added, or keep both. Current route uses a Spanish-field schema (`empresa`, `origen`) — new routes should also match the existing API style (Spanish field names for request bodies) unless we align everything to English. **Decision needed: maintain Spanish API fields or switch to English?**
2. **Routing conflicts**: `POST /api/leads` already exists. Adding `GET /api/leads` is fine (different method in same file), but adding `PATCH /api/leads/[id]` requires the segment folder. Ensure no overlap.
3. **Error consistency**: Existing routes handle errors inline with `console.error` and specific messages. The new wrapper must not lose error context. Handle this by still logging in the wrapper.
4. **OpenAPI drift**: With ~25+ new endpoints, the static OpenAPI JSON will fall behind fast. Consider whether to switch to a code-generated approach (like `zod-to-json-schema` + `openapi3-ts`) or just expand the static file manually.
5. **Pipeline stages route design**: Stages as nested resource under `/api/pipelines/[id]/stages` vs. flat under `/api/pipeline-stages`. Nested is more RESTful but requires deep folder nesting. The reorder endpoint (`/api/pipelines/[id]/stages/reorder`) needs special handling to not collide with `[stageId]`.

## Readiness for Proposal

**Yes**, ready for proposal. The exploration is comprehensive enough to move to `sdd-propose`. Key open question for the user:

> **Spanish vs English API fields**: Current `POST /api/leads` uses Spanish request body field names (`empresa`, `origen`, `nombre`, `telefono`, `notas`). Should new routes keep Spanish for consistency, or switch to English? This decision affects all request/response schemas.
