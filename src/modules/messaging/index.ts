import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { composeMessaging } from "./composition";
import { MessagingChannel } from "./domain/ports/MessagingChannel";
import { MetaInstagramChannel } from "./infrastructure/channels/MetaInstagramChannel";
import { SupabaseChannelAccountRepository } from "./infrastructure/repositories/SupabaseChannelAccountRepository";
import { SupabaseConversationRepository } from "./infrastructure/repositories/SupabaseConversationRepository";
import { SupabaseLeadLookup } from "./infrastructure/repositories/SupabaseLeadLookup";
import { SupabaseLegacyActivityRepository } from "./infrastructure/repositories/SupabaseLegacyActivityRepository";
import { SupabaseMessageRepository } from "./infrastructure/repositories/SupabaseMessageRepository";
import { SupabaseWebhookEventRepository } from "./infrastructure/repositories/SupabaseWebhookEventRepository";
import { createMessagingSqlExecutors } from "./infrastructure/sql/executors";

export type { MessagingModule } from "./composition";
export { parseInboxKey } from "./domain/values/InboxKey";
export type { InboxKey } from "./domain/values/InboxKey";

export interface MessagingModuleOptions {
  /** Overrides the Meta Instagram channel (tests, other channels later). */
  channel?: MessagingChannel;
}

/**
 * Composition root of the messaging module (ADR-1). Works with the user
 * client (RLS) and with the service-role client from createAdminClient()
 * (webhook, sweep): repositories scope every query by explicit ids (ADR-2).
 */
export function messagingModule(
  supabase: SupabaseClient<Database>,
  options: MessagingModuleOptions = {}
) {
  const messageRepository = new SupabaseMessageRepository(supabase);
  const sql = createMessagingSqlExecutors(supabase, messageRepository);

  return composeMessaging({
    channel: options.channel ?? new MetaInstagramChannel(),
    channelAccountRepository: new SupabaseChannelAccountRepository(supabase),
    conversationRepository: new SupabaseConversationRepository(supabase),
    messageRepository,
    webhookEventRepository: new SupabaseWebhookEventRepository(supabase),
    leadLookup: new SupabaseLeadLookup(supabase),
    legacyActivityRepository: new SupabaseLegacyActivityRepository(supabase),
    ...sql,
  });
}
