import { Activity, ActivityAttachment } from "../../domain/entities/Activity";
import { ActivityType } from "../../domain/enums/ActivityType";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { Database } from "@/infrastructure/database/database.types";

type ActivityRow = Database['public']['Tables']['activities']['Row'];
type ActivityRowUpdate = Database['public']['Tables']['activities']['Update'];

export class ActivityMapper {
  static toDomain(row: ActivityRow): Activity {
    return {
      id: row.id,
      leadId: row.lead_id,
      ideaId: row.idea_id,
      userId: row.user_id,
      type: row.type as ActivityType,
      title: row.title,
      description: row.description,
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      // Rollout: backfilled status is authoritative; fall back to the legacy
      // completed flag for rows written before the backfill ran.
      status: (row.status as ActivityStatus) ?? (row.completed ? ActivityStatus.COMPLETED : ActivityStatus.PENDING),
      completed: row.completed,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      attachments: (row.attachments || []) as ActivityAttachment[],
    };
  }

  static toPersistence(activity: Partial<Activity>): ActivityRowUpdate {
    const persistence: ActivityRowUpdate = {};
    
    if (activity.leadId !== undefined) persistence.lead_id = activity.leadId;
    if (activity.ideaId !== undefined) persistence.idea_id = activity.ideaId;
    if (activity.type) persistence.type = activity.type;
    if (activity.title) persistence.title = activity.title;
    if (activity.description !== undefined) persistence.description = activity.description;
    if (activity.dueDate !== undefined) persistence.due_date = activity.dueDate?.toISOString();
    // Dual-write invariant: `completed` always mirrors `status = 'COMPLETED'`.
    if (activity.status !== undefined) {
      persistence.status = activity.status;
      persistence.completed = activity.status === ActivityStatus.COMPLETED;
    } else if (activity.completed !== undefined) {
      persistence.completed = activity.completed;
    }
    if (activity.completedAt !== undefined) persistence.completed_at = activity.completedAt?.toISOString();
    if (activity.readAt !== undefined) persistence.read_at = activity.readAt?.toISOString() ?? null;
    if (activity.attachments !== undefined) persistence.attachments = activity.attachments;
    
    return persistence;
  }
}
