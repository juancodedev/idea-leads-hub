import { createClient } from '@/infrastructure/database/server';
import { UnauthorizedError } from '@/infrastructure/repositories/errors';

export async function withAuth(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new UnauthorizedError('No autorizado');
  return { supabase, user };
}
