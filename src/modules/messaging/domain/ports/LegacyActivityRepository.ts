import { InboxKey } from "../values/InboxKey";

/**
 * Legacy `INSTAGRAM_MESSAGE` activities kept in step during the rollout (S8).
 * Matching is the same as the pre-pipeline endpoints: a lead key by
 * `lead_id`; an unlinked key by the title `Instagram DM from|to <id>` with no
 * lead. This also covers activities that were never copied.
 */
export interface LegacyActivityRepository {
  deleteForKey(userId: string, key: InboxKey): Promise<void>;
  linkParticipantToLead(userId: string, participantId: string, leadId: string): Promise<void>;
}
