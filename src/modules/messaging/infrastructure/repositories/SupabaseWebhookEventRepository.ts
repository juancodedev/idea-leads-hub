import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import {
  ClaimedWebhookEvent,
  WebhookEventRepository,
  WebhookEventStatus,
} from "../../domain/ports/WebhookEventRepository";
import { WebhookEventMapper } from "../mappers/WebhookEventMapper";
import { callMessagingRpc } from "../sql/rpc";
import { raise, schemaless } from "./supabaseClient";

const TABLE = "webhook_events";
const DAY_MS = 24 * 60 * 60 * 1000;
const HANDLED_STATUSES: WebhookEventStatus[] = ["processed", "ignored"];

export class SupabaseWebhookEventRepository implements WebhookEventRepository {
  private readonly db: SupabaseClient;

  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly now: () => Date = () => new Date()
  ) {
    this.db = schemaless(client);
  }

  /** One insert that does nothing on conflict (ADR-4); empty result = already claimed. */
  async claim(
    eventId: string,
    provider: string,
    payload: unknown
  ): Promise<{ eventId: string } | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .upsert(
        { event_id: eventId, provider, payload },
        { onConflict: "event_id", ignoreDuplicates: true }
      )
      .select("event_id");
    if (error) raise("webhook_events.claim", error);

    const rows = (data ?? []) as Array<{ event_id: string }>;
    return rows.length > 0 ? { eventId: rows[0].event_id } : null;
  }

  async startAttempt(eventId: string): Promise<ClaimedWebhookEvent | null> {
    const rows = await callMessagingRpc(this.client, "messaging_start_attempt", {
      p_event_id: eventId,
    });
    const row = rows?.[0];
    return row ? WebhookEventMapper.toClaimed(row) : null;
  }

  async claimRetry(limit: number): Promise<ClaimedWebhookEvent[]> {
    const rows = await callMessagingRpc(this.client, "messaging_claim_retry", {
      p_limit: limit,
    });
    return (rows ?? []).map(WebhookEventMapper.toClaimed);
  }

  markProcessed(eventId: string): Promise<void> {
    return this.setStatus(eventId, "processed");
  }

  markIgnored(eventId: string): Promise<void> {
    return this.setStatus(eventId, "ignored");
  }

  markFailed(eventId: string): Promise<void> {
    return this.setStatus(eventId, "failed");
  }

  async deleteHandledOlderThan(days: number): Promise<void> {
    const cutoff = new Date(this.now().getTime() - days * DAY_MS).toISOString();
    const { error } = await this.db
      .from(TABLE)
      .delete()
      .in("status", HANDLED_STATUSES)
      .lt("received_at", cutoff);
    if (error) raise("webhook_events.deleteHandledOlderThan", error);
  }

  private async setStatus(eventId: string, status: WebhookEventStatus): Promise<void> {
    const { error } = await this.db.from(TABLE).update({ status }).eq("event_id", eventId);
    if (error) raise(`webhook_events.${status}`, error);
  }
}
