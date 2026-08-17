import { Activity, CreateActivityDTO, UpdateActivityDTO } from "../entities/Activity";
import { ActivityType } from "../enums/ActivityType";
import { ActivityStatus } from "../enums/ActivityStatus";

export interface ActivitySearchParams {
  query?: string;
  type?: ActivityType;
  /** Rollout alias: keep until the page layer (P6) migrates to statusIn. */
  completed?: boolean;
  /** Status filter replacing the binary completed flag once the page migrates. */
  statusIn?: ActivityStatus[];
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
  /** Free status transition; dual-writes `completed = (status='COMPLETED')`. */
  moveStatus(id: string, status: ActivityStatus): Promise<Activity>;
  /** Sets `read_at=now()` only — never touches status/completed (BR-3). */
  markRead(id: string): Promise<Activity>;
  /** Clears `read_at` only — never touches status/completed (BR-3). */
  markUnread(id: string): Promise<Activity>;
  /** Count of INSTAGRAM_MESSAGE rows with `read_at IS NULL` for the user. */
  getUnreadCount(userId: string): Promise<number>;
}