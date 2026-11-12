import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

/**
 * Service-role Supabase client for privileged paths without a user session
 * (webhook processing, retry sweep, API-key authentication). Bypasses RLS:
 * callers MUST scope every query by explicit ids (ADR-2). The only place reading
 * SUPABASE_SERVICE_ROLE_KEY.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  if (!url || !serviceRoleKey) {
    throw new Error(
      `Supabase admin client is not configured: missing ${missing.join(", ")}`
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
