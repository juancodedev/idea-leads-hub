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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLeadDTO {
  name: string;
  company: string;
  email: string;
  phone?: string;
  status?: LeadStatus;
  source?: string;
  notes?: string;
}

export interface UpdateLeadDTO extends Partial<CreateLeadDTO> {
  id: string;
}
