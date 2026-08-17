import { Activity } from "../../domain/entities/Activity";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { NotFoundError } from "@/infrastructure/repositories/errors";

export class CompleteActivity {
  constructor(private readonly repository: ActivityRepository) {}

  /** Completes via the status surface (moveStatus) so `completed` stays
   *  dual-written from `status = 'COMPLETED'` (BR-4). Throws the same
   *  NotFoundError (404) as MoveActivityStatus / MarkActivityRead.
   *  Idempotent (review-fix): already-COMPLETED rows are returned as-is
   *  without a write (no completed_at re-stamp) so callers skip the audit. */
  async execute(id: string): Promise<Activity> {
    const activity = await this.repository.getById(id);
    if (!activity) {
      throw new NotFoundError("Actividad no encontrada");
    }

    if (activity.status === ActivityStatus.COMPLETED) {
      return activity;
    }

    return await this.repository.moveStatus(id, ActivityStatus.COMPLETED);
  }
}