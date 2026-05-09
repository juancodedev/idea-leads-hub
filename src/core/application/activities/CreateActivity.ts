import { Activity, CreateActivityDTO } from "../../domain/Activity";
import { ActivityRepository } from "../../ports/ActivityRepository";

export class CreateActivity {
  constructor(private readonly activityRepository: ActivityRepository) {}

  async execute(dto: CreateActivityDTO): Promise<Activity> {
    return await this.activityRepository.create(dto);
  }
}
