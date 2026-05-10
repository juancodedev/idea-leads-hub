import { Activity } from "../../domain/entities/Activity";
import { ActivityType } from "../../domain/enums/ActivityType";

export class ActivityMapper {
  static toDomain(row: any): Activity {
    return {
      id: row.id,
      leadId: row.lead_id,
      userId: row.user_id,
      type: row.type as ActivityType,
      title: row.title,
      description: row.description,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      completed: row.completed,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  static toPersistence(activity: Partial<Activity>) {
    const persistence: any = {};
    
    if (activity.leadId) persistence.lead_id = activity.leadId;
    if (activity.type) persistence.type = activity.type;
    if (activity.title) persistence.title = activity.title;
    if (activity.description !== undefined) persistence.description = activity.description;
    if (activity.dueDate !== undefined) persistence.due_date = activity.dueDate?.toISOString();
    if (activity.completed !== undefined) persistence.completed = activity.completed;
    if (activity.completedAt !== undefined) persistence.completed_at = activity.completedAt?.toISOString();
    
    return persistence;
  }
}
