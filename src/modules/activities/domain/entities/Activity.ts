import { ActivityType } from "../enums/ActivityType";

export interface Activity {
  id: string;
  leadId: string;
  userId: string;
  type: ActivityType;
  title: string;
  description: string;
  dueDate?: Date;
  completed: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateActivityDTO = Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt' | 'userId'>;
export type UpdateActivityDTO = Partial<CreateActivityDTO> & { id: string; completed?: boolean; completedAt?: Date };
