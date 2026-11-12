# CRM integration hardening

Objective: close the integration gaps the Prospector hit — machine auth, idempotent
leads, optional email, qualification fields, one canonical field naming — and keep
`/api/docs` in sync.
Branch: `feat/crm-integration-hardening`. Delivery: work-unit commits, single PR.
Test runner: `pnpm test` (jest), plus `pnpm lint` and `tsc --noEmit`.

## Specs

- **S1 — Machine auth.** Integrations authenticate with a CRM-owned API key, never
  with a user password: *"El Prospector tendría que guardar tu contraseña en el
  .env. Lo correcto es una API key propia del CRM para integraciones."* Keys are
  created, listed and revoked by an authenticated user under `/api/auth/api-keys`.
  Only a hash is stored; the plaintext key is returned once at creation. A key is
  sent as `Authorization: Bearer crm_...` or `X-API-Key: crm_...`. Leads read/write
  endpoints accept it; `DELETE` stays session-only. A revoked or unknown key is 401.
- **S2 — External id + upsert.** *"Un identificador externo (externalId, por
  ejemplo el dominio), con upsert. Sin eso, si un envío se reintenta o corro el
  backfill dos veces, se duplican los leads."* `externalId` is unique per user.
  `POST /api/leads` with `externalId` creates (201) or updates the existing lead
  (200); a retried send or a repeated backfill never duplicates. `externalId` is
  also matched by `GET /api/leads?q=`.
- **S3 — Email optional.** *"email obligatorio: deja fuera a los que solo tienen
  WhatsApp."* `email` is optional in the database, API validation, lead forms and
  every read surface. Email sending still requires an email address.
- **S4 — Qualification fields.** *"Campos que el CRM no tiene: comuna o ciudad,
  rubro, puntaje de oportunidad y reseñas o rating."* Persist `city`, `industry`,
  `opportunityScore` (0–100), `rating` (0–5) and `reviewsCount` (>= 0), expose them
  in create/update/search, and surface them in the lead form and detail view.
- **S5 — One naming.** *"al crear se usan nombres en español (empresa, sitio_web)
  y al leer o actualizar en inglés (company, website). Funciona igual, pero
  conviene unificarlo."* English camelCase is the only canonical contract in code,
  docs and responses. The five legacy Spanish create aliases stay accepted and are
  documented as deprecated, so the existing Prospector build keeps working.
- **S6 — Docs.** *"agrega a las tarea, actualizar el /api/docs"*: `/api/docs` and
  `/api/docs/openapi.json` document API-key auth, upsert semantics, the optional
  email and the new fields.

## Tasks

- T1 (S1) — `api_keys` migration + key generation/verification + `withAuth`
  machine path + `/api/auth/api-keys` routes + tests. **Done** — commit `c1db6db`.
- T2 (S2, S3, S4, S5) — leads migration, database types, domain, schemas,
  repository (scope by user, upsert by external id), create/update/list/search
  routes. **Done** — commit `9445787`.
- T3 (S3, S4) — lead form, detail view, quick edit and email tab guards.
  **Done** — commit `7772d7e`.
- T4 (S6) — `/api/docs` + README + openapi route tests. **Done** — commit `9ee48fa`.

## Checks

- `jest` 84 suites / 498 tests pass.
- `tsc --noEmit --incremental false` clean.
- `eslint` on the touched folders: 0 errors (one pre-existing
  `react-hooks/exhaustive-deps` warning in `LeadPopup.tsx`).
- Pending, needs a database: apply `20261112000000_api_keys.sql` and
  `20261112000001_leads_integration_fields.sql` (local reset or
  `supabase db push`) and exercise the upsert against real Postgres, including
  the partial unique index and the score/rating check constraints.
- The broken `pnpm-lock.yaml` (two YAML documents) blocks `pnpm install
  --frozen-lockfile`; tests ran with a local install and the lockfile was left
  untouched.

## Log

- **L1 (user):** "ayudame con esto
  Lo que falta o conviene ajustar en el CRM, de más a menos importante:
  1. Autenticación para máquinas. Hoy solo hay login con usuario y contraseña, que
     devuelve un JWT de Supabase que expira. El Prospector tendría que guardar tu
     contraseña en el .env. Lo correcto es una API key propia del CRM para
     integraciones.
  2. Un identificador externo (externalId, por ejemplo el dominio), con upsert. Sin
     eso, si un envío se reintenta o corro el backfill dos veces, se duplican los
     leads. Se puede esquivar buscando con GET /api/leads?q= y guardando el crm_id
     en el borrador, pero queda frágil.
  3. email obligatorio: deja fuera a los que solo tienen WhatsApp.
  4. Campos que el CRM no tiene: comuna o ciudad, rubro, puntaje de oportunidad y
     reseñas o rating. Sirven para priorizar en el CRM.
  5. Un detalle: al crear se usan nombres en español (empresa, sitio_web) y al leer
     o actualizar en inglés (company, website). Funciona igual, pero conviene
     unificarlo."
- **L2 (user):** "agrega a las tarea, actualizar el /api/docs" — the OpenAPI
  surface is part of this change (S6, T4).
- **L3 (analysis):** the app has no machine auth; `withAuth` only reads the Supabase
  cookie session. `leads.email` is `NOT NULL`, and the public create schema requires
  it. `external_id`, `city`, `industry`, `opportunity_score`, `rating` and
  `reviews_count` do not exist. The lead table already has a *computed* client-side
  score (`ScoreBadge`), so the imported value is stored as `opportunityScore` to
  avoid pretending they are the same number.
- **L4 (design):** API-key requests resolve to a user and use the service-role
  client (RLS is bypassed by design), so every repository call made on that path is
  explicitly scoped by `user_id`. The path is opt-in per route (`allowApiKey`);
  session routes keep RLS unchanged.
- **L5 (design):** `externalId` upsert is `POST` with create (201) / update (200);
  the unique index is `(user_id, external_id) WHERE external_id IS NOT NULL`, and a
  concurrent insert race re-reads and updates instead of failing.
- **L6 (implementation):** four work units: `c1db6db` (API keys), `9445787` (lead
  API), `7772d7e` (lead UI), `9ee48fa` (docs). API keys are opt-in per route; the
  status endpoint keeps session-only auth because it triggers Instagram DMs and
  pipeline-wide reads that are not scoped for a service-role client. The imported
  score is `opportunityScore`, separate from the client-side computed `ScoreBadge`.
- **L7 (verification):** 498 tests pass, `tsc --noEmit` clean, eslint 0 errors.
  The migrations were not applied to any database in this session.
