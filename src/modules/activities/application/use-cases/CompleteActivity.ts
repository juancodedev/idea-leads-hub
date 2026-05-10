import { Activity } from "../../domain/entities/Activity";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";

export class CompleteActivity {
  constructor(private readonly repository: ActivityRepository) {}

  async execute(id: string): Promise<Activity> {
    const activity = await this.repository.getById(id);
    if (!activity) {
      throw new Error("Actividad no encontrada");
    }

    return await this.repository.complete(id);
  }
}
