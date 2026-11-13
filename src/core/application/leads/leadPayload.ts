import type { CreateLeadDTO, UpdateLeadDTO } from '@/core/domain/Lead';
import type { ApiCreateLeadValues } from '@/core/domain/LeadSchema';

/** Deprecated Spanish create aliases → canonical English keys. */
const ALIASES: Record<string, string> = {
  empresa: 'company',
  origen: 'source',
  nombre: 'name',
  telefono: 'phone',
  direccion: 'address',
  sitio_web: 'website',
  notas: 'notes',
};

/**
 * Fields where `""` means "clear the stored value". Every other field ignores
 * an empty string, so a client that sends `""` for a required field cannot
 * blank it.
 */
const CLEARABLE = new Set([
  'email',
  'phone',
  'address',
  'website',
  'notes',
  'instagramHandle',
  'instagramScopedId',
  'jobTitle',
  'linkedinUrl',
  'estimatedValue',
  'nextFollowUp',
  'city',
  'industry',
  'opportunityScore',
  'rating',
  'reviewsCount',
  'pipelineId',
  'stageId',
]);

export type LeadPatch = Omit<UpdateLeadDTO, 'id'>;

/** Canonical keys with the English field winning over its Spanish alias. */
function normalize(data: ApiCreateLeadValues): Record<string, unknown> {
  const canonical: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const target = ALIASES[key] ?? key;
    if (target in canonical) continue;
    canonical[target] = value;
  }

  return canonical;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
}

/**
 * Full DTO for a new lead. This is the only place where defaults are applied:
 * `status` falls back to `Nuevo` and `name` falls back to the company.
 */
export function buildLeadCreateDTO(data: ApiCreateLeadValues): CreateLeadDTO {
  const values = normalize(data);
  const company = text(values.company);

  return {
    company: company!,
    name: text(values.name) ?? company,
    status: text(values.status) ?? 'Nuevo',
    email: text(values.email),
    phone: text(values.phone),
    address: text(values.address),
    website: text(values.website),
    source: text(values.source),
    notes: text(values.notes),
    instagramHandle: text(values.instagramHandle),
    instagramScopedId: text(values.instagramScopedId),
    jobTitle: text(values.jobTitle),
    linkedinUrl: text(values.linkedinUrl),
    estimatedValue: numeric(values.estimatedValue),
    nextFollowUp: text(values.nextFollowUp),
    externalId: text(values.externalId),
    city: text(values.city),
    industry: text(values.industry),
    opportunityScore: numeric(values.opportunityScore),
    rating: numeric(values.rating),
    reviewsCount: numeric(values.reviewsCount),
  };
}

/**
 * Partial patch for the upsert update path: only the fields the client actually
 * sent reach the database, so a re-send never resets data the user edited in
 * the CRM. `null` and absent mean "keep"; `""` on a clearable field clears it.
 */
export function buildLeadPatch(data: ApiCreateLeadValues): LeadPatch {
  const values = normalize(data);
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (key === 'externalId') continue;
    if (value === undefined || value === null) continue;

    if (value === '') {
      if (CLEARABLE.has(key)) patch[key] = null;
      continue;
    }

    patch[key] = value;
  }

  return patch as LeadPatch;
}
