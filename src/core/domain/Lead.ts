import { Tag } from "./Tag";

export type LeadStatus = 'Nuevo' | 'Contactado' | 'Interesado' | 'Propuesta' | 'Ganado' | 'Perdido';

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  status: LeadStatus;
  source?: string;
  notes?: string;
  userId: string;
  pipelineId?: string;
  stageId?: string;
  tags?: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadDTO {
  name: string;
  company: string;
  email: string;
  phone?: string;
  status?: LeadStatus;
  source?: string;
  notes?: string;
  pipelineId?: string;
  stageId?: string;
}

export interface UpdateLeadDTO extends Partial<CreateLeadDTO> {
  id: string;
}
