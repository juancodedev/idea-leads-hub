import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { logger } from "@/lib/logger";
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
   * Resolves the account that received a webhook (ADR-7), with the same
   * owner rules as the previous webhook:
   *
   * 1. Match `external_account_id` or `page_id`. Unsafe ids return null
   *    without querying, so they never reach the `.or()` filter.
   * 2. Matches owned by more than one user return null: guessing would leak
   *    one tenant's messages into another tenant's account.
   * 3. No match: when exactly one account of the channel is connected, use it
   *    (some login flows store an app-scoped id that differs from the id Meta
   *    sends in webhooks; with one connected user there is no other tenant).
   *
   * Query errors throw, so the event stays retryable.
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
    if (new Set(rows.map((r) => r.user_id)).size > 1) {
      logger.error("Channel account id matches several users; event dropped", {
        channel,
        externalAccountId,
      });
      return null;
    }

    const row =
      rows.find((r) => r.external_account_id === externalAccountId) ?? rows[0] ?? null;
    if (row) return ChannelAccountMapper.toDomain(row);

    return this.findOnlyConnectedAccount(channel, externalAccountId);
  }

  private async findOnlyConnectedAccount(
    channel: Channel,
    externalAccountId: string
  ): Promise<ChannelAccount | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select("*")
      .eq("channel", channel)
      .eq("status", "connected")
      .limit(2);
    if (error) raise("channel_accounts.findOnlyConnectedAccount", error);

    const rows = (data ?? []) as ChannelAccountRow[];
    if (rows.length !== 1) return null;

    logger.warn("Channel account id did not match; using the only connected account", {
      channel,
      externalAccountId,
    });
    return ChannelAccountMapper.toDomain(rows[0]);
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
