# Delta for api-rest

## ADDED Requirements

### Requirement: Messaging endpoints on the new model

The Instagram messaging endpoints MUST read and write `conversations`/`messages` instead of
`activities`, and MUST keep their current paths, auth, status codes and response field names so the
existing UI keeps working. New fields MAY be added (`status`, `direction`, `error_message`).
A `key` resolves to a set of conversations: `lead:<id>` = every conversation of that lead;
`unlinked:<igsid>` = conversations with that participant and no lead. GET, read, DELETE and link act
on the whole set, as today's endpoints act on all matching activities.

| Method | Path | Behaviour after this change |
|--------|------|-----------------------------|
| POST | /api/instagram/send | Sends through `DeliverMessage`; 200 on `sent`, 502 on `failed` with `{ error, hint }` |
| POST | /api/leads/[id]/instagram/send | Same, for the lead's conversation (created when missing). Current recipient resolution is kept unchanged: 404 lead not found; 400 with `needsManualId` when the handle cannot be resolved; 400 when the lead has no Instagram identifier |
| GET | /api/instagram/conversations | Lists the user's conversations ordered by `last_message_at` desc |
| GET | /api/leads/[id]/instagram/conversation | Messages of the lead's conversation ordered by `created_at` |
| GET | /api/messages | Messages from `messages`, same `key` filter as today |
| DELETE | /api/messages | Deletes the conversation (cascade) and its legacy activities |
| PATCH | /api/messages | Links the conversation and its legacy activities to a lead; same response |
| PATCH | /api/messages/read | **New.** Body `{ key }`; sets `unread_count = 0` and `read_at` on the legacy activities |
| GET | /api/activities/unread | Same path and `{ count }`; returns the sum of `conversations.unread_count` |
| POST | /api/webhook/instagram | Verify → claim → 200 → background processing (see `messaging-pipeline`) |
| GET | /api/webhook/instagram/sweep | Secret-protected retry sweep; 401 without the secret |

#### Scenario: Send failure surfaces the hint

- GIVEN Graph rejects a send with an expired token
- WHEN POST /api/instagram/send is called
- THEN the response is 502 with `error` and `hint`, and the failed message is visible in the conversation

#### Scenario: Conversation read keeps its shape

- GIVEN a lead with migrated history
- WHEN GET /api/leads/[id]/instagram/conversation
- THEN 200 with the same field names as before, ordered oldest to newest, including messages received after the migration

#### Scenario: Lead with two conversations

- GIVEN a lead linked to two conversations with 1 and 2 unread messages
- WHEN the inbox loads, then `PATCH /api/messages/read` with `lead:<id>`, then `DELETE /api/messages` with `lead:<id>`
- THEN the inbox shows one entry with `unreadCount = 3`; after read both conversations have 0; after delete both conversations, their messages and the lead's legacy Instagram activities are gone

#### Scenario: Unauthenticated access

- GIVEN no session
- WHEN any of the endpoints above except the webhook and sweep is called
- THEN 401

### Requirement: OpenAPI documentation of the messaging surface

The system MUST document every endpoint added or modified by this change, and the `Conversation`,
`Message` and `SendOutcome` schemas, in `src/app/api/docs/openapi.json/route.ts`.

#### Scenario: Sweep documented

- GIVEN the sweep endpoint is implemented
- WHEN the change ships
- THEN it appears in openapi.json with its 401 response
