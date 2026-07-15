# Proposal: Instagram Messaging

## Intent

Add two-way Instagram DM capability to the CRM — send messages from the lead detail page and receive incoming messages via webhook, all logged as conversation history. The user avoids monthly ManyChat costs by using Meta's free Instagram Messaging API directly.

## Scope

### In Scope

- `instagramHandle` field on Lead entity (domain model + DB + API)
- Meta API auth: long-lived Page Access Token management, Instagram Professional account linking
- Send DM: button + textarea on lead detail page → POST `/me/messages`
- Webhook receiver: receive incoming messages → persist as Activity with new `INSTAGRAM_MESSAGE` type
- Conversation timeline: show DM history inside the existing Activity feed
- Auto-trigger: send predefined message on lead status change (e.g., NUEVO → "Gracias por tu interés")
- ActivityType enum: add `INSTAGRAM_MESSAGE` value

### Out of Scope

- Third-party platforms (ManyChat, etc.)
- Broadcast/mass messaging campaigns
- Instagram Stories or Comments replies
- Multiple Instagram accounts per user
- Message templates / rich media (carousels, stickers)

## Capabilities

### New Capabilities

- `instagram-connection`: Meta App creation, `instagram_manage_messages` + `pages_manage_metadata` permissions, long-lived Page Access Token exchange, Instagram Business Account ID discovery, webhook verify token + subscription setup
- `instagram-messaging`: Send DM via `POST /<IG_ID>/messages`, receive messages via webhook `POST /webhook/instagram`, map to Activity (type `INSTAGRAM_MESSAGE`), conversation thread UI on lead detail, 24h messaging window enforcement, auto-trigger on status change

### Modified Capabilities

- `api-rest`: Add `instagramHandle` to Lead schema (domain + API PATCH), add `POST /api/leads/[id]/instagram/send` endpoint, add `GET /api/leads/[id]/instagram/conversation` endpoint, add `POST /api/webhook/instagram` (no auth — Meta signature verification)

## Approach

1. **Lead model**: Add `instagramHandle?: string` to `Lead` entity, Zod schema, DB migration (nullable text column)
2. **Meta auth layer**: New `infrastructure/services/InstagramAuthService.ts` — handles token exchange, refresh, and storage in encrypted env vars or Supabase secrets table
3. **Messaging service**: `infrastructure/services/InstagramMessagingService.ts` — wraps Meta API calls
4. **API routes**: `POST /api/leads/[id]/instagram/send` — send DM; `GET /api/leads/[id]/instagram/conversation` — fetch messages (from DB); `POST /api/webhook/instagram` — Meta callback
5. **Activity integration**: Extend `ActivityType` enum → `INSTAGRAM_MESSAGE`, map webhook payloads to Activity records
6. **UI**: "Send Instagram DM" button + dialog on lead detail page; auto-refresh conversation thread in activity section
7. **Auto-trigger**: Hook into lead status change use case → optional DM send with status-specific template message
8. **Webhook on Cloudflare**: Public endpoint at `/api/webhook/instagram` needs a route that Cloudflare Workers can serve + verify Meta signature

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/core/domain/Lead.ts` | Modified | Add `instagramHandle?: string` |
| `src/core/domain/LeadSchema.ts` | Modified | Add Instagram field to Zod schemas |
| `src/infrastructure/services/` | New | InstagramAuthService + InstagramMessagingService |
| `src/app/api/leads/[id]/instagram/` | New | Send + conversation routes |
| `src/app/api/webhook/instagram/route.ts` | New | Meta webhook receiver |
| `src/modules/activities/domain/enums/ActivityType.ts` | Modified | Add `INSTAGRAM_MESSAGE` |
| `src/modules/activities/` | Modified | Handle new activity type in UI |
| `src/modules/leads/components/` | Modified | Add Instagram send button/dialog |
| `supabase/` | Modified | DB migration for `instagram_handle` column |
| `wrangler.toml` | Modified | Add Instagram token env vars |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Meta API rate limits | Low | 200 msgs/user/day limit; store send timestamps, throttle |
| Webhook signature verification | Low | Implement Meta's `sha256` verification; test with dev app first |
| 24h messaging window blocks follow-ups | Medium | Use `ACCOUNT_UPDATE` tag for auto-triggers; log unsent attempts |
| Token expiry | Medium | Implement refresh before each send; alert if refresh fails |
| Cloudflare Workers + webhooks | Low | Use `apiHandler` pattern; webhook route bypasses auth middleware |

## Rollback Plan

- **DB**: Revert migration (DROP COLUMN `instagram_handle`)
- **Code**: Revert route files under `instagram/`, delete service files, revert `ActivityType` enum
- **Meta**: Disconnect Instagram account, revoke Page Access Token from Meta Developer Portal
- Full revert is additive-only (no destructive drops on production data)

## Dependencies

- Instagram Professional (Business or Creator) account linked to a Facebook Page
- Meta Developer App with `instagram_manage_messages` + `pages_manage_metadata` permissions
- Cloudflare Workers with `nodejs_compat` flag (already set in `wrangler.toml`)

## Success Criteria

- [ ] Lead form includes optional `instagramHandle` field; data persists to DB
- [ ] Send DM from lead detail page → message arrives on Instagram within 5s
- [ ] Incoming DM via webhook → appears in activity feed within 10s
- [ ] Status-change auto-trigger sends predefined DM for configured transitions
- [ ] `pnpm test` passes (new + existing tests)
- [ ] `pnpm build` passes
