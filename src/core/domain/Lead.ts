import { Tag } from "./Tag";
import { Note } from "./Note";

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
  notes_data?: Note[];
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
