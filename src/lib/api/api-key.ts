import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/infrastructure/database/database.types';

/** Prefix that lets the server tell a CRM API key apart from a Supabase JWT. */
export const API_KEY_PREFIX = 'crm_';

/** Number of characters shown to the user so a key is recognizable after creation. */
const PREFIX_LENGTH = 12;

export interface GeneratedApiKey {
  /** Plaintext key. Returned to the caller once and never stored. */
  key: string;
  prefix: string;
  hash: string;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): GeneratedApiKey {
  const key = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { key, prefix: key.slice(0, PREFIX_LENGTH), hash: hashApiKey(key) };
}

export function isApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX);
}

/**
 * Read the key from `X-API-Key` or `Authorization: Bearer crm_...`.
 * A Supabase JWT in the Authorization header is not an API key and yields null.
 */
export function extractApiKey(request: Request): string | null {
  const header = request.headers.get('x-api-key');
  if (header && isApiKey(header.trim())) return header.trim();

  const authorization = request.headers.get('authorization');
  if (!authorization) return null;

  const [scheme, ...rest] = authorization.trim().split(/\s+/);
  if (scheme.toLowerCase() !== 'bearer') return null;

  const token = rest.join('');
  return isApiKey(token) ? token : null;
}

export interface ApiKeyOwner {
  apiKeyId: string;
  userId: string;
}

/**
 * Resolve the owner of a key and stamp its last use. Runs with the service-role
 * client because api_keys has no anonymous read policy.
 */
export async function verifyApiKey(
  rawKey: string,
  admin: SupabaseClient<Database>
): Promise<ApiKeyOwner | null> {
  // The generated Database type does not satisfy GenericSchema, so typed
  // queries degrade to `never`; rows are cast like the rest of the repositories.
  const { data, error } = await admin
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', hashApiKey(rawKey))
    .maybeSingle();

  const row = data as unknown as { id: string; user_id: string; revoked_at: string | null } | null;
  if (error || !row || row.revoked_at) return null;

  await admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq('id', row.id);

  return { apiKeyId: row.id, userId: row.user_id };
}
