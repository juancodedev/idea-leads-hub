export type IdeaPriority = 'Baja' | 'Media' | 'Alta' | 'Crítica';
export type IdeaStatus = 'Borrador' | 'Investigando' | 'En Progreso' | 'Validada' | 'Descartada';

export interface Idea {
  id: string;
  title: string;
  description: string;
  priority: IdeaPriority;
  status: IdeaStatus;
  relatedLeadId?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIdeaDTO {
  title: string;
  description: string;
  priority?: IdeaPriority;
  status?: IdeaStatus;
  relatedLeadId?: string;
}

export interface UpdateIdeaDTO extends Partial<CreateIdeaDTO> {
  id: string;
}
