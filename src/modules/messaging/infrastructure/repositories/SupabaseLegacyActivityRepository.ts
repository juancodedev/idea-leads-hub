import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { LegacyActivityRepository } from "../../domain/ports/LegacyActivityRepository";
import { InboxKey, isSafeExternalId } from "../../domain/values/InboxKey";
import { raise, schemaless } from "./supabaseClient";

const TABLE = "activities";
const INSTAGRAM_MESSAGE = "INSTAGRAM_MESSAGE";

/**
 * Legacy Instagram activities (S8), matched exactly as the pre-pipeline
 * `/api/messages` endpoints did, plus the explicit user id (ADR-2).
 */
export class SupabaseLegacyActivityRepository implements LegacyActivityRepository {
  private readonly db: SupabaseClient;

  constructor(client: SupabaseClient<Database>) {
    this.db = schemaless(client);
  }

  async deleteForKey(userId: string, key: InboxKey): Promise<void> {
    const base = this.db
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("type", INSTAGRAM_MESSAGE);
    const query =
      key.kind === "lead"
        ? base.eq("lead_id", key.leadId)
        : base.is("lead_id", null).or(titleFilter(key.participantId));
    const { error } = await query;
    if (error) raise("activities.deleteForKey", error);
  }

  async linkParticipantToLead(
    userId: string,
    participantId: string,
    leadId: string
  ): Promise<void> {
    const filter = titleFilter(participantId);
    const { error } = await this.db
      .from(TABLE)
      .update({ lead_id: leadId })
      .eq("user_id", userId)
      .eq("type", INSTAGRAM_MESSAGE)
      .is("lead_id", null)
      .or(filter);
    if (error) raise("activities.linkParticipantToLead", error);
  }
}

/** `Instagram DM from|to <id>`; the id is interpolated into a PostgREST filter. */
function titleFilter(participantId: string): string {
  if (!isSafeExternalId(participantId)) {
    throw new Error(`Unsafe participant id: ${participantId}`);
  }
  return `title.ilike.Instagram DM from ${participantId},title.ilike.Instagram DM to ${participantId}`;
}
