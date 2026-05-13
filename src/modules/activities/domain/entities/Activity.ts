import { ActivityType } from "../enums/ActivityType";

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
  completed: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  attachments?: ActivityAttachment[];
}

export type CreateActivityDTO = Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt' | 'userId'> & {
  completed?: boolean;
};
export type UpdateActivityDTO = Partial<CreateActivityDTO> & { id: string; completed?: boolean; completedAt?: Date };
