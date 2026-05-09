import { Activity } from "../../domain/Activity";
import { ActivityRepository } from "../../ports/ActivityRepository";

export class ToggleActivityCompletion {
  constructor(private readonly activityRepository: ActivityRepository) {}

  async execute(id: string, completed: boolean): Promise<Activity> {
    return await this.activityRepository.toggleCompleted(id, completed);
  }
}
