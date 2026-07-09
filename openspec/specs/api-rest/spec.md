# api-rest Specification

## Purpose

Document the REST API contract for Profile, Tags, Notes, Ideas, Activities, Pipeline + Stages, and Leads. All endpoints serve JSON and require JWT unless noted.

## Requirements

### Shared: Auth & Error Handling

Every endpoint MUST reject unauthenticated calls with 401. The system MUST map NotFoundError → 404, ConflictError → 409, UnauthorizedError → 401, DatabaseError → 500, ZodError → 400.

#### Scenario: Unauthenticated request

- GIVEN no valid session cookie
- WHEN any authenticated endpoint is called
- THEN the API responds 401

#### Scenario: Validation failure

- GIVEN a request with invalid body
- WHEN parsed via Zod
- THEN the API responds 400 with Zod error details

#### Scenario: Resource not found

- GIVEN a request referencing a non-existent ID
- WHEN the endpoint executes
- THEN the API responds 404

### Profile

| Method | Path | Status |
|--------|------|--------|
| GET | /api/profile | 200 |
| PUT | /api/profile | 200 |

### Tags

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | /api/tags | 200 | List all |
| POST | /api/tags | 201 | Create (name, color) |
| DELETE | /api/tags/[id] | 204 | |
| POST | /api/tags/assign | 200 | Body: tagId, entityId, entityType |
| POST | /api/tags/remove | 200 | Body: tagId, entityId, entityType |

### Notes

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | /api/notes | 200 | Query: entityId + entityType |
| POST | /api/notes | 201 | Body: content, entityId, entityType |
| PATCH | /api/notes/[id] | 200 | |
| DELETE | /api/notes/[id] | 204 | |

### Ideas

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | /api/ideas | 200 | Filters: status, leadId |
| GET | /api/ideas/[id] | 200 | |
| POST | /api/ideas | 201 | Fields: title, description, leadId |
| PATCH | /api/ideas/[id] | 200 | |
| PATCH | /api/ideas/[id]/status | 200 | Transition status |
| DELETE | /api/ideas/[id] | 204 | |

#### Scenario: Filter by status

- GIVEN a valid session
- WHEN GET /api/ideas?status=active
- THEN 200 with only matching ideas

#### Scenario: Status transition

- GIVEN an existing idea
- WHEN PATCH /api/ideas/[id]/status with valid status
- THEN 200 with updated idea

### Activities

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | /api/activities | 200 | Filters: leadId, ideaId |
| GET | /api/activities/[id] | 200 | |
| POST | /api/activities | 201 | |
| PATCH | /api/activities/[id] | 200 | |
| PATCH | /api/activities/[id]/complete | 200 | Mark complete |
| DELETE | /api/activities/[id] | 204 | |

#### Scenario: Complete activity

- GIVEN a pending activity
- WHEN PATCH /api/activities/[id]/complete
- THEN 200 with completed activity

#### Scenario: Filter by lead

- GIVEN a valid session
- WHEN GET /api/activities?leadId=abc
- THEN 200 with only activities for that lead

### Pipelines

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | /api/pipelines | 200 | |
| GET | /api/pipelines/[id] | 200 | Includes stages |
| POST | /api/pipelines | 201 | |
| PATCH | /api/pipelines/[id] | 200 | |
| DELETE | /api/pipelines/[id] | 204 | Cascade deletes stages |

### Stages (nested under Pipelines)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | /api/pipelines/[id]/stages | 200 | |
| POST | /api/pipelines/[id]/stages | 201 | Create (name, order) |
| PATCH | /api/pipelines/[id]/stages/[stageId] | 200 | |
| DELETE | /api/pipelines/[id]/stages/[stageId] | 204 | |
| PUT | /api/pipelines/[id]/stages/reorder | 200 | Body: ordered stageId[] |

#### Scenario: Reorder stages

- GIVEN a stage ID array in new order
- WHEN PUT /api/pipelines/[id]/stages/reorder
- THEN 200

#### Scenario: Pipeline with stages

- GIVEN an existing pipeline with stages
- WHEN GET /api/pipelines/[id]
- THEN 200 including stages array

### Leads (expanded)

New endpoints use English fields. Existing POST /api/leads keeps Spanish fields unchanged.

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | /api/leads | 200 | |
| GET | /api/leads/[id] | 200 | |
| PATCH | /api/leads/[id] | 200 | English fields |
| PATCH | /api/leads/[id]/status | 200 | Body: stageId |
| DELETE | /api/leads/[id] | 204 | |

#### Scenario: Update lead in English

- GIVEN an existing lead
- WHEN PATCH /api/leads/[id] with English-field payload
- THEN 200 with updated lead

### Backward Compatibility

Existing POST /api/leads MUST work unchanged with Spanish fields (empresa, origen, etc.).

#### Scenario: Existing route intact

- GIVEN a valid session
- WHEN POST /api/leads with Spanish-field body
- THEN 201 — identical to pre-change behavior
