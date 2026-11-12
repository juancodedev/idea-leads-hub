/**
 * @jest-environment node
 */

jest.mock('@/lib/api/with-auth', () => ({
  withAuth: jest.fn().mockResolvedValue({
    supabase: {},
    user: { id: 'user-1', email: 'test@example.com' },
    authType: 'session',
  }),
}));

const mockCreate = jest.fn();
const mockUpsert = jest.fn();

jest.mock('@/infrastructure/repositories/SupabaseLeadRepository', () => ({
  SupabaseLeadRepository: jest.fn().mockImplementation(() => ({
    search: jest.fn(),
    create: mockCreate,
    upsertByExternalId: mockUpsert,
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateStatus: jest.fn(),
  })),
}));

import { NextRequest } from 'next/server';
import { POST } from '../route';

const storedLead = {
  id: 'lead-1',
  name: 'Acme Inc',
  company: 'Acme Inc',
  status: 'Nuevo',
  userId: 'user-1',
  tags: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/leads', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/leads — idempotent integration contract', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpsert.mockReset();
  });

  it('creates without externalId and returns 201', async () => {
    mockCreate.mockResolvedValue(storedLead);

    const response = await POST(post({ company: 'Acme Inc', source: 'Prospector' }));

    expect(response.status).toBe(201);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
  });

  it('upserts by externalId and returns 201 when the lead is new', async () => {
    mockUpsert.mockResolvedValue({ lead: storedLead, created: true });

    const response = await POST(
      post({ company: 'Acme Inc', source: 'Prospector', externalId: 'acme.com' })
    );

    expect(response.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'acme.com', company: 'Acme Inc' })
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 200 when the externalId already exists, so a retry does not duplicate', async () => {
    mockUpsert.mockResolvedValue({ lead: storedLead, created: false });

    const response = await POST(
      post({ company: 'Acme Inc', source: 'Prospector', externalId: 'acme.com' })
    );

    expect(response.status).toBe(200);
  });

  it('accepts a lead without email (WhatsApp-only prospects)', async () => {
    mockCreate.mockResolvedValue(storedLead);

    const response = await POST(
      post({ company: 'Acme Inc', source: 'Prospector', phone: '+54 9 11 5555 5555' })
    );

    expect(response.status).toBe(201);
  });

  it('forwards the qualification fields and keeps English as canonical', async () => {
    mockCreate.mockResolvedValue(storedLead);

    await POST(
      post({
        company: 'Acme Inc',
        source: 'Prospector',
        city: 'Rosario',
        industry: 'Retail',
        opportunityScore: 87,
        rating: 4.5,
        reviewsCount: 132,
      })
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        city: 'Rosario',
        industry: 'Retail',
        opportunityScore: 87,
        rating: 4.5,
        reviewsCount: 132,
      })
    );
  });

  it('still accepts the deprecated Spanish aliases', async () => {
    mockCreate.mockResolvedValue(storedLead);

    const response = await POST(
      post({ empresa: 'Acme Inc', origen: 'Web', nombre: 'Acme', sitio_web: 'https://acme.com' })
    );

    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ company: 'Acme Inc', source: 'Web', website: 'https://acme.com' })
    );
  });

  it('rejects an out-of-range opportunity score', async () => {
    const response = await POST(post({ company: 'Acme Inc', source: 'Web', opportunityScore: 101 }));

    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range rating', async () => {
    const response = await POST(post({ company: 'Acme Inc', source: 'Web', rating: 6 }));

    expect(response.status).toBe(400);
  });
});
