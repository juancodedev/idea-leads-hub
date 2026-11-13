export interface Note {
  id: string;
  userId: string;
  entityId: string;
  entityType: 'lead' | 'idea';
  content: string;
  /** Client-owned identifier, unique per user. Enables idempotent upserts. */
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteDTO {
  entityId: string;
  entityType: 'lead' | 'idea';
  content: string;
  /** Client-owned identifier, unique per user. Enables idempotent upserts. */
  externalId?: string;
}

export interface UpdateNoteDTO {
  id: string;
  content: string;
}
