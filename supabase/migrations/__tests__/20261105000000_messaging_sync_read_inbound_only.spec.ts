/**
 * @jest-environment node
 *
 * Static (read-only) assertions on migration C (S12): `messaging_sync_legacy_read`
 * only adjusts `conversations.unread_count` for inbound legacy activities.
 * Behaviour against Postgres is covered by `supabase/tests/read_state.sql`
 * (local Supabase only, `pnpm test:db`).
 */

import * as fs from "fs";
import * as path from "path";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "20261105000000_messaging_sync_read_inbound_only.sql"
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

describe("Sync read inbound-only migration (20261105000000)", () => {
  it("should exist at the expected 14-digit path", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("should replace messaging_sync_legacy_read keeping its signature", () => {
    expect(code()).toMatch(
      /CREATE OR REPLACE FUNCTION public\.messaging_sync_legacy_read\(\s*p_activity_id uuid,\s*p_read boolean\s*\)\s*RETURNS void/
    );
  });

  it("should stay SECURITY INVOKER with a fixed search_path", () => {
    const sql = code();
    expect(sql).toMatch(/SECURITY INVOKER/);
    expect(sql).not.toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
  });

  it("should only resolve a conversation for inbound linked messages", () => {
    expect(code()).toMatch(/m\.direction = 'in'/);
  });

  it("should never write the activities table", () => {
    const sql = code();
    expect(sql).not.toMatch(/(UPDATE|INSERT INTO|DELETE FROM)\s+public\.activities/i);
  });

  it("should floor the decrement at zero and change the counter by one", () => {
    const sql = code();
    expect(sql).toContain("GREATEST(unread_count - 1, 0)");
    expect(sql).toContain("unread_count = unread_count + 1");
  });

  it("should not touch any other function or table definition", () => {
    const sql = code();
    expect(sql.match(/CREATE (OR REPLACE )?FUNCTION/g)).toHaveLength(1);
    expect(sql).not.toMatch(/\b(CREATE|ALTER|DROP) TABLE\b/i);
  });
});
