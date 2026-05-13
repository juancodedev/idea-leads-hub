import { Idea, CreateIdeaDTO, UpdateIdeaDTO } from "../../domain/entities/Idea";
import { IdeaPriority, IdeaStatus } from "../../domain/enums/IdeaEnums";

export class IdeaMapper {
  static toDomain(row: any): Idea {
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      priority: row.priority as IdeaPriority,
      status: row.status as IdeaStatus,
      leadId: row.lead_id,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
      attachments: row.attachments || [],
      tags: row.idea_tags?.map((it: any) => ({
        id: it.tags.id,
        name: it.tags.name,
        color: it.tags.color,
        userId: it.tags.user_id,
        createdAt: it.tags.created_at,
      })) || [],
    };
  }

  static toPersistence(idea: Partial<Idea>): any {
    const persistence: any = {};
    if (idea.title !== undefined) persistence.title = idea.title;
    if (idea.description !== undefined) persistence.description = idea.description;
    if (idea.priority !== undefined) persistence.priority = idea.priority;
    if (idea.status !== undefined) persistence.status = idea.status;
    if (idea.leadId !== undefined) persistence.lead_id = idea.leadId;
    if (idea.createdBy !== undefined) persistence.created_by = idea.createdBy;
    if (idea.archivedAt !== undefined) persistence.archived_at = idea.archivedAt?.toISOString();
    if (idea.attachments !== undefined) persistence.attachments = idea.attachments;
    return persistence;
  }
}
