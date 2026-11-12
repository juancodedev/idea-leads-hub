import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/infrastructure/database/server';
import { createAdminClient } from '@/infrastructure/database/admin';
import { UnauthorizedError } from '@/infrastructure/repositories/errors';
import type { Database } from '@/infrastructure/database/database.types';
import { extractApiKey, verifyApiKey } from './api-key';

export type AuthType = 'session' | 'api_key';

export interface AuthContext {
  supabase: SupabaseClient<Database>;
  user: { id: string; email?: string | null };
  authType: AuthType;
  /**
   * Set only on machine paths. API-key requests use the service-role client,
   * which bypasses RLS, so repositories MUST filter every query by this id.
   */
  scopedUserId?: string;
}

export interface WithAuthOptions {
  /** Opt in to CRM API keys. Session-only unless a route passes this flag. */
  allowApiKey?: boolean;
}

export async function withAuth(
  request: Request,
  options?: WithAuthOptions
): Promise<AuthContext> {
  if (options?.allowApiKey) {
    const rawKey = extractApiKey(request);
    if (rawKey) {
      const admin = createAdminClient();
      const owner = await verifyApiKey(rawKey, admin);
      if (!owner) throw new UnauthorizedError('API key inválida o revocada');
      return {
        supabase: admin,
        user: { id: owner.userId, email: null },
        authType: 'api_key',
        scopedUserId: owner.userId,
      };
    }
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new UnauthorizedError('No autorizado');
  return {
    supabase,
    user: { id: user.id, email: user.email },
    authType: 'session',
  };
}
