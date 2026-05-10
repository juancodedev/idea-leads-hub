export interface Note {
  id: string;
  userId: string;
  entityId: string;
  entityType: 'lead' | 'idea';
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteDTO {
  entityId: string;
  entityType: 'lead' | 'idea';
  content: string;
}

export interface UpdateNoteDTO {
  id: string;
  content: string;
}
