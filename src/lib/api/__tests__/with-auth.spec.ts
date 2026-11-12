/**
 * @jest-environment node
 */

const mockGetUser = jest.fn();
const mockCreateClient = jest.fn();
const mockCreateAdminClient = jest.fn();
const mockVerifyApiKey = jest.fn();

jest.mock('@/infrastructure/database/server', () => ({
  createClient: () => mockCreateClient(),
}));

jest.mock('@/infrastructure/database/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

jest.mock('../api-key', () => {
  const actual = jest.requireActual('../api-key');
  return { ...actual, verifyApiKey: (...args: unknown[]) => mockVerifyApiKey(...args) };
});

import { withAuth } from '../with-auth';
import { UnauthorizedError } from '@/infrastructure/repositories/errors';

const adminClient = { from: jest.fn(), auth: { getUser: jest.fn() } };
const sessionClient = { from: jest.fn(), auth: { getUser: mockGetUser } };

function requestWith(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/leads', { headers });
}

describe('withAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAdminClient.mockReturnValue(adminClient);
    mockCreateClient.mockResolvedValue(sessionClient);
  });

  it('ignores an API key on session-only routes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });

    await expect(
      withAuth(requestWith({ authorization: 'Bearer crm_abc' }))
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockVerifyApiKey).not.toHaveBeenCalled();
  });

  it('resolves an API key to a scoped machine session', async () => {
    mockVerifyApiKey.mockResolvedValue({ apiKeyId: 'key-1', userId: 'user-1' });

    const auth = await withAuth(
      requestWith({ authorization: 'Bearer crm_abc' }),
      { allowApiKey: true }
    );

    expect(auth.authType).toBe('api_key');
    expect(auth.user.id).toBe('user-1');
    expect(auth.scopedUserId).toBe('user-1');
    expect(auth.supabase).toBe(adminClient);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects an invalid or revoked API key', async () => {
    mockVerifyApiKey.mockResolvedValue(null);

    await expect(
      withAuth(requestWith({ 'x-api-key': 'crm_revoked' }), { allowApiKey: true })
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('falls back to the cookie session when no key is sent', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-2', email: 'user@example.com' } },
      error: null,
    });

    const auth = await withAuth(requestWith(), { allowApiKey: true });

    expect(auth.authType).toBe('session');
    expect(auth.user.id).toBe('user-2');
    expect(auth.supabase).toBe(sessionClient);
    expect(auth.scopedUserId).toBeUndefined();
  });

  it('rejects a request without session or key', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'no session' } });

    await expect(withAuth(requestWith(), { allowApiKey: true })).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });
});
