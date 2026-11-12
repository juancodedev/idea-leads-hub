/**
 * @jest-environment node
 */

const mockWithAuth = jest.fn();

jest.mock('@/lib/api/with-auth', () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { DELETE } from '../[id]/route';
import { hashApiKey } from '@/lib/api/api-key';

function fakeSupabase(handlers: {
  listResult?: { data: unknown; error: unknown };
  insertResult?: { data: unknown; error: unknown };
  revokeResult?: { data: unknown; error: unknown };
} = {}) {
  const insert = jest.fn((_payload: Record<string, unknown>) => ({
    select: () => ({ single: () => Promise.resolve(handlers.insertResult) }),
  }));

  const revokeEqChain: Record<string, unknown> = {};
  revokeEqChain.eq = jest.fn(() => revokeEqChain);
  revokeEqChain.is = jest.fn(() => revokeEqChain);
  revokeEqChain.select = jest.fn(() => ({
    maybeSingle: () => Promise.resolve(handlers.revokeResult),
  }));
  const update = jest.fn((_payload: Record<string, unknown>) => revokeEqChain);

  const listEq = jest.fn(() => ({
    order: () => Promise.resolve(handlers.listResult),
  }));

  return {
    insert,
    update,
    from: jest.fn(() => ({
      insert,
      update,
      select: () => ({ eq: listEq }),
    })),
  };
}

function authorized(supabase: unknown) {
  mockWithAuth.mockResolvedValue({
    supabase,
    user: { id: 'user-1', email: 'user@example.com' },
    authType: 'session',
  });
}

describe('POST /api/auth/api-keys', () => {
  it('returns the plaintext key once and stores only its hash', async () => {
    const supabase = fakeSupabase({
      insertResult: {
        data: {
          id: 'key-1',
          name: 'Prospector',
          key_prefix: 'crm_abcdefgh',
          created_at: '2026-01-01T00:00:00.000Z',
        },
        error: null,
      },
    });
    authorized(supabase);

    const request = new NextRequest('http://localhost:3000/api/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Prospector' }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.key.startsWith('crm_')).toBe(true);
    expect(body.name).toBe('Prospector');

    const stored = supabase.insert.mock.calls[0][0] as Record<string, string>;
    expect(stored.user_id).toBe('user-1');
    expect(stored.key_hash).toBe(hashApiKey(body.key));
    expect(stored.key_hash).not.toBe(body.key);
  });

  it('rejects an empty name', async () => {
    authorized(fakeSupabase());

    const request = new NextRequest('http://localhost:3000/api/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

describe('GET /api/auth/api-keys', () => {
  it('lists only the caller keys without plaintext values', async () => {
    const supabase = fakeSupabase({
      listResult: {
        data: [
          {
            id: 'key-1',
            name: 'Prospector',
            key_prefix: 'crm_abcdefgh',
            last_used_at: null,
            revoked_at: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        error: null,
      },
    });
    authorized(supabase);

    const request = new NextRequest('http://localhost:3000/api/auth/api-keys');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].key).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('key_hash');
  });
});

describe('DELETE /api/auth/api-keys/[id]', () => {
  it('revokes the key scoped to the caller', async () => {
    const supabase = fakeSupabase({ revokeResult: { data: { id: 'key-1' }, error: null } });
    authorized(supabase);

    const request = new NextRequest('http://localhost:3000/api/auth/api-keys/key-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'key-1' }) });

    expect(response.status).toBe(204);
    const updateArg = supabase.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.revoked_at).toEqual(expect.any(String));
  });

  it('returns 404 when the key is unknown or already revoked', async () => {
    const supabase = fakeSupabase({ revokeResult: { data: null, error: null } });
    authorized(supabase);

    const request = new NextRequest('http://localhost:3000/api/auth/api-keys/key-x', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'key-x' }) });

    expect(response.status).toBe(404);
  });
});
