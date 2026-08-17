'use server';

import { createClient } from '@/infrastructure/database/server';
import { SupabaseActivityRepository } from '@/modules/activities/infrastructure/repositories/SupabaseActivityRepository';
import { ActivityStatus } from '@/modules/activities/domain/enums/ActivityStatus';

export { changeActivityStatus } from '@/modules/activities/infrastructure/actions/activityActions';

export async function toggleActivityCompletion(id: string, completed: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('No autorizado');
  }

  const repository = new SupabaseActivityRepository(supabase);

  // Status surface (BR-4): complete/un-complete move through moveStatus so
  // `completed` stays dual-written from `status = 'COMPLETED'`.
  await repository.moveStatus(id, completed ? ActivityStatus.COMPLETED : ActivityStatus.PENDING);
}
