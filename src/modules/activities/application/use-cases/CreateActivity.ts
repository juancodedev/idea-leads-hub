import { Activity, CreateActivityDTO } from "../../domain/entities/Activity";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";

export class CreateActivity {
  constructor(private readonly repository: ActivityRepository) {}

  async execute(dto: CreateActivityDTO): Promise<Activity> {
    if (!dto.title.trim()) {
      throw new Error("El título de la actividad es obligatorio");
    }
    return await this.repository.create(dto);
  }
}
