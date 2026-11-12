/**
 * @jest-environment node
 */

import {
  API_KEY_PREFIX,
  extractApiKey,
  generateApiKey,
  hashApiKey,
  isApiKey,
  verifyApiKey,
} from '../api-key';

function requestWith(headers: Record<string, string>): Request {
  return new Request('http://localhost:3000/api/leads', { headers });
}

describe('generateApiKey', () => {
  it('returns a prefixed key, its recognizable prefix and a sha-256 hash', () => {
    const generated = generateApiKey();

    expect(generated.key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(generated.prefix).toBe(generated.key.slice(0, 12));
    expect(generated.hash).toBe(hashApiKey(generated.key));
    expect(generated.hash).toHaveLength(64);
    expect(generated.key).not.toContain(generated.hash);
  });

  it('never repeats a key', () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key);
  });
});

describe('extractApiKey', () => {
  it('reads the X-API-Key header', () => {
    const key = generateApiKey().key;
    expect(extractApiKey(requestWith({ 'x-api-key': key }))).toBe(key);
  });

  it('reads a Bearer CRM key', () => {
    const key = generateApiKey().key;
    expect(extractApiKey(requestWith({ authorization: `Bearer ${key}` }))).toBe(key);
  });

  it('ignores a Supabase JWT in the Authorization header', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.signature';
    expect(extractApiKey(requestWith({ authorization: `Bearer ${jwt}` }))).toBeNull();
  });

  it('ignores non-CRM values in X-API-Key and a missing header', () => {
    expect(extractApiKey(requestWith({ 'x-api-key': 'not-a-crm-key' }))).toBeNull();
    expect(extractApiKey(requestWith({}))).toBeNull();
  });
});

describe('isApiKey', () => {
  it('only accepts the CRM prefix', () => {
    expect(isApiKey(`${API_KEY_PREFIX}abc`)).toBe(true);
    expect(isApiKey('Bearer crm_abc')).toBe(false);
    expect(isApiKey('')).toBe(false);
  });
});

function fakeAdmin(result: { data: unknown; error: unknown }) {
  const update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
  const admin = {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue(result),
        }),
      }),
      update,
    }),
  };
  return { admin, update };
}

describe('verifyApiKey', () => {
  it('resolves the owner and stamps last_used_at', async () => {
    const { admin, update } = fakeAdmin({
      data: { id: 'key-1', user_id: 'user-1', revoked_at: null },
      error: null,
    });

    const owner = await verifyApiKey('crm_abc', admin as never);

    expect(owner).toEqual({ apiKeyId: 'key-1', userId: 'user-1' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ last_used_at: expect.any(String) }));
  });

  it('rejects revoked keys', async () => {
    const { admin, update } = fakeAdmin({
      data: { id: 'key-1', user_id: 'user-1', revoked_at: '2026-01-01T00:00:00.000Z' },
      error: null,
    });

    await expect(verifyApiKey('crm_abc', admin as never)).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects unknown keys and database errors', async () => {
    const missing = fakeAdmin({ data: null, error: null });
    const failed = fakeAdmin({ data: null, error: { message: 'boom' } });

    await expect(verifyApiKey('crm_unknown', missing.admin as never)).resolves.toBeNull();
    await expect(verifyApiKey('crm_unknown', failed.admin as never)).resolves.toBeNull();
  });
});
