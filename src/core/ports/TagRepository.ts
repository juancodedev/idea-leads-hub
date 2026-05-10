import { Tag, CreateTagDTO, EntityTag } from "../domain/Tag";

export interface TagRepository {
  getAll(): Promise<Tag[]>;
  create(tag: CreateTagDTO): Promise<Tag>;
  delete(id: string): Promise<void>;
  assignToEntity(tagId: string, entityId: string, entityType: 'lead' | 'idea'): Promise<void>;
  removeFromEntity(tagId: string, entityId: string, entityType: 'lead' | 'idea'): Promise<void>;
  getForEntity(entityId: string, entityType: 'lead' | 'idea'): Promise<Tag[]>;
}
