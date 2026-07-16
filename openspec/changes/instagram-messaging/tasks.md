# Tasks: Instagram Messaging

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~800–900 (17 files + tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation → PR 2: Backend → PR 3: UI + Auto-Trigger |
| Delivery strategy | ask-always |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | DB migration + Lead domain + ActivityType + icons | PR 1 → main | Migration, domain model, enum, type updates |
| 2 | Auth + Messaging services + API routes + webhook | PR 2 → main | Depends on PR 1 for domain types |
| 3 | Send dialog + LeadWorkspace + auto-trigger | PR 3 → main | Depends on PR 2 for service layer |

## Phase 1: Foundation — DB + Domain + Activity Type

- [x] 1.1 Write migration: `ALTER TABLE leads ADD COLUMN` for `instagram_handle` + `instagram_scoped_id`, create `user_secrets` table with pgcrypto + RLS, extend `activities_type_check` constraint; integration test migration applies cleanly
- [x] 1.2 Add `instagramHandle?: string` + `instagramScopedId?: string` to `Lead` interface, `CreateLeadDTO`, and both Zod schemas in `LeadSchema.ts`; repository maps to snake_case columns
- [x] 1.3 Add `INSTAGRAM_MESSAGE = 'INSTAGRAM_MESSAGE'` to `ActivityType` enum; update `database.types.ts` with `UserSecretRow` type; add icon entry in `ActivityTypeIcon.tsx` and `ActivityItem.tsx`

## Phase 2: Backend — Services + API Routes + Webhook

- [x] 2.1 Create `InstagramAuthService.ts`: `getToken()`/`storeToken()`/`refreshToken()` with pgcrypto encrypt/decrypt; unit test mocks Supabase query and verifies decrypt path
- [x] 2.2 Create `InstagramMessagingService.ts`: `sendDM()`, `verifyMetaSignature()` (HMAC-SHA256 with `crypto.subtle`), `parseIncomingMessage()`; unit tests: mock fetch for DM call shape, known payload→true and tampered→false for signature verification
- [x] 2.3 Create webhook route `src/app/api/webhook/instagram/route.ts`: GET returns challenge on matching verify token (else 403), POST verifies HMAC signature then calls `parseIncomingMessage()` and creates Activity; test both paths
- [x] 2.4 Create `POST /api/leads/[id]/instagram/send`: resolve recipient by `instagramScopedId` (fallback to `instagramHandle`), call `sendDM()`, persist Activity; test API contract
- [x] 2.5 Create `GET /api/leads/[id]/instagram/conversation`: query `INSTAGRAM_MESSAGE` activities for lead, return ordered timeline; test returns filtered results
- [x] 2.6 Add env vars `TOKEN_ENCRYPTION_KEY`, `META_APP_SECRET`, `META_VERIFY_TOKEN` to `wrangler.toml`

## Phase 3: UI + Auto-Trigger

- [x] 3.1 Create `InstagramSendDialog.tsx`: textarea + send button, calls `POST /api/leads/[id]/instagram/send`, shows success/error state
- [x] 3.2 Add Instagram DM tab/button in `LeadWorkspace.tsx` that opens the send dialog; verify render
- [x] 3.3 Create `InstagramAutoTrigger.ts`: check status transition config, call messaging service if configured, log unsent if outside 24h window; unit test with mock service
- [x] 3.4 Hook auto-trigger in status route after status change succeeds; test that trigger fires on configured transitions

## Phase 4: Integration Verification

- [ ] 4.1 Integration: DM send flow creates Activity record with `INSTAGRAM_MESSAGE` type and IG metadata in `attachments` JSONB
- [ ] 4.2 Integration: webhook POST creates orphan Activity for unknown IGSID; `pnpm build` + `pnpm test` pass
