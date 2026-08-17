/**
 * @jest-environment node
 *
 * Integration-style test for the completed sync hook migration (CF-1,
 * rollout step 5). Verifies the final safety-net migration exists and keeps
 * `completed = (status = 'COMPLETED')` on every write to public.activities,
 * deployed LAST after the writer migrations.
 * The SQL file legitimately contains the literal SQL keywords TRIGGER /
 * RETURNS TRIGGER (required syntax); its COMMENT wording deliberately uses
 * "sync hook" / "sync function" phrasing, matching the data-prep migration
 * (20260813000001) convention.
 * Asserts the hook never touches read_at (BR-3 decoupling).
 */

import * as fs from "fs";
import * as path from "path";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "20260815000000_sync_activity_completed_trigger.sql"
);

const RUNBOOK_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "docs",
  "activities-status-rollout.md"
);

describe("Activity completed sync hook migration (20260815000000)", () => {
  it("should exist at the expected 14-digit CF-1 path", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("should create the sync function deriving completed from status", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("fn_sync_activity_completed");
    expect(sql).toMatch(
      /NEW\.completed\s*:=\s*\(NEW\.status\s*=\s*'COMPLETED'\)/i
    );
  });

  it("should fire on BEFORE INSERT OR UPDATE of public.activities", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.activities/i);
  });

  it("should be idempotent (CREATE OR REPLACE + DROP IF EXISTS)", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_sync_activity_completed/i);
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS tr_sync_activity_completed ON public\.activities/i);
    expect(sql).toMatch(/CREATE TRIGGER tr_sync_activity_completed/i);
  });

  it("must NOT touch read_at (BR-3: completion never implies read)", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    // The sync function may document BR-3 in comments, but it must never
    // assign or read the read_at column: only completed may be re-derived.
    expect(sql).not.toMatch(/read_at\s*:=/i);
    expect(sql).not.toMatch(/NEW\.read_at/i);
  });
});

describe("Activities status rollout runbook references the sync hook migration", () => {
  it("should reference 20260815000000 consistently", () => {
    expect(fs.existsSync(RUNBOOK_PATH)).toBe(true);
    const runbook = fs.readFileSync(RUNBOOK_PATH, "utf-8");
    expect(runbook).toContain("20260815000000_sync_activity_completed_trigger.sql");
  });
});