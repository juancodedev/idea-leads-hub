import { z } from 'zod';

// Lead status enum shared across schemas
export const LeadStatusEnum = z.string();

/** Numeric form input (`''` while empty) or a number. */
const formNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    schema.optional()
  );

const optionalScore = z.number().int().min(0, 'Mínimo 0').max(100, 'Máximo 100');
const optionalRating = z.number().min(0, 'Mínimo 0').max(5, 'Máximo 5');
const optionalCount = z.number().int().min(0, 'No puede ser negativo');

/**
 * LeadSchema — Form/UI validation (English fields).
 * Email is optional: leads that only have WhatsApp or Instagram are valid.
 */
export const LeadSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  company: z.string().min(2, 'La empresa es requerida'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  status: LeadStatusEnum,
  source: z.string().optional(),
  notes: z.string().optional(),
  pipelineId: z.preprocess((val) => val === '' ? undefined : val, z.string().uuid().optional()),
  stageId: z.preprocess((val) => val === '' ? undefined : val, z.string().uuid().optional()),
  instagramHandle: z.string().optional(),
  instagramScopedId: z.string().optional(),
  jobTitle: z.string().optional(),
  linkedinUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  estimatedValue: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : Number(val)),
    z.number().positive('El valor debe ser positivo').optional()
  ),
  nextFollowUp: z.string().optional(),
  externalId: z.string().max(200, 'Máximo 200 caracteres').optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  opportunityScore: formNumber(optionalScore),
  rating: formNumber(optionalRating),
  reviewsCount: formNumber(optionalCount),
});

/**
 * ApiCreateLeadSchema — API validation.
 *
 * English camelCase is the canonical contract. The five legacy Spanish create
 * fields are still accepted for backward compatibility with existing clients
 * and are documented as deprecated in /api/docs; new clients must not use them.
 */
export const ApiCreateLeadSchema = z.object({
  // English fields (canonical)
  company: z.string().min(1, 'Company is required').optional(),
  email: z.string().email('Invalid email').optional(),
  source: z.string().min(1, 'Source is required').optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url('Invalid URL').optional(),
  notes: z.string().optional(),
  status: LeadStatusEnum.optional(),

  instagramHandle: z.string().optional(),
  instagramScopedId: z.string().optional(),
  jobTitle: z.string().optional(),
  linkedinUrl: z.string().optional(),
  estimatedValue: z.number().optional(),
  nextFollowUp: z.string().optional(),

  /** Client-owned id (e.g. the prospect domain). Enables upsert. */
  externalId: z.string().trim().min(1, 'externalId cannot be empty').max(200).optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  opportunityScore: optionalScore.optional(),
  rating: optionalRating.optional(),
  reviewsCount: optionalCount.optional(),

  // Spanish fields (deprecated — kept for backward compat)
  empresa: z.string().min(1, 'La empresa es obligatoria').optional(),
  origen: z.string().min(1, 'El origen es obligatorio').optional(),
  nombre: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  sitio_web: z.string().url('URL inválida').optional(),
  notas: z.string().optional(),
}).strict().refine(
  (data) => data.company || data.empresa,
  { message: 'company or empresa is required' }
).refine(
  (data) => data.source || data.origen,
  { message: 'source or origen is required' }
);

/**
 * ApiUpdateLeadSchema — PATCH /api/leads/{id} (English fields only).
 * An empty string clears the stored value.
 */
export const ApiUpdateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  source: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  pipelineId: z.string().uuid().optional().nullable(),
  stageId: z.string().uuid().optional().nullable(),
  instagramHandle: z.string().optional(),
  instagramScopedId: z.string().optional(),
  jobTitle: z.string().optional(),
  linkedinUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  estimatedValue: z.number().optional().nullable(),
  nextFollowUp: z.string().optional().nullable(),
  externalId: z.string().trim().min(1).max(200).optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  opportunityScore: optionalScore.optional().nullable(),
  rating: optionalRating.optional().nullable(),
  reviewsCount: optionalCount.optional().nullable(),
});

export type LeadFormValues = z.infer<typeof LeadSchema>;
export type ApiCreateLeadValues = z.infer<typeof ApiCreateLeadSchema>;
export type ApiUpdateLeadValues = z.infer<typeof ApiUpdateLeadSchema>;
