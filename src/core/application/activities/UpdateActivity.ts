import { Activity } from "@/modules/activities/domain/entities/Activity";
import { ActivityRepository } from "@/modules/activities/domain/repositories/ActivityRepository";
import { NotFoundError } from "@/infrastructure/repositories/errors";

export class UpdateActivity {
  constructor(private readonly repository: ActivityRepository) {}

  async execute(id: string, data: Record<string, unknown>): Promise<Activity> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new NotFoundError("Actividad no encontrada");
    }

    return await this.repository.update({ id, ...data });
  }
}
