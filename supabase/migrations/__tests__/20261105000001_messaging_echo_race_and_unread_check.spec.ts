/**
 * @jest-environment node
 *
 * Static (read-only) assertions on migration D: a concurrent same-mid echo
 * returns `duplicate` instead of raising (S6), and conversations.unread_count
 * gets the CHECK (unread_count >= 0) of S1. Behaviour against Postgres is
 * covered by `supabase/tests/run.sh` (probes P2a/P4a) and
 * `supabase/tests/read_state.sql` (local Supabase only, `pnpm test:db`).
 */

import * as fs from "fs";
import * as path from "path";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "20261105000001_messaging_echo_race_and_unread_check.sql"
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

describe("Echo race and unread check migration (20261105000001)", () => {
  it("should exist at the expected 14-digit path", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("should replace messaging_record_echo keeping its signature", () => {
    expect(code()).toMatch(
      /CREATE OR REPLACE FUNCTION public\.messaging_record_echo\(\s*p_conversation_id uuid,\s*p_external_id text,\s*p_body text,\s*p_event_at timestamptz,\s*p_raw jsonb,\s*p_legacy jsonb\s*\)\s*RETURNS jsonb/
    );
  });

  it("should stay SECURITY INVOKER with a fixed search_path", () => {
    const sql = code();
    expect(sql).toMatch(/SECURITY INVOKER/);
    expect(sql).not.toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
  });

  it("should turn a unique_violation on messages_external_id_uq into a duplicate outcome", () => {
    const sql = code();
    expect(sql).toMatch(/EXCEPTION WHEN unique_violation THEN/);
    expect(sql).toMatch(/GET STACKED DIAGNOSTICS \w+ = CONSTRAINT_NAME/);
    expect(sql).toContain("'messages_external_id_uq'");
    expect(sql.match(/'outcome', 'duplicate'/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("should re-raise any other unique violation", () => {
    expect(code()).toMatch(/RAISE;/);
  });

  it("should keep the ADR-12 adoption window and the legacy activity write", () => {
    const sql = code();
    expect(sql).toContain("m.created_at >= p_event_at - interval '2 minutes'");
    expect(sql).toContain("m.created_at <= p_event_at");
    expect(sql).toContain("AND m.status IN ('pending', 'failed')");
    expect(sql).toContain("AND m.body = p_body");
    expect(sql).toMatch(/error_message = NULL,\s*hint = NULL/);
    expect(sql).toMatch(/INSERT INTO public\.activities/);
  });

  it("should add the unread_count CHECK idempotently, NOT VALID then VALIDATE", () => {
    const sql = code();
    expect(sql).toMatch(
      /ADD CONSTRAINT conversations_unread_count_nonneg CHECK \(unread_count >= 0\) NOT VALID/
    );
    expect(sql).toMatch(/VALIDATE CONSTRAINT conversations_unread_count_nonneg/);
    expect(sql).toMatch(/conname = 'conversations_unread_count_nonneg'/);
  });

  it("should not define any other function or create tables", () => {
    const sql = code();
    expect(sql.match(/CREATE (OR REPLACE )?FUNCTION/g)).toHaveLength(1);
    expect(sql).not.toMatch(/\bCREATE TABLE\b/i);
  });
});
