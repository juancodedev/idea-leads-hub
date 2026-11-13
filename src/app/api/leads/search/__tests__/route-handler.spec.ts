/**
 * @jest-environment node
 */

const mockWithAuth = jest.fn();

jest.mock('@/lib/api/with-auth', () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

const mockGetAll = jest.fn();

jest.mock('@/infrastructure/repositories/SupabaseLeadRepository', () => ({
  SupabaseLeadRepository: jest
    .fn()
    .mockImplementation(() => ({ getAll: mockGetAll })),
}));

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { UnauthorizedError } from '@/infrastructure/repositories/errors';

const leads = [
  {
    id: 'lead-1',
    name: 'Acme',
    company: 'Acme Inc',
    email: 'hola@acme.com',
    externalId: 'acme.com',
    status: 'Nuevo',
    source: 'Prospector',
  },
  {
    id: 'lead-2',
    name: 'Sin correo',
    company: 'WhatsApp Only',
    email: undefined,
    externalId: undefined,
    status: 'Nuevo',
    source: 'Prospector',
  },
];

function request(url = 'http://localhost:3000/api/leads/search?q=acme') {
  return new NextRequest(url);
}

describe('GET /api/leads/search — route handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 instead of 500 when no session or API key is sent', async () => {
    mockWithAuth.mockRejectedValue(new UnauthorizedError('No autorizado'));

    const response = await GET(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'No autorizado' });
  });

  it('scopes the repository by the API-key user and matches externalId', async () => {
    const supabase = { from: jest.fn() };
    mockWithAuth.mockResolvedValue({
      supabase,
      user: { id: 'user-1', email: null },
      authType: 'api_key',
      scopedUserId: 'user-1',
    });
    mockGetAll.mockResolvedValue(leads);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockWithAuth).toHaveBeenCalledWith(expect.anything(), { allowApiKey: true });
    expect(SupabaseLeadRepository).toHaveBeenCalledWith(supabase, 'user-1');
    expect(body.map((lead: { id: string }) => lead.id)).toEqual(['lead-1']);
  });

  it('does not crash on leads without email', async () => {
    mockWithAuth.mockResolvedValue({
      supabase: {},
      user: { id: 'user-1', email: null },
      authType: 'api_key',
      scopedUserId: 'user-1',
    });
    mockGetAll.mockResolvedValue(leads);

    const response = await GET(request('http://localhost:3000/api/leads/search?q=whatsapp'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { id: 'lead-2', name: 'Sin correo', company: 'WhatsApp Only', status: 'Nuevo' },
    ]);
  });

  it('returns 400 when q is missing', async () => {
    mockWithAuth.mockResolvedValue({
      supabase: {},
      user: { id: 'user-1', email: null },
      authType: 'session',
    });

    const response = await GET(request('http://localhost:3000/api/leads/search'));

    expect(response.status).toBe(400);
  });
});
