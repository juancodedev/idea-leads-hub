import { z } from 'zod';

// Lead status enum shared across schemas
export const LeadStatusEnum = z.enum(['Nuevo', 'Contactado', 'Interesado', 'Propuesta', 'Ganado', 'Perdido']);

/**
 * LeadSchema — Form/UI validation (English fields)
 */
export const LeadSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  company: z.string().min(2, 'La empresa es requerida'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  status: LeadStatusEnum,
  source: z.string().optional(),
  notes: z.string().optional(),
  pipelineId: z.preprocess((val) => val === '' ? undefined : val, z.string().uuid().optional()),
  stageId: z.preprocess((val) => val === '' ? undefined : val, z.string().uuid().optional()),
});

/**
 * ApiCreateLeadSchema — API validation (English fields, Spanish aliases deprecated)
 *
 * Accepts both English (canonical) and Spanish (deprecated) field names.
 * Spanish fields take precedence when both are provided (backward compat).
 * New clients should use English fields only.
 */
export const ApiCreateLeadSchema = z.object({
  // English fields (canonical)
  company: z.string().min(1, 'Company is required').optional(),
  email: z.string().email('Invalid email'),
  source: z.string().min(1, 'Source is required').optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  status: LeadStatusEnum.optional(),

  // Spanish fields (deprecated — kept for backward compat)
  empresa: z.string().min(1, 'La empresa es obligatoria').optional(),
  origen: z.string().min(1, 'El origen es obligatorio').optional(),
  nombre: z.string().optional(),
  telefono: z.string().optional(),
  notas: z.string().optional(),
}).strict().refine(
  (data) => data.company || data.empresa,
  { message: 'company or empresa is required' }
).refine(
  (data) => data.source || data.origen,
  { message: 'source or origen is required' }
);

export type LeadFormValues = z.infer<typeof LeadSchema>;
export type ApiCreateLeadValues = z.infer<typeof ApiCreateLeadSchema>;
