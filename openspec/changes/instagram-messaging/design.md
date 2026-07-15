# Design: Instagram Messaging

## Technical Approach

Add Instagram DM capability to the CRM by (1) extending the Lead domain model with `instagramHandle`, (2) building a Meta API service layer for auth and messaging, (3) adding webhook receiver that maps messages to Activity records, and (4) integrating the conversation flow into the existing lead detail UI. All Meta API interactions go through `infrastructure/services/`; the webhook endpoint lives at `src/app/api/webhook/instagram/route.ts` and naturally bypasses auth middleware (the matcher already excludes `/api/*`).

## Architecture Decisions

### Decision: Token Storage

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Env var (`wrangler.toml`) | Per-user impossible, requires redeploy on rotation | ❌ |
| New `user_secrets` table | More schema surface, clean separation | ✅ |
| Encrypted column in `profiles` | Simpler, fewer migrations, one extra nullable col | ❌ |

**Choice**: New `user_secrets` table with `user_id`, `instagram_token` (encrypted at rest via Supabase pgcrypto), `instagram_ig_id`, `instagram_page_id`, `expires_at`.
**Rationale**: Tokens are sensitive and per-user; a dedicated table avoids bloating profiles, supports future secret types (other integrations), and allows TTL-based expiry checks. pgcrypto's `pgp_sym_encrypt/decrypt` with a `TOKEN_ENCRYPTION_KEY` env var provides encryption at rest.

### Decision: Webhook Signature Verification

| Option | Tradeoff | Decision |
|--------|----------|----------|
| crypto.subtle (Web Crypto API) | Works in Workers runtime, no deps | ✅ |
| Node.js `crypto` module | `nodejs_compat` flag exists but not idiomatic | ❌ |
| Skip verification | Insecure | ❌ |

**Choice**: `crypto.subtle.verify()` with HMAC-SHA256 of `payload + app_secret`.
**Rationale**: Workers have Web Crypto API natively; no extra imports. Matches Meta's documented `sha256` of `{payload}{app_secret}`.

### Decision: Activity Integration

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New `instagram_messages` table + Activity reference | Over-normalized, two queries to render timeline | ❌ |
| Single Activity with `INSTAGRAM_MESSAGE` type | Leverages existing ActivityTable, RLS, UI | ✅ |
| New `conversation_messages` table | Separate from CRM activities | ❌ |

**Choice**: Represent Instagram DMs as Activities with `type: 'INSTAGRAM_MESSAGE'`. Store IG sender ID, IG message ID, and direction (inbound/outbound) in `attachments` JSONB.
**Rationale**: Activities already have `lead_id`, `type`, `description`, timestamps, and render in the lead activity timeline. Adding `INSTAGRAM_MESSAGE` to the existing enum and mapper is ~15 lines. The `attachments` JSONB column stores Meta's message metadata without schema changes.

### Decision: Webhook Bypasses Auth

**Choice**: Route at `src/app/api/webhook/instagram/route.ts` — the middleware matcher already excludes `/api/*` paths, so no additional config needed. The handler uses a separate `verifyMetaWebhook()` function that only validates the `META_VERIFY_TOKEN` (GET) or HMAC signature (POST).
**Rationale**: Simpler than adding an exception to middleware; the existing matcher pattern already covers it.

## Data Flow

```
Meta Graph API ──POST──→ /api/webhook/instagram
GET /webhook/instagram ←── challenge response

/api/leads/[id]/instagram/send ──→ InstagramMessagingService ──→ Meta Graph API
                                       │
                                       └─→ SupabaseActivityRepository.create(INSTAGRAM_MESSAGE)

Webhook POST ──→ verifyMetaSignature()
                ↓ valid
              parseMessage() ──→ matchLeadByIgSenderId()
                                  ↓
                                SupabaseActivityRepository.create(INSTAGRAM_MESSAGE)

Lead status change ──→ InstagramAutoTrigger ──→ InstagramMessagingService.send()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/core/domain/Lead.ts` | Modify | Add `instagramHandle?: string` to Lead interface + `CreateLeadDTO` |
| `src/core/domain/LeadSchema.ts` | Modify | Add `instagramHandle: z.string().optional()` to both schemas |
| `src/infrastructure/repositories/SupabaseLeadRepository.ts` | Modify | Map `instagramHandle` ↔ `instagram_handle` in create/update/mapToDomain |
| `src/modules/activities/domain/enums/ActivityType.ts` | Modify | Add `INSTAGRAM_MESSAGE = 'INSTAGRAM_MESSAGE'` |
| `src/modules/activities/presentation/components/ActivityTypeIcon.tsx` | Modify | Add `Instagram` icon for INSTAGRAM_MESSAGE |
| `src/modules/activities/components/ActivityItem.tsx` | Modify | Add iconMap entry for INSTAGRAM_MESSAGE |
| `src/modules/activities/infrastructure/schemas/ActivitySchema.ts` | Modify | No change (type is string, enum extends automatically) |
| `src/modules/activities/infrastructure/repositories/SupabaseActivityRepository.ts` | Modify | No change needed (type is generic string) |
| `src/infrastructure/services/InstagramAuthService.ts` | Create | Meta token exchange, refresh, decrypt stored token |
| `src/infrastructure/services/InstagramMessagingService.ts` | Create | `sendDM()`, `verifyMetaSignature()`, `parseIncomingMessage()` |
| `src/app/api/webhook/instagram/route.ts` | Create | GET (challenge) + POST (events), no auth, HMAC verify |
| `src/app/api/leads/[id]/instagram/send/route.ts` | Create | POST — send DM, create Activity record |
| `src/app/api/leads/[id]/instagram/conversation/route.ts` | Create | GET — fetch INSTAGRAM_MESSAGE activities for lead |
| `src/modules/leads/components/InstagramSendDialog.tsx` | Create | Dialog with textarea + send button |
| `src/modules/leads/components/LeadWorkspace.tsx` | Modify | Add Instagram DM tab/button in workspace |
| `src/core/application/leads/UpdateLead.ts` | Modify | Hook auto-trigger after status update |
| `src/core/application/leads/InstagramAutoTrigger.ts` | Create | Check status config, send DM, log unsent |
| `src/infrastructure/database/database.types.ts` | Modify | Add `user_secrets` table type |
| `supabase/migrations/20240715000000_add_instagram_fields.sql` | Create | Migration: add `instagram_handle` to leads + create `user_secrets` table |
| `src/lib/logger.ts` | Modify | No change (already supports structured logging) |
| `wrangler.toml` | Modify | Add `TOKEN_ENCRYPTION_KEY`, `META_APP_SECRET`, `META_VERIFY_TOKEN` vars |

## Interfaces / Contracts

```typescript
// InstagramMessagingService
interface InstagramMessagingService {
  sendDM(igId: string, recipientIgSid: string, text: string): Promise<{ messageId: string }>;
  verifyMetaSignature(payload: string, signature: string): Promise<boolean>;
  parseIncomingMessage(payload: unknown): { senderId: string; messageId: string; text: string; timestamp: string };
}

// InstagramAuthService
interface InstagramAuthService {
  getToken(userId: string): Promise<{ token: string; igId: string }>;
  storeToken(userId: string, tokenData: { token: string; igId: string; pageId: string; expiresAt: string }): Promise<void>;
  refreshToken(userId: string): Promise<string>;
}

// user_secrets table
interface UserSecretRow {
  id: string;
  user_id: string;
  instagram_token: string;   // encrypted via pgp_sym_encrypt
  instagram_ig_id: string;
  instagram_page_id: string;
  token_expires_at: string;
  created_at: string;
  updated_at: string;
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | InstagramMessagingService.sendDM() | Mock fetch/global fetch, verify Meta API call shape and error handling |
| Unit | InstagramAuthService.getToken() | Mock Supabase query, verify decrypt path |
| Unit | verifyMetaSignature() | Known payload + secret → expect true; tampered → expect false |
| Unit | InstagramAutoTrigger | Mock messaging service, verify send called only on configured status transitions |
| Unit | Webhook challenge (GET) | Matching verify_token → returns challenge; mismatch → 403 |
| Integration | Supabase migrations run cleanly | `supabase migration up` + `pnpm test` |
| Integration | Activity creation for INSTAGRAM_MESSAGE | Repository test with mock supabase |
| E2E | Lead form submit with instagramHandle | render → fill → submit → verify API call shape |

## Migration / Rollout

Single migration: `20240715000000_add_instagram_fields.sql`
- `ALTER TABLE leads ADD COLUMN instagram_handle TEXT;`
- Create `user_secrets` table with RLS policies (user can select/insert/update their own row)
- Enable pgcrypto extension
- Update `activities_type_check` constraint to include `'INSTAGRAM_MESSAGE'`

Env vars to set via Cloudflare dashboard:
- `TOKEN_ENCRYPTION_KEY` — 32-char AES key for pgcrypto
- `META_APP_SECRET` — Meta App secret for HMAC verification
- `META_VERIFY_TOKEN` — arbitrary token for webhook challenge handshake

## Resolved Questions

### IG Sender ID Resolution

**Strategy**: Two-phase matching.

1. **First contact** (outbound): Look up lead by `instagramHandle`. Send DM via Meta API → store returned Instagram-scoped sender ID (IGSID) on the lead record (`instagram_scoped_id`).
2. **Subsequent contacts** (inbound via webhook): Match incoming message by stored `instagram_scoped_id` on the lead record. This is faster and more reliable than text-matching handles.
3. **Edge case — webhook from unknown IGSID**: Create an orphan activity entry with the sender info but no `lead_id`. The user can manually link it from the activity feed.

**Implied model change**: Add `instagramScopedId?: string` to the Lead entity alongside `instagramHandle`.
