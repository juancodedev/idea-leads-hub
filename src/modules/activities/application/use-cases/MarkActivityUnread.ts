import { Activity } from "../../domain/entities/Activity";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";
import { NotFoundError } from "@/infrastructure/repositories/errors";

export class MarkActivityUnread {
  constructor(private readonly repository: ActivityRepository) {}

  /** Clears `read_at` only — never touches status/completed (BR-3). */
  async execute(id: string): Promise<Activity> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new NotFoundError("Actividad no encontrada");
    }

    return await this.repository.markUnread(id);
  }
}