export type ActivityType = 'Email' | 'Llamada' | 'Reunión' | 'Nota' | 'Tarea';

export interface Activity {
  id: string;
  leadId: string;
  userId: string;
  type: ActivityType;
  description: string;
  dueDate: Date | null;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateActivityDTO {
  leadId: string;
  type: ActivityType;
  description: string;
  dueDate?: Date | null;
  completed?: boolean;
}

export interface UpdateActivityDTO extends Partial<CreateActivityDTO> {
  id: string;
}
