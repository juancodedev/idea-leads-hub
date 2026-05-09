export type IdeaStatus = 'Borrador' | 'Investigando' | 'En Progreso' | 'Validada' | 'Descartada';

export interface Idea {
  id: string;
  title: string;
  description: string;
  status: IdeaStatus;
  priority: number; // 1-5
  potentialRevenue?: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIdeaDTO {
  title: string;
  description: string;
  status: IdeaStatus;
  priority: number;
  potentialRevenue?: number;
}

export interface UpdateIdeaDTO extends Partial<CreateIdeaDTO> {
  id: string;
}
