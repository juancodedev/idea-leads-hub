import { z } from 'zod';

export const LeadSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  company: z.string().min(2, 'La empresa es requerida'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  status: z.enum(['Nuevo', 'Contactado', 'Interesado', 'Propuesta', 'Ganado', 'Perdido']),
  source: z.string().optional(),
  notes: z.string().optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
});

export type LeadFormValues = z.infer<typeof LeadSchema>;
