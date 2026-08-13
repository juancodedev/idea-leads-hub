import { ActivityType } from "../enums/ActivityType";
import { ActivityStatus } from "../enums/ActivityStatus";

export interface ActivityAttachment {
  name: string;
  url: string;
  path: string;
  size: number;
  type: string;
}

export interface Activity {
  id: string;
  leadId?: string | null;
  ideaId?: string | null;
  userId: string;
  type: ActivityType;
  title: string;
  description?: string;
  dueDate?: Date | null;
  status: ActivityStatus;
  completed: boolean;
  completedAt?: Date;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  attachments?: ActivityAttachment[];
}

export type CreateActivityDTO = Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt' | 'readAt' | 'status' | 'userId'> & {
  completed?: boolean;
  status?: ActivityStatus;
};
export type UpdateActivityDTO = Omit<Partial<CreateActivityDTO>, 'completed'> & { id: string; completedAt?: Date };