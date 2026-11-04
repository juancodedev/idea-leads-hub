import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { ChannelAccount } from "../../domain/entities/ChannelAccount";
import { Channel } from "../../domain/enums/Channel";
import { ChannelAccountRepository } from "../../domain/ports/ChannelAccountRepository";
import { ChannelAccountMapper, ChannelAccountRow } from "../mappers/ChannelAccountMapper";
import { raise, schemaless } from "./supabaseClient";

/** Ids interpolated into a PostgREST `.or()` filter must not carry syntax. */
export const SAFE_EXTERNAL_ID = /^[A-Za-z0-9_-]+$/;

const TABLE = "channel_accounts";

export class SupabaseChannelAccountRepository implements ChannelAccountRepository {
  private readonly db: SupabaseClient;

  constructor(client: SupabaseClient<Database>) {
    this.db = schemaless(client);
  }

  async findById(id: string): Promise<ChannelAccount | null> {
    const { data, error } = await this.db.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) raise("channel_accounts.findById", error);
    return data ? ChannelAccountMapper.toDomain(data as ChannelAccountRow) : null;
  }

  /**
   * Matches `external_account_id` or `page_id` (ADR-7). Unsafe ids return
   * null without querying, so they never reach the `.or()` filter.
   */
  async findByExternalAccountId(
    channel: Channel,
    externalAccountId: string
  ): Promise<ChannelAccount | null> {
    if (!SAFE_EXTERNAL_ID.test(externalAccountId)) return null;

    const { data, error } = await this.db
      .from(TABLE)
      .select("*")
      .eq("channel", channel)
      .or(`external_account_id.eq.${externalAccountId},page_id.eq.${externalAccountId}`);
    if (error) raise("channel_accounts.findByExternalAccountId", error);

    const rows = (data ?? []) as ChannelAccountRow[];
    const row =
      rows.find((r) => r.external_account_id === externalAccountId) ?? rows[0] ?? null;
    return row ? ChannelAccountMapper.toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<ChannelAccount[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) raise("channel_accounts.findByUserId", error);
    return ((data ?? []) as ChannelAccountRow[]).map(ChannelAccountMapper.toDomain);
  }

  async create(
    account: Omit<ChannelAccount, "id" | "createdAt" | "updatedAt">
  ): Promise<ChannelAccount> {
    const { data, error } = await this.db
      .from(TABLE)
      .insert(ChannelAccountMapper.toInsert(account))
      .select("*")
      .single();
    if (error) raise("channel_accounts.create", error);
    return ChannelAccountMapper.toDomain(data as ChannelAccountRow);
  }
}
