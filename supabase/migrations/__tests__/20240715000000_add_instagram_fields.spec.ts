/**
 * @jest-environment node
 *
 * Integration-style test for the Instagram fields migration.
 * Verifies the migration SQL file exists and contains the expected DDL statements.
 */

import * as fs from "fs";
import * as path from "path";

const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "20240715000000_add_instagram_fields.sql"
);

describe("Instagram fields migration", () => {
  it("should exist at the expected path", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("should add instagram_handle and instagram_scoped_id columns to leads", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS instagram_handle TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS instagram_scoped_id TEXT");
  });

  it("should create user_secrets table", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.user_secrets");
    expect(sql).toContain("instagram_token TEXT");
    expect(sql).toContain("instagram_ig_id TEXT");
    expect(sql).toContain("instagram_page_id TEXT");
    expect(sql).toContain("token_expires_at TIMESTAMPTZ");
    expect(sql).toContain("auth.users(id)");
    expect(sql).toContain("UNIQUE(user_id)");
  });

  it("should enable RLS and create policy on user_secrets", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "CREATE POLICY \"Users can manage their own secrets\" ON public.user_secrets"
    );
    expect(sql).toContain("auth.uid() = user_id");
  });

  it("should enable pgcrypto extension", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  });

  it("should update activities_type_check constraint to include INSTAGRAM_MESSAGE", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS activities_type_check");
    expect(sql).toContain("ADD CONSTRAINT activities_type_check");
    expect(sql).toContain("INSTAGRAM_MESSAGE");
  });

  it("should wrap DDL in a transaction block", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql.trim().startsWith("BEGIN;")).toBe(true);
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });
});
