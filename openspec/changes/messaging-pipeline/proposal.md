# Proposal: Messaging Pipeline (Phases 1–3)

## Intent

Instagram DMs are stored as `activities` rows (`type='INSTAGRAM_MESSAGE'`) whose direction and
sender are encoded in the **title** (`Instagram DM from/to {id}`). This blocks deduplication (Meta's
`mid` is never stored, so a webhook retry duplicates the message), delivery statuses, the 24h
window, echoes from the native app, and any second channel. Port the messaging pipeline patterns
analysed in [`docs/mejoras-mensajeria-desde-builder-crm.md`](../../../docs/mejoras-mensajeria-desde-builder-crm.md)
into this repo's hexagonal architecture: dedicated messaging tables, a `MessagingChannel` port with a
Meta Instagram adapter, a single outbound path, and an idempotent, fast webhook.

Data-model decision (2026-11-03, `SDD-TRACKING.md` #4): **option (a)** — new tables and migrate the
existing `INSTAGRAM_MESSAGE` history. This supersedes the activities-as-message-store choice in
`openspec/changes/instagram-messaging/design.md`.

## Business Rules

- **BR-1** Messages live in `messages`, grouped by `conversations`; a conversation belongs to one
  channel account and one external participant (IGSID). `activities` are no longer the message store.
- **BR-2** Every inbound/outbound message from Meta carries its `mid` as `external_id`; a given
  `external_id` MUST exist at most once. A duplicate (including a unique-violation race) is a no-op.
- **BR-3** Every webhook delivery is claimed once in `webhook_events` (provider event id, or
  `sha:<sha256(body)>` when absent). A re-delivered event is acknowledged with 2xx and not reprocessed.
- **BR-4** The webhook verifies the HMAC signature and claims the event before responding; processing
  runs after the 2xx response. Events left in `received` are retried by a sweep, up to 3 attempts.
- **BR-5** Echoes (`is_echo: true`) are stored as `direction='out'`. An echo of a message the CRM
  itself sent MUST adopt that pending row (same conversation, same body, within 2 min) instead of
  creating a second one.
- **BR-6** All outbound messages go through one use case, `DeliverMessage`: optimistic row
  `status='pending'` → `sent` with `external_id`, or `failed` with the error and a readable hint.
- **BR-7** Every messaging row is owned by a `user_id`; RLS restricts reads/writes to
  `user_id = auth.uid()`. `webhook_events` is service-role only.
- **BR-8** Inbound messages update the conversation (`last_inbound_at`, `last_message_*`,
  `unread_count`). `last_inbound_at` is captured now so Phase 4 can enforce the 24h window.
- **BR-9** Migration copies existing `INSTAGRAM_MESSAGE` activities into `conversations`/`messages`
  (direction and IGSID parsed from the title, `external_id = null`). Legacy rows are **not deleted**
  in this change.

## Scope

**In** (Phases 1–3 of the analysis):

1. **Data model** — migration (14-digit name) creating `channel_accounts`, `conversations`,
   `messages`, `webhook_events` with RLS, indexes, partial unique index on `messages.external_id`,
   Realtime publication for `messages`/`conversations`; data migration of `INSTAGRAM_MESSAGE` history.
2. **Port and adapter** — `MessagingChannel` port, `MetaInstagramChannel` adapter (reusing the current
   Graph send logic), use cases `IngestInboundEvent` and `DeliverMessage`, typed `SendOutcome` with
   Graph error hints.
3. **Webhook** — HMAC verify → claim in `webhook_events` → 200 → background processing via the
   Workers execution context; retry sweep; echo processing; `mid` dedup.
4. **Readers repointed** — the existing send endpoints (`/api/instagram/send`,
   `/api/leads/[id]/instagram/send`), `InstagramAutoTrigger`, conversation/message reads
   (`/api/messages`, `/api/instagram/conversations`, `/api/leads/[id]/instagram/conversation`), the
   unread badge (`useUnreadCount`) and `/messages` page read and write the new tables, keeping the
   current UI behaviour.
5. OpenAPI docs and tests (TDD) for everything above.

**Out**: 24h window enforcement and `HUMAN_AGENT` tag (Phase 4); Messenger adapter (Phase 5 — the
port is designed for it); inbox redesign and splitting `messages/page.tsx` (Phase 6); AI agent
(Phase 7); WhatsApp; token encryption in `user_secrets`; delivery/read receipts and ad referrals
(the schema leaves room; processing comes later); deleting legacy `INSTAGRAM_MESSAGE` activities.

## Capabilities

> Contract for sdd-spec. No messaging spec exists yet; REST lives in `api-rest`.

- **New** `messaging-pipeline`: data model, ingest (dedup, echo adoption, conversation update),
  single delivery path, webhook idempotency and retry sweep, tenant isolation.
- **Modified** `api-rest`: Instagram send/conversation/messages endpoints read and write the new
  tables; response shapes preserved unless a spec says otherwise.
- **Modified** `activity-status`: `INSTAGRAM_MESSAGE` read/unread moves to `conversations.unread_count`
  / message read state; activities no longer drive the unread badge.

## Approach

1. Migration A (additive): tables, RLS, indexes, Realtime publication. No existing data touched.
2. Migration B (data copy): build `channel_accounts` from `user_secrets`, `conversations` per
   (user, IGSID) from activity titles, `messages` per activity; idempotent so it can be re-run.
3. Domain: `Conversation`, `Message` entities and `MessagingChannel`, `ConversationRepository`,
   `MessageRepository`, `WebhookEventRepository` ports in `src/core`; Supabase adapters in
   `src/infrastructure`.
4. Use cases `IngestInboundEvent` and `DeliverMessage`; `MetaInstagramChannel` wraps the existing
   Graph calls (`verifyWebhook`, `eventId`, `parse`, `send`).
5. Webhook route rewritten on top of the port: verify → claim → `waitUntil(process)` → 200; sweep
   endpoint protected by a secret, triggered by a Cron.
6. Readers and senders repointed; the lead timeline keeps one `activities` event per inbound message
   (shape to be fixed in design — see Open Questions).

## Affected Areas

| Area | Impact |
|------|--------|
| `supabase/migrations/<new>.sql` (×2) | New |
| `src/core/domain`, `src/core/ports`, `src/core/application/messaging` | New |
| `src/infrastructure/**` (repositories, `MetaInstagramChannel`) | New |
| `src/app/api/webhook/instagram/route.ts` | Rewritten |
| `src/app/api/instagram/{send,conversations}`, `src/app/api/leads/[id]/instagram/*`, `src/app/api/messages` | Modified |
| `src/modules/instagram/{InstagramAutoTrigger.ts,hooks/useUnreadCount.ts,components/*}` | Modified |
| `src/app/messages/page.tsx`, `src/app/(dashboard)/activities/ActivitiesList.tsx` | Modified |
| `src/modules/activities/**` (Instagram read/unread paths) | Modified |
| `wrangler` config (Cron Trigger) | Modified |
| `src/app/api/docs/openapi.json/route.ts` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Title parsing misses legacy rows during migration | Med | Idempotent migration + pre/post counts check; unmatched rows reported, not dropped |
| Webhook regression loses inbound DMs | Med | Claim-before-ack + sweep; tests for signature, duplicate, echo, retry |
| `waitUntil` unavailable or killed early on Workers | Low–Med | Verify in `@opennextjs/cloudflare` ^1.19.10 before design; sweep covers dropped work |
| Cron Trigger not supported directly by OpenNext worker | Med | Secret-protected sweep endpoint called by an external/Cloudflare cron |
| Unread badge / `/messages` regressions while readers move | Med | Readers repointed in the same change with existing specs kept green |
| Cross-tenant leakage via the single-user owner fallback | Low | Keep current behaviour, flag in design; RLS on every new table |

## Rollback Plan

The change is additive: legacy `INSTAGRAM_MESSAGE` activities are copied, never deleted or rewritten.
**Code rollback** = revert the code; the old routes keep reading activities. Messages received while
the new code was live exist only in `messages` unless the timeline event keeps the legacy shape
(see Open Questions) — the design MUST pick a timeline shape that keeps rollback lossless or provide a
reverse-copy script. **Full rollback** = follow-up migration dropping the four new tables.

## Dependencies

- `@opennextjs/cloudflare` execution context (`getCloudflareContext().ctx.waitUntil`) — verify.
- Meta webhook subscription already includes `messages`; `message_echoes` must be enabled.
- Reference patterns (not copied): `../builder-crm/src/lib/channels/{webhook,ingest,deliver}.ts`.

## Success Criteria

- [ ] A Meta webhook retry with the same `mid` produces exactly one message.
- [ ] A message sent from the native Instagram app appears in the CRM as outbound; a CRM-sent message
      is not duplicated by its echo.
- [ ] The webhook answers 2xx before processing; a crashed processing run is recovered by the sweep.
- [ ] All existing Instagram history is visible in `/messages` and lead conversations after migration.
- [ ] Unread badge, send dialogs and `InstagramAutoTrigger` keep working on the new tables.
- [ ] `pnpm test`, `npx tsc --noEmit`, `next lint`, `pnpm build` green.

## Open Questions

- ~~Lead timeline event shape~~ — **Decided 2026-11-03**: keep writing a legacy-shaped
  `INSTAGRAM_MESSAGE` activity during rollout (lossless rollback); removed in a later change.
- Conversation uniqueness: `(account_id, external_id)` rather than `(provider, external_id)` — IGSIDs
  are scoped per Instagram account. Assumed yes.
- Tokens stay in `user_secrets` for this change; `channel_accounts` references them. Assumed yes
  (encryption is a separate debt item).
- Retry sweep transport: Cron Trigger vs Cloudflare Queues. Assumed Cron + secret endpoint (simpler).
