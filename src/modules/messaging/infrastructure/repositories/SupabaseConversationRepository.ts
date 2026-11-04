import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { NotFoundError } from "@/infrastructure/repositories/errors";
import { Conversation } from "../../domain/entities/Conversation";
import {
  ConversationRepository,
  NewConversation,
} from "../../domain/ports/ConversationRepository";
import { ConversationMapper, ConversationRow } from "../mappers/ConversationMapper";
import { raise, schemaless } from "./supabaseClient";

const TABLE = "conversations";

export class SupabaseConversationRepository implements ConversationRepository {
  private readonly db: SupabaseClient;

  constructor(client: SupabaseClient<Database>) {
    this.db = schemaless(client);
  }

  async findById(id: string): Promise<Conversation | null> {
    const { data, error } = await this.db.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) raise("conversations.findById", error);
    return data ? ConversationMapper.toDomain(data as ConversationRow) : null;
  }

  async findByAccountAndExternalId(
    accountId: string,
    externalId: string
  ): Promise<Conversation | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select("*")
      .eq("account_id", accountId)
      .eq("external_id", externalId)
      .maybeSingle();
    if (error) raise("conversations.findByAccountAndExternalId", error);
    return data ? ConversationMapper.toDomain(data as ConversationRow) : null;
  }

  async findByLeadId(leadId: string): Promise<Conversation[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select("*")
      .eq("lead_id", leadId)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) raise("conversations.findByLeadId", error);
    return ((data ?? []) as ConversationRow[]).map(ConversationMapper.toDomain);
  }

  /**
   * Race-safe (ADR-7): insert on conflict (account_id, external_id) do
   * nothing, then select the pair, so a concurrent creation never fails.
   */
  async findOrCreate(conversation: NewConversation): Promise<Conversation> {
    const { accountId, externalId } = conversation;
    if (!accountId) {
      // (NULL, external_id) never conflicts in Postgres: no race safety without an account.
      throw new Error("findOrCreate requires an accountId");
    }

    const { error } = await this.db
      .from(TABLE)
      .upsert(ConversationMapper.toInsert(conversation), {
        onConflict: "account_id,external_id",
        ignoreDuplicates: true,
      });
    if (error) raise("conversations.findOrCreate", error);

    const found = await this.findByAccountAndExternalId(accountId, externalId);
    if (!found) {
      throw new NotFoundError(
        `Conversation (${accountId}, ${externalId}) not found after insert`
      );
    }
    return found;
  }

  async update(id: string, patch: Partial<Conversation>): Promise<Conversation> {
    const { data, error } = await this.db
      .from(TABLE)
      .update(ConversationMapper.toUpdate(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) raise("conversations.update", error);
    return ConversationMapper.toDomain(data as ConversationRow);
  }
}
