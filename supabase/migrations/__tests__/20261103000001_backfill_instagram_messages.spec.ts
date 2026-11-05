/**
 * @jest-environment node
 *
 * Static (read-only) assertions on the history backfill migration (S9).
 * Verifies the SQL file defines `messaging_backfill_instagram_history()` with
 * the security settings, idempotency keys and additive counters of the design
 * (§4 Migration B, ADR-7, ADR-9). Behaviour against Postgres is covered by
 * `supabase/tests/backfill_instagram_history.sql` (local Supabase only).
 */

import * as fs from "fs";
import * as path from "path";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "20261103000001_backfill_instagram_messages.sql"
);

function readSql(): string {
  return fs.existsSync(MIGRATION_PATH) ? fs.readFileSync(MIGRATION_PATH, "utf-8") : "";
}

/** SQL with `--` comments removed, so assertions only match executable code. */
function code(): string {
  return readSql()
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("Backfill Instagram history migration (20261103000001)", () => {
  it("should exist at the expected 14-digit path", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("should define the backfill function as SECURITY DEFINER with a fixed search_path", () => {
    const sql = code();
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.messaging_backfill_instagram_history()"
    );
    expect(sql).toMatch(/RETURNS jsonb/);
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
  });

  it("should revoke EXECUTE from public, anon and authenticated", () => {
    expect(code()).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.messaging_backfill_instagram_history\(\)\s+FROM PUBLIC, anon, authenticated;/
    );
  });

  it("should only define the function, never run it", () => {
    expect(code()).not.toMatch(/SELECT\s+(public\.)?messaging_backfill_instagram_history\(\)/i);
  });

  it("should seed channel_accounts from user_secrets without overwriting", () => {
    const sql = code();
    expect(sql).toMatch(/INSERT INTO public\.channel_accounts/);
    expect(sql).toContain("us.instagram_ig_id");
    expect(sql).toContain("us.instagram_page_id");
    expect(sql).toContain("'connected'");
    expect(sql).toMatch(/ON CONFLICT \(channel, external_account_id\) DO NOTHING/);
  });

  it("should create disconnected placeholder accounts for users without credentials", () => {
    const sql = code();
    expect(sql).toContain("'disconnected'");
    expect(sql).toContain("'legacy:' || ");
  });

  it("should parse the IGSID and direction from both legacy title formats", () => {
    const sql = code();
    expect(sql).toContain("'^Instagram DM (?:from|to) (\\d+)$'");
    expect(sql).toContain("'Instagram DM from %'");
    expect(sql).toContain("'INSTAGRAM_MESSAGE'");
  });

  it("should be idempotent on legacy_activity_id and skip activities new code already linked", () => {
    const sql = code();
    expect(sql).toMatch(/ON CONFLICT \(legacy_activity_id\) DO NOTHING/);
    expect(sql).toMatch(/m\.legacy_activity_id = a\.id/);
    expect(sql).toMatch(/ON CONFLICT \(account_id, external_id\) DO NOTHING/);
  });

  it("should copy messages with a null external_id and received/sent status", () => {
    const sql = code();
    expect(sql).toContain("'received'");
    expect(sql).toContain("'sent'");
    expect(sql).toMatch(/NULL::text/);
  });

  it("should update counters additively, never overwriting them", () => {
    const sql = code();
    expect(sql).toMatch(/unread_count = c\.unread_count \+ /);
    expect(sql).toMatch(/read_at IS NULL/);
    expect(sql).toMatch(/last_inbound_at = GREATEST\(c\.last_inbound_at, /);
    expect(sql).toMatch(/last_message_at = GREATEST\(c\.last_message_at, /);
    expect(sql).not.toMatch(/unread_count = \d/);
  });

  it("should serialise concurrent runs with a transaction advisory lock", () => {
    expect(code()).toMatch(/pg_advisory_xact_lock/);
  });

  it("should return and announce a jsonb summary with the S9 counters", () => {
    const sql = code();
    for (const key of [
      "accounts_seeded",
      "placeholder_accounts_created",
      "conversations_created",
      "messages_copied",
      "messages_copied_to_placeholder",
      "already_copied",
      "unparseable_title",
    ]) {
      expect(sql).toContain(`'${key}'`);
    }
    expect(sql).toMatch(/RAISE NOTICE/);
  });

  it("should be purely additive on legacy tables (no UPDATE/DELETE of activities, leads or user_secrets)", () => {
    const sql = code();
    for (const table of ["activities", "leads", "user_secrets"]) {
      expect(sql).not.toMatch(new RegExp(`UPDATE\\s+(public\\.)?${table}\\b`, "i"));
      expect(sql).not.toMatch(new RegExp(`DELETE\\s+FROM\\s+(public\\.)?${table}\\b`, "i"));
      expect(sql).not.toMatch(new RegExp(`INSERT\\s+INTO\\s+(public\\.)?${table}\\b`, "i"));
    }
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("should never delete from the new messaging tables", () => {
    expect(code()).not.toMatch(/DELETE\s+FROM\s+(public\.)?(messages|conversations|channel_accounts)\b/i);
  });
});
