import { Activity, CreateActivityDTO, UpdateActivityDTO } from "../entities/Activity";
import { ActivityType } from "../enums/ActivityType";

export interface ActivitySearchParams {
  query?: string;
  type?: ActivityType;
  completed?: boolean;
  userId: string;
  page?: number;
  limit?: number;
}

export interface PaginatedActivities {
  data: Activity[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ActivityRepository {
  getById(id: string): Promise<Activity | null>;
  getForLead(leadId: string): Promise<Activity[]>;
  getForIdea(ideaId: string): Promise<Activity[]>;
  getPending(userId: string): Promise<Activity[]>;
  search(params: ActivitySearchParams): Promise<PaginatedActivities>;
  create(activity: CreateActivityDTO): Promise<Activity>;
  update(activity: UpdateActivityDTO): Promise<Activity>;
  delete(id: string): Promise<void>;
  complete(id: string): Promise<Activity>;
}
