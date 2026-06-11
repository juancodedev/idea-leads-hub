import { z } from 'zod';

export const LeadSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  company: z.string().min(2, 'La empresa es requerida'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  status: z.enum(['Nuevo', 'Contactado', 'Interesado', 'Propuesta', 'Ganado', 'Perdido']),
  source: z.string().optional(),
  notes: z.string().optional(),
  pipelineId: z.preprocess((val) => val === '' ? undefined : val, z.string().uuid().optional()),
  stageId: z.preprocess((val) => val === '' ? undefined : val, z.string().uuid().optional()),
});

export const ApiCreateLeadSchema = z.object({
  empresa: z.string().min(1, 'La empresa es obligatoria'),
  email: z.string().email('Email inválido'),
  origen: z.string().min(1, 'El origen es obligatorio'),
  nombre: z.string().optional(),
  telefono: z.string().optional(),
  notas: z.string().optional(),
  status: z.enum(['Nuevo', 'Contactado', 'Interesado', 'Propuesta', 'Ganado', 'Perdido']).optional(),
}).strict(); // strict() to prevent extra fields injection

export type LeadFormValues = z.infer<typeof LeadSchema>;
export type ApiCreateLeadValues = z.infer<typeof ApiCreateLeadSchema>;
