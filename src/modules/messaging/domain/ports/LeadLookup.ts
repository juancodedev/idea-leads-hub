export interface LeadLookup {
  /** Returns the id of the user's lead with this instagram_scoped_id, if any. */
  findLeadIdByInstagramScopedId(
    userId: string,
    instagramScopedId: string
  ): Promise<string | null>;
}
