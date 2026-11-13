# Prospector ↔ CRM integration contract

Branch `feat/prospector-crm-contract`. Delivery: work-unit commits, one PR.
Test runner: `jest` via `pnpm test`. Lint: `eslint .`, types: `tsc --noEmit`.

## Specs

- **S1 (blocker).** `POST /api/leads` with `externalId` must not overwrite fields the
  client did not send. Defaults (`status: "Nuevo"`, `name` = `company`) apply only on
  create. Verification quoted from the request: "create with status "Interesado",
  upsert again without status, then expect "Interesado"."
- **S2.** On the upsert update path: absent or `null` = keep, `""` = clear. PATCH
  `/api/leads/{id}` keeps its current `""` = clear behavior.
- **S3.** API keys must be accepted on `POST /api/notes`, `POST /api/activities` and
  `PATCH /api/leads/{id}/status`. Because those requests run on the service-role
  client, every query and every referenced parent entity is scoped to the key owner.
- **S4.** Optional `externalId`, unique per user, on notes and activities, with the
  same upsert behavior as leads: 201 create, 200 update. Example ids from the request:
  `"cafe-lindo.cl#correo-1"`, `"cafe-lindo.cl#investigacion"`.
- **S5.** 200 and 201 from `POST /api/leads` always include `id`, and `/api/*` must
  never answer with a redirect (the client does not follow them, so the key would be
  dropped).
- **S6.** Validation failures answer
  `{"error": "...", "fields": {"rating": "Expected number"}}`.
- **S7 (optional).** Numeric strings are accepted for `rating`, `reviewsCount`,
  `opportunityScore`, `estimatedValue`: `"4.9"` → `4.9`.
- **S8.** `/api/docs` and README document the contract, including the name mapping the
  client needs for item 4.
- **S4b (item 4, full text arrived later).** Publish the valid `status` values: the
  user's pipeline stage names, via `GET /api/leads/statuses`. Prospector sends
  `Nuevo`, `Contactado`, `Respondió`, `Interesado`, `Retomar`, `Descartado`,
  `Rebotó`; the CRM's default stages are `Nuevo`, `Contactado`, `Interesado`,
  `Propuesta`, `Ganado`, `Perdido`, and the mapping is documented for the client.
- **S4c (`updatedSince`).** `GET /api/leads?updatedSince=<iso>` returns only leads
  whose `updated_at` is at or after the instant, ordered by `updatedAt` ascending by
  default so a poller pages without gaps. This is the enabler for the reverse sync:
  the integration detects a lead the user marked as do-not-contact and stops its
  sequence. A malformed value answers 400 with `fields.updatedSince`.
- **S4d (Phase A, two-way sync).** "Despliega solo la Fase A (catálogo, statusChangedAt,
  serverTime, sin rechazo)." The catalog is a bare array of `{ value, label,
  doNotContact }`; stages carry `is_do_not_contact`; `updatedSince` filters on
  `status_changed_at`, which only a status change moves; `GET /api/leads` returns
  `serverTime` as the next cursor. Unknown statuses are still stored, not rejected.
- **S4e (Phase B, off until the Prospector confirms).** "el rechazo debe ir en los tres
  puntos que escriben status (POST /api/leads, PATCH /api/leads/{id} y PATCH /status),
  con la misma validación compartida." Ships in its own commit.
- **Out of scope:** item 8 (CRM → Prospector do-not-contact sync) is explicitly
  labelled "Phase 2" in the request and is not implemented here.

## Tasks

| ID | Task | Specs | Route | Status |
|----|------|-------|-------|--------|
| T1 | Upsert partial update + null tolerance + name/status defaults only on create | S1, S2, S7 | inline | done |
| T2 | API key on notes, activities, status; scope every machine query | S3 | inline | done |
| T3 | `externalId` on notes and activities: migration, types, repos, routes | S4 | inline | done |
| T4 | 400 `fields` shape and tolerant numeric parsing | S6, S7 | inline | done |
| T5 | OpenAPI + README, including the field-name map | S8 | inline | done |
| T6 | PR and deploy verification | S5 | inline | pending |
| T7 | Regression fix: restore the GET tests the new activities spec overwrote | — | inline | done |
| T8 | Status catalog endpoint + mapping table (PR #93) | S4b | inline | done |
| T9 | `updatedSince` filter on `GET /api/leads` (same PR) | S4c | inline | done |
| T10 | Phase A: catalog shape, `is_do_not_contact`, `status_changed_at`, `serverTime` | S4d | inline | done |
| T11 | Phase B: shared status validation on the three write paths | S4e | inline | blocked (waiting for the Prospector deploy) |

## Log

- **L1 (verbatim request):** "CRM changes so Prospector and the CRM work together.
  Prospector pushes a lead with: POST /api/leads, header X-API-Key, externalId =
  business domain." Followed by items 1–8 (item 4 arrived truncated; item 8 is
  Phase 2).
- **L2:** Item 1 reproduced in code: `src/app/api/leads/route.ts` built one DTO with
  `status: data.status || 'Nuevo'` and `name: data.name || data.company`, and
  `upsertByExternalId` fed that DTO to `update()`, so every re-send reset the status.
- **L3:** `null` was also a hard 400 for every optional string, so a client sending
  JSON nulls for unknown fields could not integrate at all. Fixed with `.nullish()`
  and by treating `null` as "not sent".
- **L4:** `BaseRepository` now owns `resolveUserId()`/`scopeToUser()`; the lead, note,
  activity and pipeline repositories take the optional `scopedUserId` and filter
  every machine-path query by it.
- **L5 (verification):** `tsc --noEmit` clean; `jest` 115 suites / 848 tests pass;
  `eslint .` 0 errors, 12 pre-existing warnings. The regression test quoted in S1
  lives in `leadPayload.spec.ts` ("create with status Interesado, re-send without
  status keeps Interesado").
- **L6:** The first version of `src/app/api/activities/__tests__/route.spec.ts`
  replaced the file instead of extending it, dropping 2 GET tests. Restored them and
  kept the new POST cases in the same spec (T7).
- **L7:** Item 4 first arrived truncated ("the CRM uses other names, say which ones
  and Prospector maps to them"), so it was answered with the field name map only.
- **L9 (verbatim request):** "Un catálogo de estados. Hoy el estado es texto libre, así
  que uso Contactado, Respondió, Interesado, Retomar, Descartado y Rebotó. Si en tu CRM
  se llaman distinto, dime y los ajusto." and "updatedSince en GET /api/leads. Es lo
  que permitiría la vuelta: si en el CRM marcas a alguien como 'no contactar', el
  Prospector corta sus seguimientos."
- **L10:** Phase 2 stays out of scope as a full feature: this round ships the transport
  (`updatedSince`) and documents that a `No contactar` pipeline stage gives the
  distinction without a new column, since `Perdido` conflates discarded and bounced.
- **L8:** The full text of item 4 arrived later and asked for a status catalog. The
  valid values are the pipeline stage names, so `GET /api/leads/statuses` publishes
  them and `PATCH /api/leads/{id}/status` already validated against the same list.
  A `status` that matches no stage is stored but leaves `stage_id` NULL, so the
  mapping is documented: the client must map before sending.
- **L11 (verbatim request):** "Deja la Fase B apagada. Despliega solo la Fase A (catálogo,
  statusChangedAt, serverTime, sin rechazo). [...] 4. Recién ahí activas la Fase B, en su
  propio commit." and "¿Qué values vas a publicar y cuáles llevan doNotContact?"
- **L12:** The OpenCode session stopped at the free usage limit mid-edit, leaving a
  double-escaped string in the OpenAPI route. Fixed; `tsc --noEmit` clean; `jest` 117
  suites / 869 tests pass. The migration was not run against a database in this session.
