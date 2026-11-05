/**
 * @jest-environment node
 *
 * Static (read-only) assertions on the messaging pipeline data-prep migration.
 * Verifies the SQL file exists and contains the expected tables, RLS ownership
 * policies, indexes, realtime publication and the ADR-10 atomic functions.
 * Does NOT run the migration against a database — that is covered by `test:db`.
 */

import * as fs from "fs";
import * as path from "path";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "20261103000000_messaging_tables.sql"
);

describe("Messaging tables migration (20261103000000)", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");

  it("should exist at the expected 14-digit path", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("should create the channel_accounts table", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.channel_accounts");
    expect(sql).toContain("user_id uuid NOT NULL");
    expect(sql).toContain("channel text NOT NULL CHECK");
    expect(sql).toContain("external_account_id text NOT NULL");
    expect(sql).toContain("UNIQUE (channel, external_account_id)");
  });

  it("should create the conversations table", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.conversations");
    expect(sql).toContain("lead_id uuid REFERENCES public.leads(id)");
    expect(sql).toContain("account_id uuid REFERENCES public.channel_accounts(id)");
    expect(sql).toContain("external_id text NOT NULL");
    expect(sql).toContain("unread_count int NOT NULL DEFAULT 0");
    expect(sql).toContain("metadata jsonb NOT NULL DEFAULT '{}'");
    expect(sql).toContain("UNIQUE (account_id, external_id)");
  });

  it("should create the messages table", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.messages");
    expect(sql).toContain("conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE");
    expect(sql).toContain("direction text NOT NULL CHECK");
    expect(sql).toContain("origin text CHECK");
    expect(sql).toContain("status text NOT NULL DEFAULT 'received' CHECK");
    expect(sql).toContain("legacy_activity_id uuid UNIQUE");
    expect(sql).toContain("raw_payload jsonb");
  });

  it("should create the webhook_events table", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.webhook_events");
    expect(sql).toContain("event_id text PRIMARY KEY");
    expect(sql).toContain("attempts int NOT NULL DEFAULT 0 CHECK (attempts >= 0)");
    expect(sql).toContain("payload jsonb NOT NULL");
  });

  it("should add the partial unique index on messages.external_id", () => {
    expect(sql).toContain("messages_external_id_uq");
    expect(sql).toContain("WHERE external_id IS NOT NULL");
  });

  it("should add FK indexes on conversations and messages", () => {
    expect(sql).toContain("conversations_user_id_last_message_at_idx");
    expect(sql).toContain("conversations_lead_id_idx");
    expect(sql).toContain("messages_conversation_created_idx");
  });

  it("should enable RLS on all four tables", () => {
    expect(sql).toMatch(/ALTER TABLE public\.channel_accounts ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE public\.conversations ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE public\.messages ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE public\.webhook_events ENABLE ROW LEVEL SECURITY/);
  });

  it("should enforce user ownership with WITH CHECK on referenced rows", () => {
    expect(sql).toContain("user_id = (SELECT auth.uid())");
    // conversations WITH CHECK: account_id and lead_id ownership (multi-line SQL)
    expect(sql).toMatch(/account_id\s*IN\s*\(\s*SELECT id FROM public\.channel_accounts/);
    expect(sql).toMatch(/lead_id\s*IN\s*\(\s*SELECT id FROM public\.leads/);
    // messages WITH CHECK: conversation_id ownership (multi-line SQL)
    expect(sql).toMatch(/conversation_id\s*IN\s*\(\s*SELECT id FROM public\.conversations/);
  });

  it("should have no policy on webhook_events (service role only)", () => {
    // No CREATE POLICY for webhook_events should appear
    const webhookPolicyMatches = sql.match(/CREATE POLICY \w+ ON public\.webhook_events/);
    expect(webhookPolicyMatches).toBeNull();
  });

  it("should add conversations and messages to the realtime publication", () => {
    expect(sql).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations, public.messages");
  });

  it("should define the ADR-10 atomic functions as SECURITY INVOKER with search_path = public", () => {
    const functions = [
      "messaging_ingest_inbound",
      "messaging_record_echo",
      "messaging_mark_sent",
      "messaging_claim_retry",
      "messaging_set_conversations_read",
      "messaging_sync_legacy_read",
    ];
    for (const fn of functions) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
      expect(sql).toContain("SECURITY INVOKER");
      expect(sql).toContain("SET search_path = public");
    }
  });

  it("should make messaging_ingest_inbound idempotent on external_id with ON CONFLICT", () => {
    expect(sql).toContain("ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING");
  });

  it("should make messaging_claim_retry atomic with FOR UPDATE SKIP LOCKED", () => {
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain("ORDER BY received_at ASC");
    expect(sql).toContain("LIMIT p_limit");
  });

  it("should lease claimed events so an overlapping sweep cannot reclaim them for 2 minutes", () => {
    expect(sql).toMatch(/last_attempt_at timestamptz/);
    const claimRetry = sql.slice(sql.indexOf("FUNCTION public.messaging_claim_retry"));
    expect(claimRetry).toContain(
      "COALESCE(last_attempt_at, received_at) < now() - interval '2 minutes'"
    );
    expect(claimRetry).toMatch(/SET attempts = attempts \+ 1,\s+last_attempt_at = now\(\)/);
  });

  it("should start a background attempt atomically with messaging_start_attempt", () => {
    const start = sql.indexOf("CREATE OR REPLACE FUNCTION public.messaging_start_attempt(p_event_id text)");
    expect(start).toBeGreaterThan(-1);
    const fn = sql.slice(start, sql.indexOf("$$;", start));

    expect(fn).toContain("RETURNS TABLE (\n  event_id text,\n  attempts int,\n  payload jsonb\n)");
    expect(fn).toContain("SECURITY INVOKER");
    expect(fn).toContain("SET search_path = public");
    // increments attempts and takes the lease in the same statement, only while received
    expect(fn).toMatch(/SET attempts = attempts \+ 1,\s+last_attempt_at = now\(\)/);
    expect(fn).toMatch(/WHERE event_id = p_event_id\s+AND status = 'received'/);
    expect(fn).toContain("RETURNING event_id, attempts, payload");
  });

  it("should resolve RETURNS TABLE name clashes to columns in the webhook claim functions", () => {
    // OUT columns named like table columns are ambiguous in PL/pgSQL (42702)
    // unless the function resolves them to the column.
    for (const fn of ["messaging_claim_retry", "messaging_start_attempt"]) {
      const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
      const body = sql.slice(start, sql.indexOf("$$;", start));
      expect(body).toContain("#variable_conflict use_column");
    }
  });

  it("should not modify or delete legacy activities (rollout safety)", () => {
    expect(sql).not.toMatch(/DELETE FROM public\.activities/);
    expect(sql).not.toMatch(/UPDATE public\.activities SET/);
  });
});
