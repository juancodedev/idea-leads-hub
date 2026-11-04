import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { raise, schemaless } from "../repositories/supabaseClient";

type LegacyArg = { title: string };

/**
 * Argument and result shapes of the messaging SQL functions
 * (supabase/migrations/20261103000000_messaging_tables.sql). Parameter names
 * MUST match the SQL declarations exactly; timestamps travel as ISO strings.
 */
export interface MessagingRpcFunctions {
  messaging_ingest_inbound: {
    Args: {
      p_conversation_id: string;
      p_external_id: string | null;
      p_type: string;
      p_body: string;
      p_raw: unknown;
      p_at: string;
      p_legacy: LegacyArg;
    };
    Returns: { inserted: boolean; message_id: string | null };
  };
  messaging_record_echo: {
    Args: {
      p_conversation_id: string;
      p_external_id: string;
      p_body: string;
      p_event_at: string;
      p_raw: unknown;
      p_legacy: LegacyArg;
    };
    Returns: { outcome: "duplicate" | "adopted" | "inserted"; message_id: string | null };
  };
  messaging_mark_sent: {
    Args: { p_message_id: string; p_external_id: string; p_legacy: LegacyArg };
    Returns: { id: string; status: string; external_id: string; conversation_id: string };
  };
  messaging_start_attempt: {
    Args: { p_event_id: string };
    Returns: Array<{ event_id: string; attempts: number; payload: unknown }>;
  };
  messaging_claim_retry: {
    Args: { p_limit: number };
    Returns: Array<{ event_id: string; provider: string; attempts: number; payload: unknown }>;
  };
  messaging_set_conversations_read: {
    Args: { p_conversation_ids: string[] };
    Returns: null;
  };
}

export type MessagingRpcName = keyof MessagingRpcFunctions;

/** Calls a messaging SQL function with typed arguments; throws on error. */
export async function callMessagingRpc<K extends MessagingRpcName>(
  client: SupabaseClient<Database>,
  fn: K,
  args: MessagingRpcFunctions[K]["Args"]
): Promise<MessagingRpcFunctions[K]["Returns"]> {
  const { data, error } = await schemaless(client).rpc(fn, args);
  if (error) raise(fn, error);
  return data as MessagingRpcFunctions[K]["Returns"];
}
