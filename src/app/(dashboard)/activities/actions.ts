'use server';

import { changeActivityStatus as changeActivityStatusAction } from '@/modules/activities/infrastructure/actions/activityActions';
import { ActivityStatus } from '@/modules/activities/domain/enums/ActivityStatus';

export async function changeActivityStatus(id: string, status: ActivityStatus) {
  return changeActivityStatusAction(id, status);
}