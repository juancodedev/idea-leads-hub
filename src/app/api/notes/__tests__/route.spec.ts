/**
 * @jest-environment node
 */

jest.mock('@/lib/api/with-auth', () => ({
  withAuth: jest.fn(),
}));

const mockCreate = jest.fn();
const mockUpsert = jest.fn();
const mockRepository = jest.fn();

jest.mock('@/infrastructure/repositories/SupabaseNoteRepository', () => ({
  SupabaseNoteRepository: function MockNoteRepository(supabase: unknown, scopedUserId?: string) {
    mockRepository(supabase, scopedUserId);
    return { create: mockCreate, upsertByExternalId: mockUpsert };
  },
}));

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { POST } from '../route';

const storedNote = {
  id: 'note-1',
  userId: 'user-1',
  entityId: 'lead-1',
  entityType: 'lead' as const,
  content: 'Research',
  externalId: 'cafe-lindo.cl#investigacion',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/notes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = {
  entityId: '11111111-1111-4111-8111-111111111111',
  entityType: 'lead',
  content: 'Research',
};

describe('POST /api/notes', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpsert.mockReset();
    mockRepository.mockReset();
    (withAuth as jest.Mock).mockResolvedValue({
      supabase: {},
      user: { id: 'user-1', email: 'test@example.com' },
      authType: 'session',
    });
  });

  it('opts in to API keys and scopes the repository to the key owner', async () => {
    (withAuth as jest.Mock).mockResolvedValue({
      supabase: {},
      user: { id: 'user-1', email: null },
      authType: 'api_key',
      scopedUserId: 'user-1',
    });
    mockCreate.mockResolvedValue(storedNote);

    await POST(post(validBody));

    expect(withAuth).toHaveBeenCalledWith(expect.anything(), { allowApiKey: true });
    expect(mockRepository).toHaveBeenCalledWith({}, 'user-1');
  });

  it('creates without externalId and returns 201', async () => {
    mockCreate.mockResolvedValue({ ...storedNote, externalId: undefined });

    const response = await POST(post(validBody));

    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Research', entityType: 'lead' })
    );
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('upserts by externalId and returns 201 the first time', async () => {
    mockUpsert.mockResolvedValue({ note: storedNote, created: true });

    const response = await POST(
      post({ ...validBody, externalId: 'cafe-lindo.cl#investigacion' })
    );

    expect(response.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'cafe-lindo.cl#investigacion' })
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 200 when the same externalId is sent again, instead of duplicating', async () => {
    mockUpsert.mockResolvedValue({ note: storedNote, created: false });

    const response = await POST(
      post({ ...validBody, externalId: 'cafe-lindo.cl#investigacion' })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe('note-1');
  });

  it('treats a null externalId as absent', async () => {
    mockCreate.mockResolvedValue(storedNote);

    const response = await POST(post({ ...validBody, externalId: null }));

    expect(response.status).toBe(201);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('answers 400 with field-keyed messages', async () => {
    const response = await POST(post({ ...validBody, entityId: 'not-a-uuid' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields.entityId).toBeDefined();
  });
});
