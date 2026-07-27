import { Idea, IdeaAttachment } from "../../domain/entities/Idea";
import { IdeaPriority, IdeaStatus } from "../../domain/enums/IdeaEnums";
import { Database } from "@/infrastructure/database/database.types";

type IdeaRow = Database['public']['Tables']['ideas']['Row'];
type TagRow = Database['public']['Tables']['tags']['Row'];
type IdeaLeadRow = Database['public']['Tables']['idea_leads']['Row'];
type IdeaRowInsert = Database['public']['Tables']['ideas']['Insert'];
type IdeaRowUpdate = Database['public']['Tables']['ideas']['Update'];

export class IdeaMapper {
  static toDomain(
    row: IdeaRow & {
      idea_tags?: Array<{ tags: TagRow }>;
      idea_leads?: Array<{ lead_id: string }>;
    }
  ): Idea {
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      priority: row.priority as IdeaPriority,
      status: row.status as IdeaStatus,
      leadIds: row.idea_leads?.map(il => il.lead_id) || [],
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
      attachments: (row.attachments || []) as IdeaAttachment[],
      tags: row.idea_tags?.map(it => ({
        id: it.tags.id,
        name: it.tags.name,
        color: it.tags.color,
        userId: it.tags.user_id,
        createdAt: it.tags.created_at,
      })) || [],
    };
  }

  static toPersistence(idea: Partial<Idea>): IdeaRowUpdate {
    const persistence: IdeaRowUpdate = {};
    if (idea.title !== undefined) persistence.title = idea.title;
    if (idea.description !== undefined) persistence.description = idea.description;
    if (idea.priority !== undefined) persistence.priority = idea.priority;
    if (idea.status !== undefined) persistence.status = idea.status;
    if (idea.createdBy !== undefined) persistence.created_by = idea.createdBy;
    if (idea.archivedAt !== undefined) persistence.archived_at = idea.archivedAt?.toISOString();
    if (idea.attachments !== undefined) persistence.attachments = idea.attachments;
    return persistence;
  }
}
