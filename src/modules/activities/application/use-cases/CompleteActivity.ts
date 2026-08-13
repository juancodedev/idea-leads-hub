import { Activity } from "../../domain/entities/Activity";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";

export class CompleteActivity {
  constructor(private readonly repository: ActivityRepository) {}

  /** Completes via the status surface (moveStatus) so `completed` stays
   *  dual-written from `status = 'COMPLETED'` (BR-4). */
  async execute(id: string): Promise<Activity> {
    const activity = await this.repository.getById(id);
    if (!activity) {
      throw new Error("Actividad no encontrada");
    }

    return await this.repository.moveStatus(id, ActivityStatus.COMPLETED);
  }
}