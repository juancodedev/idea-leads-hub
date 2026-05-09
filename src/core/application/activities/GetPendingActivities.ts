import { Activity } from "../../domain/Activity";
import { ActivityRepository } from "../../ports/ActivityRepository";

export class GetPendingActivities {
  constructor(private readonly activityRepository: ActivityRepository) {}

  async execute(): Promise<Activity[]> {
    return await this.activityRepository.getAllPending();
  }
}
