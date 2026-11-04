import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { LeadLookup } from "../../domain/ports/LeadLookup";
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
}
