import { Activity, CreateActivityDTO, UpdateActivityDTO } from "../domain/Activity";

export interface ActivityRepository {
  getAllByLeadId(leadId: string): Promise<Activity[]>;
  getAllPending(): Promise<Activity[]>;
  create(activity: CreateActivityDTO): Promise<Activity>;
  update(activity: UpdateActivityDTO): Promise<Activity>;
  delete(id: string): Promise<void>;
  toggleCompleted(id: string, completed: boolean): Promise<Activity>;
}
