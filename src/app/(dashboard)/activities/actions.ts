'use server';

import { createClient } from '@/infrastructure/database/server';
import { SupabaseActivityRepository } from '@/modules/activities/infrastructure/repositories/SupabaseActivityRepository';

export async function toggleActivityCompletion(id: string, completed: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('No autorizado');
  }

  const repository = new SupabaseActivityRepository(supabase);
  
  if (completed) {
    await repository.complete(id);
  } else {
    await repository.update({ id, completed: false });
  }
}
