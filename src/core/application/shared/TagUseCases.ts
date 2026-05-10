import { TagRepository } from "../../ports/TagRepository";

export class AssignTag {
  constructor(private readonly tagRepository: TagRepository) {}

  async execute(tagId: string, entityId: string, entityType: 'lead' | 'idea'): Promise<void> {
    return this.tagRepository.assignToEntity(tagId, entityId, entityType);
  }
}

export class RemoveTag {
  constructor(private readonly tagRepository: TagRepository) {}

  async execute(tagId: string, entityId: string, entityType: 'lead' | 'idea'): Promise<void> {
    return this.tagRepository.removeFromEntity(tagId, entityId, entityType);
  }
}
