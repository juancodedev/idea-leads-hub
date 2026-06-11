import { ActivityRepository } from "@/modules/activities/domain/repositories/ActivityRepository";
import { NotFoundError } from "@/infrastructure/repositories/errors";

export class DeleteActivity {
  constructor(private readonly repository: ActivityRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new NotFoundError("Actividad no encontrada");
    }

    await this.repository.delete(id);
  }
}
