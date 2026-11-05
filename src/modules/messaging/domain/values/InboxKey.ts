/**
 * Inbox key (ADR-11): the id the inbox uses for one entry. A key resolves to
 * a SET of conversations:
 *
 * - `lead:<leadId>`         every conversation linked to that lead;
 * - `unlinked:<participant>` the conversations with that participant and no lead.
 */
export type InboxKey =
  | { kind: "lead"; leadId: string }
  | { kind: "unlinked"; participantId: string };

/** Ids interpolated into PostgREST filters must not carry filter syntax. */
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

const LEAD_PREFIX = "lead:";
const UNLINKED_PREFIX = "unlinked:";

/** Parses `lead:<id>` / `unlinked:<id>`; returns null for any other shape. */
export function parseInboxKey(raw: string | null | undefined): InboxKey | null {
  if (!raw) return null;
  if (raw.startsWith(LEAD_PREFIX)) {
    const leadId = raw.slice(LEAD_PREFIX.length);
    return SAFE_ID.test(leadId) ? { kind: "lead", leadId } : null;
  }
  if (raw.startsWith(UNLINKED_PREFIX)) {
    const participantId = raw.slice(UNLINKED_PREFIX.length);
    return SAFE_ID.test(participantId) ? { kind: "unlinked", participantId } : null;
  }
  return null;
}

/** The key of the inbox entry a conversation belongs to. */
export function inboxKeyOf(conversation: {
  leadId: string | null;
  externalId: string;
}): string {
  return conversation.leadId
    ? `${LEAD_PREFIX}${conversation.leadId}`
    : `${UNLINKED_PREFIX}${conversation.externalId}`;
}

export function isSafeExternalId(id: string): boolean {
  return SAFE_ID.test(id);
}
