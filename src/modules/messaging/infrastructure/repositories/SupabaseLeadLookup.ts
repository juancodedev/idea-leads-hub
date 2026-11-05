import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { LeadLookup, LeadSummary } from "../../domain/ports/LeadLookup";
import { raise, schemaless } from "./supabaseClient";

export class SupabaseLeadLookup implements LeadLookup {
  private readonly db: SupabaseClient;

  constructor(client: SupabaseClient<Database>) {
    this.db = schemaless(client);
  }

  async findLeadIdByInstagramScopedId(
    userId: string,
    instagramScopedId: string
  ): Promise<string | null> {
    const { data, error } = await this.db
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .eq("instagram_scoped_id", instagramScopedId)
      .limit(1)
      .maybeSingle();
    if (error) raise("leads.findLeadIdByInstagramScopedId", error);
    return (data as { id: string } | null)?.id ?? null;
  }

  async findSummaries(userId: string, leadIds: string[]): Promise<LeadSummary[]> {
    if (leadIds.length === 0) return [];
    const { data, error } = await this.db
      .from("leads")
      .select("id, name, instagram_handle, instagram_scoped_id")
      .eq("user_id", userId)
      .in("id", leadIds);
    if (error) raise("leads.findSummaries", error);
    return (
      (data ?? []) as Array<{
        id: string;
        name: string;
        instagram_handle: string | null;
        instagram_scoped_id: string | null;
      }>
    ).map((row) => ({
      id: row.id,
      name: row.name,
      instagramHandle: row.instagram_handle,
      instagramScopedId: row.instagram_scoped_id,
    }));
  }

  async exists(userId: string, leadId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .eq("id", leadId)
      .maybeSingle();
    if (error) raise("leads.exists", error);
    return !!data;
  }
}
