/**
 * @jest-environment node
 *
 * Integration-style test for the activity status NOT NULL migration (CF-1,
 * rollout step 4). Verifies the final rollout migration exists and contains
 * ONLY the NOT NULL/DEFAULT lock-down: straggler repair backfill, SET DEFAULT
 * 'PENDING', SET NOT NULL, on public.activities.
 * Explicitly asserts the completed/status sync hook is NOT created here — it
 * ships last in 20260815000000_sync_activity_completed_trigger.sql.
 */

import * as fs from "fs";
import * as path from "path";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "20260814000000_activity_status_not_null.sql"
);

const RUNBOOK_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "docs",
  "activities-status-rollout.md"
);

describe("Activity status NOT NULL migration (20260814000000)", () => {
  it("should exist at the expected 14-digit CF-1 path", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("should set DEFAULT 'PENDING' on public.activities.status", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(
      /ALTER TABLE public\.activities\s+ALTER COLUMN status SET DEFAULT 'PENDING'/i
    );
  });

  it("should set NOT NULL on public.activities.status", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(
      /ALTER TABLE public\.activities\s+ALTER COLUMN status SET NOT NULL/i
    );
  });

  it("should repair straggler rows with NULL status before locking NOT NULL", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(/WHERE status IS NULL/i);
    expect(sql).toMatch(/CASE WHEN completed THEN 'COMPLETED' ELSE 'PENDING' END/i);
  });

  it("must NOT create the sync hook (ships last in the 1.3 migration)", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).not.toMatch(/sync_activity_completed/i);
    expect(sql).not.toMatch(/TRIGGER/i);
  });

  it("should wrap DDL in a transaction block", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    // Matches the data-prep migration (20260813000001) convention: comment
    // header first, then BEGIN; ... COMMIT; wrapping the DDL.
    expect(sql).toMatch(/BEGIN;\s+-- 1\./);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });
});

describe("Activities status rollout runbook references the NOT NULL migration", () => {
  it("should reference 20260814000000 consistently", () => {
    expect(fs.existsSync(RUNBOOK_PATH)).toBe(true);
    const runbook = fs.readFileSync(RUNBOOK_PATH, "utf-8");
    expect(runbook).toContain("20260814000000_activity_status_not_null.sql");
  });
});