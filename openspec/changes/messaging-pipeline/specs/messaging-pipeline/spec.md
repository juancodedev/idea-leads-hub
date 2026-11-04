# Messaging Pipeline Specification

## Purpose

Dedicated storage and processing pipeline for channel messages (Instagram DM in this change;
Messenger and WhatsApp later). Messages are grouped into conversations per channel account and
external participant, deduplicated by the provider message id, ingested through an idempotent
webhook that acknowledges before processing, and sent through a single delivery use case. The
hexagonal boundary is a `MessagingChannel` port with one Meta Instagram adapter.

## Glossary

- **Channel account**: one connected sender identity (an Instagram business account), owned by a user.
- **Participant**: the external person (IGSID) on the other side of a conversation.
- **`mid`**: Meta's message id; stored as `messages.external_id`.
- **Echo**: a webhook `messaging` entry with `message.is_echo = true` — a message sent *from* the
  channel account, by the CRM or by the native Instagram app.
- **Legacy activity**: an `activities` row with `type='INSTAGRAM_MESSAGE'` and title
  `Instagram DM from {igsid}` (inbound) or `Instagram DM to {igsid}` (outbound).

## ADDED Requirements

### Requirement: Messaging data model (BR-1, BR-7)

The system MUST persist messaging data in four tables, all created by a 14-digit-named migration:

| Table | Key constraints |
|-------|-----------------|
| `channel_accounts` | `user_id` NOT NULL; `channel` ∈ {`instagram`,`messenger`,`whatsapp`}; UNIQUE (`channel`, `external_account_id`) |
| `conversations` | `user_id`, `account_id`, `channel`, `external_id` NOT NULL; `lead_id` nullable; UNIQUE (`account_id`, `external_id`); `unread_count` ≥ 0 default 0; `metadata` jsonb default `{}` |
| `messages` | `user_id`, `conversation_id` NOT NULL (cascade delete); `direction` ∈ {`in`,`out`}; `origin` ∈ {`human`,`agent`,`template`,`auto`} or null; `status` ∈ {`received`,`pending`,`sent`,`delivered`,`read`,`failed`}; partial UNIQUE on `external_id` WHERE NOT NULL; index (`conversation_id`, `created_at`) |
| `webhook_events` | PK `event_id`; `status` ∈ {`received`,`processed`,`ignored`,`failed`}; `attempts` ≥ 0; `payload` jsonb NOT NULL; index (`status`, `received_at`) |

RLS MUST be enabled on all four tables. `channel_accounts`, `conversations` and `messages` MUST
allow select/insert/update/delete only where `user_id = auth.uid()`, and inserts/updates MUST also
reject a referenced `account_id`, `lead_id` or `conversation_id` that the user does not own.
`webhook_events` MUST have no policy for `authenticated`/`anon` (service role only). Processed and
ignored webhook events MUST be deleted after 30 days. `messages` and `conversations` MUST be added
to the `supabase_realtime` publication.

#### Scenario: Owner isolation

- GIVEN user A owns a conversation and its messages
- WHEN user B queries `conversations` or `messages` with an authenticated client
- THEN no rows of user A are returned

#### Scenario: Cannot attach rows to another user's conversation

- GIVEN user B knows the id of a conversation owned by user A
- WHEN user B inserts a message with that `conversation_id` using an authenticated client
- THEN the insert is rejected by RLS

#### Scenario: Webhook events are not client-readable

- GIVEN any authenticated user
- WHEN they select from `webhook_events`
- THEN zero rows are returned

#### Scenario: Duplicate external id rejected by the database

- GIVEN a message with `external_id = 'm_1'`
- WHEN another row with `external_id = 'm_1'` is inserted
- THEN the insert fails with unique violation `23505`

#### Scenario: Null external ids do not collide

- GIVEN two messages with `external_id = null`
- WHEN both are inserted
- THEN both rows exist

### Requirement: MessagingChannel port

The system MUST define a `MessagingChannel` port in `src/core/ports` with `channel`,
`verifyWebhook(rawBody, headers)`, `eventId(payload, rawBody)`, `parse(payload)` and
`send(ctx, message)`. `send` MUST NOT throw: it returns `SendOutcome` = `{ ok: true, externalId }`
or `{ ok: false, error, hint }`. `parse` MUST return zero or more `InboundEvent`s of kind
`message` or `echo`; unsupported entries MUST be skipped without failing the batch.
`MetaInstagramChannel` MUST implement the port reusing the current Graph send and HMAC logic.
Domain and application code MUST NOT import infrastructure.

#### Scenario: Send failure is a value, not an exception

- GIVEN Graph responds 400 with error code 190
- WHEN `MetaInstagramChannel.send` is called
- THEN it resolves `{ ok: false, error, hint }` where `hint` says the token expired and must be reconnected

#### Scenario: Network failure is a value

- GIVEN the Graph request rejects (network error or timeout)
- WHEN `send` is called
- THEN it resolves `{ ok: false, ... }` and does not throw

#### Scenario: Both Meta webhook shapes parsed

- GIVEN a payload using `entry[].messaging[]` and one using `entry[].changes[]`
- WHEN `parse` is called on each
- THEN both yield the same `InboundEvent` fields (account id, participant id, `mid`, text, timestamp, kind)

#### Scenario: Echo classified

- GIVEN a `messaging` entry with `message.is_echo = true`
- WHEN `parse` is called
- THEN it yields kind `echo` with the participant taken from `recipient.id`

### Requirement: Webhook acknowledgement and idempotency (BR-3, BR-4)

`POST /api/webhook/instagram` MUST, in order: read the raw body; verify `X-Hub-Signature-256`
(fail closed with 401 when the signature is missing, invalid, or the app secret is not configured);
derive the event id (provider id when present, else `sha:<sha256(rawBody)>`); claim it with a single
insert into `webhook_events` that does nothing on conflict; respond 200; and process the event in
the background through the Workers execution context. A conflicting (already claimed) event MUST be
answered 200 without processing. If the claim insert itself fails, the route MUST answer 500 so
Meta retries. The `GET` verification handshake MUST keep its current behaviour.

#### Scenario: Valid event acknowledged before processing

- GIVEN a correctly signed payload not seen before
- WHEN Meta posts it
- THEN a `webhook_events` row with `status='received'` exists, the response is 200, and processing is scheduled after the response

#### Scenario: Re-delivered event is ignored

- GIVEN an event id already present in `webhook_events`
- WHEN Meta posts the same payload again
- THEN the response is 200 and no message, conversation or activity is created or updated

#### Scenario: Bad signature

- GIVEN a payload whose signature does not match
- WHEN it is posted
- THEN the response is 401 and nothing is written

#### Scenario: Missing app secret fails closed

- GIVEN the app secret is not configured
- WHEN any payload is posted
- THEN the response is 401 and nothing is written

#### Scenario: Claim storage unavailable

- GIVEN the `webhook_events` insert fails with a database error
- WHEN a signed payload is posted
- THEN the response is 500

### Requirement: Event processing outcome and retry sweep (BR-4)

Processing MUST end the event as `processed` (something was stored), `ignored` (nothing applicable,
e.g. unknown account), or remain `received` with `attempts` incremented when a retryable error
occurs; after the third failed attempt it MUST become `failed`. A sweep MUST reprocess events in
`received` older than 2 minutes with `attempts < 3`, at most 5 per run; incrementing `attempts` and
selecting an event MUST be atomic so overlapping runs never process the same event concurrently. The
sweep MUST be exposed as a secret-protected endpoint (401 without the secret) and triggered on a
schedule.

#### Scenario: Overlapping sweeps

- GIVEN one stuck event and two sweep runs starting at the same time
- WHEN both run
- THEN only one of them processes the event and `attempts` increases by exactly 1

#### Scenario: Crashed processing is recovered

- GIVEN an event stuck in `received` for more than 2 minutes with `attempts = 1`
- WHEN the sweep runs
- THEN the event is processed and ends `processed`, with exactly one message stored

#### Scenario: Retries are bounded

- GIVEN an event whose processing fails every time
- WHEN it has been attempted 3 times
- THEN its status is `failed` and the sweep no longer picks it up

#### Scenario: Sweep requires the secret

- GIVEN a request to the sweep endpoint without the configured secret
- WHEN it is called
- THEN the response is 401 and no event is processed

### Requirement: Inbound ingest (BR-2, BR-8)

`IngestInboundEvent` MUST, for each `message` event: resolve the channel account by
`external_account_id` (unknown account → event `ignored`); find or create the conversation by
(`account_id`, participant id) without failing when another run creates it concurrently, linking
`lead_id` when a lead with that `instagram_scoped_id` exists for the same user; skip the event when a
message with the same `external_id` already exists (a `23505` on insert MUST be treated as that
duplicate); otherwise insert a `direction='in'`, `status='received'` message and update the
conversation: `last_inbound_at`, `last_message_at`, `last_message_preview` and `unread_count + 1`.
The message insert, the conversation update and the legacy activity write MUST happen in one
transaction: either all of them are stored or none. Non-text attachments MUST store a placeholder body
(e.g. `[imagen]`) and the full entry in `raw_payload`.

#### Scenario: Same mid twice

- GIVEN an inbound message with `mid = 'm_1'` was already ingested
- WHEN a different webhook event carries `mid = 'm_1'` again
- THEN there is still exactly one message and `unread_count` did not increase

#### Scenario: Concurrent duplicate

- GIVEN two processing runs insert `mid = 'm_1'` at the same time
- WHEN the second gets `23505`
- THEN it finishes without error and without a second message

#### Scenario: Crash after the message insert

- GIVEN a processing run fails after inserting an inbound message but before finishing
- WHEN the event is retried
- THEN either the message, its counter update and its legacy activity all exist, or none do and the retry stores all three

#### Scenario: Two first messages at once

- GIVEN no conversation exists for (account, IGSID `123`)
- WHEN two events from `123` are processed concurrently
- THEN one conversation exists, both messages are stored and no event consumed a retry attempt

#### Scenario: New participant

- GIVEN no conversation exists for (account, IGSID `123`)
- WHEN an inbound message from `123` is ingested
- THEN one conversation is created with `unread_count = 1` and `last_inbound_at` = message timestamp

#### Scenario: Lead linked by scoped id

- GIVEN a lead of the account owner has `instagram_scoped_id = '123'`
- WHEN the first message from `123` is ingested
- THEN the conversation has that `lead_id`

#### Scenario: Attachment without text

- GIVEN an inbound message with only an image attachment
- WHEN it is ingested
- THEN the message body is a placeholder, `type` reflects the attachment and `raw_payload` holds the entry

### Requirement: Echo handling (BR-5)

For each `echo` event the system MUST: skip it when its `mid` already exists; otherwise adopt the
most recent `direction='out'` message in the same conversation with `external_id IS NULL`,
`status` `pending` or `failed`, the same body, created within the 2 minutes before the **echo event's
timestamp** (not the processing time), by setting its `external_id`, `status='sent'` and clearing
`error_message`/`hint`; otherwise insert a new `direction='out'`, `origin='human'`, `status='sent'`
message. Every message that ends `sent` through an echo MUST have exactly one legacy activity. Echoes
MUST NOT change `last_inbound_at` or `unread_count`.

#### Scenario: Echo of a CRM-sent message

- GIVEN the CRM sent "Hola" 30 s ago and its row has no `external_id` yet
- WHEN the echo for "Hola" arrives with `mid = 'm_9'`
- THEN that row gets `external_id = 'm_9'` and no second outbound row exists

#### Scenario: Message sent from the native app

- GIVEN no matching pending row exists
- WHEN an echo arrives for a message typed in the Instagram app
- THEN a new outbound message is stored and appears in the conversation

#### Scenario: Echo retried by the sweep

- GIVEN the CRM sent "Hola" and its echo event failed transiently
- WHEN the sweep reprocesses the echo 4 minutes later
- THEN the pending row is adopted (the window is measured from the echo timestamp) and no second outbound row exists

#### Scenario: Echo of a send that timed out on our side

- GIVEN a CRM send was marked `failed` by a timeout but Meta delivered it
- WHEN its echo arrives within the window
- THEN the row becomes `sent` with the `mid`, `error_message` and `hint` are cleared, and it has one legacy activity

#### Scenario: Echo after a successful send already stored the mid

- GIVEN `DeliverMessage` stored `external_id = 'm_9'`
- WHEN the echo with `mid = 'm_9'` arrives
- THEN nothing changes

### Requirement: Single delivery path (BR-6)

`DeliverMessage` MUST be the only code path that sends a channel message. It MUST insert a
`direction='out'`, `status='pending'` message with an `origin` before calling the channel, then
update it to `sent` with `external_id`, or `failed` with `error_message` and the outcome's `hint`.
If an echo already made the row `sent`, the success update MUST NOT change it, and a failure outcome
MUST NOT downgrade it; the row MUST still end with exactly one legacy activity.
It MUST return the final message. It MUST update `last_message_at`/`last_message_preview` of the
conversation on success. The send endpoints and `InstagramAutoTrigger` MUST use it.

#### Scenario: Successful send

- GIVEN a conversation and a working channel
- WHEN `DeliverMessage` sends "Hola"
- THEN the stored message ends `status='sent'` with the Graph `message_id` as `external_id`

#### Scenario: Failed send keeps a visible record

- GIVEN Graph rejects the message
- WHEN `DeliverMessage` runs
- THEN the message ends `status='failed'` with `error_message` and a readable hint, and the caller receives it

#### Scenario: Auto trigger uses the same path

- GIVEN `InstagramAutoTrigger` fires for a lead
- WHEN it sends
- THEN the message is stored with `origin='auto'` through `DeliverMessage`

### Requirement: Legacy timeline activity during rollout (rollback safety)

While this change is live, every stored inbound message and every sent outbound message MUST also
write one legacy activity (same `type`, title format, `lead_id` and `user_id` as today), so that
reverting the code loses no message. Duplicate inbound events (same `mid`) MUST NOT write a second
legacy activity. Removing the legacy write is a follow-up change.

#### Scenario: Inbound writes one legacy activity

- GIVEN a new inbound message from `123` is ingested
- WHEN processing finishes
- THEN exactly one activity `Instagram DM from 123` exists for it

#### Scenario: Rollback shows recent messages

- GIVEN messages were received while the new code was live
- WHEN the code is reverted to the previous version
- THEN those messages are visible in the old `/messages` page

### Requirement: History migration (BR-9)

A data migration MUST copy every legacy activity into the new model through a backfill that can be
invoked again after deploy: one `channel_accounts` row per user with Instagram credentials in
`user_secrets`, and a `disconnected` placeholder account for users with legacy activities but no
credentials; one conversation per (user, IGSID parsed from the title); one message per activity with `direction` from the title (`from` → `in`, `to` → `out`),
`body` from the activity details, `created_at` preserved, `external_id = null`, `status` `received`
or `sent`. `unread_count` MUST equal the number of copied inbound messages with `read_at IS NULL`;
`last_inbound_at`, `last_message_at` and `last_message_preview` MUST be derived from the copied rows,
and a re-run MUST only add what it copies in that run (never overwrite counters changed by live
traffic). The migration MUST be idempotent and MUST NOT modify or delete legacy activities.
Activities whose title does not match either format MUST be left uncopied. The backfill MUST report
counts for copied, already copied, unparseable and placeholder-account rows.

#### Scenario: User without credentials

- GIVEN a user has legacy Instagram activities but no Instagram credentials in `user_secrets`
- WHEN the backfill runs
- THEN their messages are copied under a `disconnected` placeholder account and counted as such

#### Scenario: Catch-up after deploy does not lose live counts

- GIVEN the new code incremented `unread_count` for a conversation after the first backfill
- WHEN the backfill is invoked again
- THEN that `unread_count` only grows by the unread rows copied in this run

#### Scenario: Counts preserved

- GIVEN N legacy activities with a parseable title
- WHEN the migration runs
- THEN exactly N messages exist, each linked to the conversation of its IGSID

#### Scenario: Re-run is a no-op

- GIVEN the migration already ran
- WHEN it runs again
- THEN no extra conversations or messages are created

#### Scenario: Unparseable title

- GIVEN a legacy activity titled `Instagram DM` (no id)
- WHEN the migration runs
- THEN it is not copied, it is counted in the migration notice, and the activity is unchanged

#### Scenario: Unread preserved

- GIVEN a participant has 2 unread and 3 read inbound legacy messages
- WHEN the migration runs
- THEN the conversation has `unread_count = 2`
