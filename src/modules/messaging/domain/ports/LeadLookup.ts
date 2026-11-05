export interface LeadSummary {
  id: string;
  name: string;
  instagramHandle: string | null;
  instagramScopedId: string | null;
}

export interface LeadLookup {
  /** Returns the id of the user's lead with this instagram_scoped_id, if any. */
  findLeadIdByInstagramScopedId(
    userId: string,
    instagramScopedId: string
  ): Promise<string | null>;
  /** The user's leads with these ids (unknown or foreign ids are left out). */
  findSummaries(userId: string, leadIds: string[]): Promise<LeadSummary[]>;
  /** Whether the user owns a lead with this id. */
  exists(userId: string, leadId: string): Promise<boolean>;
}
