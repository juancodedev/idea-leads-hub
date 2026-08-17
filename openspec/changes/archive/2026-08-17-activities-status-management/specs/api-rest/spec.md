# Delta for api-rest

## ADDED Requirements

### Requirement: OpenAPI documentation of activity status surface

The system MUST document every endpoint added or modified by this change in the manual spec at `src/app/api/docs/openapi.json/route.ts`, including the new `ActivityStatus` schema and request/response models. (Convention: OpenAPI is maintained by hand in the same change.)

#### Scenario: New endpoint documented

- GIVEN `PATCH /api/activities/[id]/status` is implemented
- WHEN the change ships
- THEN the route exists in openapi.json with the `ActivityStatus` enum in schema

## MODIFIED Requirements

### Requirement: Activities

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | /api/activities | 200 | Filters: leadId, ideaId, status |
| GET | /api/activities/[id] | 200 | |
| POST | /api/activities | 201 | |
| PATCH | /api/activities/[id] | 200 | No `completed` field during rollout |
| PATCH | /api/activities/[id]/status | 200 | Body: { status } — free transition |
| PATCH | /api/activities/[id]/complete | 200 | Marks complete (syncs status=COMPLETED) |
| PATCH | /api/activities/[id]/read | 200 | Marks read (`read_at`); no status change |
| GET | /api/activities/unread | 200 | Unread count: INSTAGRAM_MESSAGE with `read_at` null |
| DELETE | /api/activities/[id] | 204 | |

(Previously: no status/read/unread endpoints; `/read` and `/unread` used the binary `completed` flag.)

#### Scenario: Complete activity

- GIVEN a pending activity
- WHEN PATCH /api/activities/[id]/complete
- THEN 200 with a completed activity whose `status=COMPLETED` (dual-write kept consistent)

#### Scenario: Filter by lead

- GIVEN a valid session
- WHEN GET /api/activities?leadId=abc
- THEN 200 with only activities for that lead

#### Scenario: Status transition

- GIVEN an existing owned activity
- WHEN PATCH /api/activities/[id]/status with a valid `ActivityStatus`
- THEN 200 with the updated activity and consistent `completed` dual-write

#### Scenario: Invalid status rejected

- GIVEN a valid session
- WHEN PATCH /api/activities/[id]/status with a value outside the enum
- THEN 400 with Zod error details

#### Scenario: Mark read does not complete

- GIVEN an `INSTAGRAM_MESSAGE` with `status=PENDING`
- WHEN PATCH /api/activities/[id]/read
- THEN 200 and `read_at` is set while `status` and `completed` are unchanged

#### Scenario: Unread uses read marker

- GIVEN read and unread Instagram messages
- WHEN GET /api/activities/unread
- THEN 200 with the count of rows whose `read_at` is null

#### Scenario: Patch by id drops completed write path

- GIVEN an existing activity
- WHEN PATCH /api/activities/[id] with a body containing `completed`
- THEN 200 with other fields updated and `completed`/`status` untouched (field ignored)

> **Contract note (silent strip, no `.strict()`):** the update body is parsed
> with a plain `z.object(...)` schema, so unknown keys are silently stripped —
> a `completed` field in the payload is ignored without an error, and neither
> `completed` nor `status` is mutated. This is deliberate: status transitions
> go through the status surface (`PATCH /status`, `moveStatus`), and throwing
> on a legacy `completed` payload would break older clients during rollout.
> A `.strict()` rejection was considered and rejected for that reason.