import { Activity } from "../../domain/entities/Activity";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { NotFoundError } from "@/infrastructure/repositories/errors";

export class MoveActivityStatus {
  constructor(private readonly repository: ActivityRepository) {}

  /** Free transition (BR-2): existence check → moveStatus. Pure — no audit
   *  logging here; the caller layers load the current row and build the
   *  changes.status.{old,new} delta (design).
   *
   *  Idempotency (review-fix): a same-status transition is a true no-op —
   *  returns `existing` WITHOUT calling moveStatus, so no row is re-written
   *  (COMPLETED→COMPLETED would re-stamp completed_at; PENDING→PENDING would
   *  clear it) and the caller skips the audit row (old === new is noise). */
  async execute(id: string, status: ActivityStatus): Promise<Activity> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new NotFoundError("Actividad no encontrada");
    }

    if (existing.status === status) {
      return existing;
    }

    return await this.repository.moveStatus(id, status);
  }
}