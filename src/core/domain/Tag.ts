export interface Tag {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
}

export interface CreateTagDTO {
  name: string;
  color?: string;
}

export interface EntityTag {
  id: string;
  tagId: string;
  entityId: string;
  entityType: 'lead' | 'idea';
  userId: string;
  createdAt: string;
}
