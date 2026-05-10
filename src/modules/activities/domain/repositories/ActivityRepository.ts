import { Activity, CreateActivityDTO, UpdateActivityDTO } from "../entities/Activity";

export interface ActivityRepository {
  getById(id: string): Promise<Activity | null>;
  getForLead(leadId: string): Promise<Activity[]>;
  getPending(userId: string): Promise<Activity[]>;
  create(activity: CreateActivityDTO): Promise<Activity>;
  update(activity: UpdateActivityDTO): Promise<Activity>;
  delete(id: string): Promise<void>;
  complete(id: string): Promise<Activity>;
}
