import { Activity } from "@/modules/activities/domain/entities/Activity";
import { ActivityRepository } from "@/modules/activities/domain/repositories/ActivityRepository";

export class GetActivities {
  constructor(private readonly repository: ActivityRepository) {}

  async execute(filters?: { leadId?: string; ideaId?: string }): Promise<Activity[]> {
    if (filters?.leadId) {
      return await this.repository.getForLead(filters.leadId);
    }

    if (filters?.ideaId) {
      return await this.repository.getForIdea(filters.ideaId);
    }

    return [];
  }
}
