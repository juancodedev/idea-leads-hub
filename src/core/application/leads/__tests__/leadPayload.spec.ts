/**
 * @jest-environment node
 */

import { buildLeadCreateDTO, buildLeadPatch } from '../leadPayload';
import { ApiCreateLeadSchema } from '@/core/domain/LeadSchema';

function parse(body: unknown) {
  const result = ApiCreateLeadSchema.safeParse(body);
  if (!result.success) throw new Error(JSON.stringify(result.error.issues));
  return result.data;
}

describe('buildLeadCreateDTO — defaults apply only on create', () => {
  it('fills status and name when the client does not send them', () => {
    const dto = buildLeadCreateDTO(parse({ company: 'Acme Inc', source: 'Prospector' }));

    expect(dto.status).toBe('Nuevo');
    expect(dto.name).toBe('Acme Inc');
  });

  it('keeps the status the client sent', () => {
    const dto = buildLeadCreateDTO(
      parse({ company: 'Acme Inc', source: 'Prospector', status: 'Interesado' })
    );

    expect(dto.status).toBe('Interesado');
  });
});

describe('buildLeadPatch — only the fields that were sent reach the database', () => {
  it('does not include status when the client omits it', () => {
    const patch = buildLeadPatch(
      parse({ company: 'Acme Inc', source: 'Prospector', externalId: 'acme.com' })
    );

    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('name');
  });

  it('regression: create with status Interesado, re-send without status keeps Interesado', () => {
    const created = buildLeadCreateDTO(
      parse({ company: 'Acme Inc', source: 'Prospector', status: 'Interesado', externalId: 'acme.com' })
    );
    expect(created.status).toBe('Interesado');
    // Reproduce what the database now holds after the create.
    const stored = { ...created };

    const patch = buildLeadPatch(
      parse({ company: 'Acme Inc', source: 'Prospector', externalId: 'acme.com' })
    );
    const afterUpdate = { ...stored, ...patch };

    expect(afterUpdate.status).toBe('Interesado');
  });

  it('keeps the stored value when the client sends null', () => {
    const patch = buildLeadPatch(
      parse({
        company: 'Acme Inc',
        source: 'Prospector',
        externalId: 'acme.com',
        email: null,
        status: null,
        notes: null,
        rating: null,
      })
    );

    expect(patch).not.toHaveProperty('email');
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('notes');
    expect(patch).not.toHaveProperty('rating');
  });

  it('clears a field when the client sends an empty string', () => {
    const patch = buildLeadPatch(
      parse({
        company: 'Acme Inc',
        source: 'Prospector',
        externalId: 'acme.com',
        email: '',
        phone: '',
        notes: '',
        rating: '',
      })
    );

    expect(patch.email).toBeNull();
    expect(patch.phone).toBeNull();
    expect(patch.notes).toBeNull();
    expect(patch.rating).toBeNull();
  });

  it('never sends externalId in the patch (it is the lookup key)', () => {
    const patch = buildLeadPatch(
      parse({ company: 'Acme Inc', source: 'Prospector', externalId: 'acme.com' })
    );

    expect(patch).not.toHaveProperty('externalId');
  });

  it('maps the deprecated Spanish aliases only when the English field is absent', () => {
    const patch = buildLeadPatch(
      parse({
        empresa: 'Acme Inc',
        origen: 'Web',
        nombre: 'Acme',
        sitio_web: 'https://acme.com',
        externalId: 'acme.com',
      })
    );

    expect(patch.company).toBe('Acme Inc');
    expect(patch.source).toBe('Web');
    expect(patch.name).toBe('Acme');
    expect(patch.website).toBe('https://acme.com');
  });
});

describe('ApiCreateLeadSchema — tolerant input', () => {
  it('accepts numeric strings', () => {
    const data = parse({
      company: 'Acme Inc',
      source: 'Prospector',
      rating: '4.9',
      reviewsCount: '132',
      opportunityScore: '87',
      estimatedValue: '1500.5',
    });

    expect(data.rating).toBe(4.9);
    // The schema normalizes numeric strings; the builders then pass numbers.
    const dto = buildLeadCreateDTO(data);
    expect(dto.rating).toBe(4.9);
    expect(dto.reviewsCount).toBe(132);
    expect(dto.opportunityScore).toBe(87);
    expect(dto.estimatedValue).toBe(1500.5);
  });

  it('rejects a non-numeric string with a readable message', () => {
    const result = ApiCreateLeadSchema.safeParse({
      company: 'Acme Inc',
      source: 'Prospector',
      rating: 'not-a-number',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['rating'], message: 'Expected number' }),
        ])
      );
    }
  });

  it('rejects an out-of-range numeric string', () => {
    const result = ApiCreateLeadSchema.safeParse({
      company: 'Acme Inc',
      source: 'Prospector',
      rating: '6',
    });

    expect(result.success).toBe(false);
  });

  it('accepts null for every optional field', () => {
    const result = ApiCreateLeadSchema.safeParse({
      company: 'Acme Inc',
      source: 'Prospector',
      email: null,
      phone: null,
      website: null,
      notes: null,
      city: null,
      industry: null,
      opportunityScore: null,
      rating: null,
      reviewsCount: null,
      externalId: null,
    });

    expect(result.success).toBe(true);
  });
});
