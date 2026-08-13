/**
 * @jest-environment node
 *
 * Integration-style test for the activity status data-prep migration (CF-1).
 * Verifies the migration SQL file exists and contains ONLY the data-prep
 * statements: nullable columns, backfill, and CHECK constraint.
 * Explicitly asserts the deferred rollout steps (SET NOT NULL / trigger)
 * are NOT present — they ship in later slices with the writer migrations.
 */

import * as fs from "fs";
import * as path from "path";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "20260813000001_add_activity_status.sql"
);

const RUNBOOK_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "docs",
  "activities-status-rollout.md"
);

describe("Activity status data-prep migration (20260813000001)", () => {
  it("should exist at the expected 14-digit CF-1 path", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("should add nullable status and read_at columns", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS status TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ");
  });

  it("should backfill status from the completed flag", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("'COMPLETED'");
    expect(sql).toContain("'PENDING'");
    expect(sql).toMatch(/CASE WHEN completed THEN 'COMPLETED' ELSE 'PENDING' END/i);
  });

  it("should backfill Instagram read_at from completed_at with created_at fallback", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("COALESCE(completed_at, created_at, now())");
    expect(sql).toContain("INSTAGRAM_MESSAGE");
    expect(sql).toContain("completed = true");
  });

  it("should add a CHECK constraint over the three enum values", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("activities_status_check");
    expect(sql).toContain("'PENDING'");
    expect(sql).toContain("'IN_PROGRESS'");
    expect(sql).toContain("'COMPLETED'");
  });

  it("must NOT set NOT NULL on status (deferred to post-code migration)", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).not.toMatch(/SET NOT NULL/i);
  });

  it("must NOT create the sync_activity_completed trigger (rollout gating)", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).not.toMatch(/TRIGGER/i);
    expect(sql).not.toMatch(/sync_activity_completed/i);
  });
});

describe("Activities status rollout runbook (docs/activities-status-rollout.md)", () => {
  it("should exist with the post-deploy invariant check", () => {
    expect(fs.existsSync(RUNBOOK_PATH)).toBe(true);
    const runbook = fs.readFileSync(RUNBOOK_PATH, "utf-8");
    expect(runbook).toContain("completed IS DISTINCT FROM");
    expect(runbook).toContain("(status = 'COMPLETED')");
  });
});