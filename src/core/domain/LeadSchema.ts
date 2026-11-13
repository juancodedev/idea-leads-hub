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
 * API numeric field. Accepts a number or a numeric string (`"4.9"` → `4.9`,
 * for clients that serialize everything as text), plus the two sentinels the
 * upsert contract defines: `null` = keep the stored value, `""` = clear it.
 */
export type ApiNumber = number | '' | null | undefined;

const apiNumber = (schema: z.ZodNumber): z.ZodType<ApiNumber> =>
  z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? Number(val) : val),
    z.any().superRefine((val, ctx) => {
      if (val === undefined || val === null || val === '') return;
      if (typeof val !== 'number' || Number.isNaN(val)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expected number' });
        return;
      }
      const parsed = schema.safeParse(val);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) ctx.addIssue(issue);
      }
    })
  ) as z.ZodType<ApiNumber>;

/** Optional email that also accepts `""` to clear the stored value. */
const apiEmail = () => z.union([z.string().email('Invalid email'), z.literal('')]).nullish();

/** Optional URL that also accepts `""` to clear the stored value. */
const apiUrl = (message: string) =>
  z.union([z.string().url(message), z.literal('')]).nullish();

/**
 * ApiCreateLeadSchema — API validation.
 *
 * English camelCase is the canonical contract. The five legacy Spanish create
 * fields are still accepted for backward compatibility with existing clients
 * and are documented as deprecated in /api/docs; new clients must not use them.
 *
 * Every optional field is `nullish`: a client may send `null` for data it does
 * not know yet, and the route treats it as "not sent" instead of a 400.
 */
export const ApiCreateLeadSchema = z.object({
  // English fields (canonical)
  company: z.string().min(1, 'Company is required').nullish(),
  email: apiEmail(),
  source: z.string().min(1, 'Source is required').nullish(),
  name: z.string().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  website: apiUrl('Invalid URL'),
  notes: z.string().nullish(),
  status: LeadStatusEnum.nullish(),

  instagramHandle: z.string().nullish(),
  instagramScopedId: z.string().nullish(),
  jobTitle: z.string().nullish(),
  linkedinUrl: apiUrl('Invalid URL'),
  estimatedValue: apiNumber(z.number()),
  nextFollowUp: z.string().nullish(),

  /** Client-owned id (e.g. the prospect domain). Enables upsert. */
  externalId: z.string().trim().min(1, 'externalId cannot be empty').max(200).nullish(),
  city: z.string().nullish(),
  industry: z.string().nullish(),
  opportunityScore: apiNumber(optionalScore),
  rating: apiNumber(optionalRating),
  reviewsCount: apiNumber(optionalCount),

  // Spanish fields (deprecated — kept for backward compat)
  empresa: z.string().min(1, 'La empresa es obligatoria').nullish(),
  origen: z.string().min(1, 'El origen es obligatorio').nullish(),
  nombre: z.string().nullish(),
  telefono: z.string().nullish(),
  direccion: z.string().nullish(),
  sitio_web: apiUrl('URL inválida'),
  notas: z.string().nullish(),
}).strict().refine(
  (data) => data.company || data.empresa,
  { message: 'company or empresa is required', path: ['company'] }
).refine(
  (data) => data.source || data.origen,
  { message: 'source or origen is required', path: ['source'] }
);

/**
 * ApiUpdateLeadSchema — PATCH /api/leads/{id} (English fields only).
 * An empty string clears the stored value; `null` is treated as "not sent".
 */
export const ApiUpdateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  email: apiEmail(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  website: apiUrl('Invalid URL'),
  source: z.string().nullish(),
  notes: z.string().nullish(),
  status: z.string().nullish(),
  pipelineId: z.string().uuid().nullish(),
  stageId: z.string().uuid().nullish(),
  instagramHandle: z.string().nullish(),
  instagramScopedId: z.string().nullish(),
  jobTitle: z.string().nullish(),
  linkedinUrl: apiUrl('Invalid URL'),
  estimatedValue: apiNumber(z.number()).nullable(),
  nextFollowUp: z.string().nullish(),
  externalId: z.string().trim().min(1).max(200).optional(),
  city: z.string().nullish(),
  industry: z.string().nullish(),
  opportunityScore: apiNumber(optionalScore).nullable(),
  rating: apiNumber(optionalRating).nullable(),
  reviewsCount: apiNumber(optionalCount).nullable(),
});

export type LeadFormValues = z.infer<typeof LeadSchema>;
export type ApiCreateLeadValues = z.infer<typeof ApiCreateLeadSchema>;
export type ApiUpdateLeadValues = z.infer<typeof ApiUpdateLeadSchema>;
