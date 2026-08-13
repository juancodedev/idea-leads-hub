import { MarkActivityRead } from "./MarkActivityRead";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";
import { Activity } from "../../domain/entities/Activity";
import { ActivityType } from "../../domain/enums/ActivityType";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { NotFoundError } from "@/infrastructure/repositories/errors";

describe("MarkActivityRead Use Case (P3.3)", () => {
  let markActivityRead: MarkActivityRead;
  let mockRepository: jest.Mocked<ActivityRepository>;

  const unreadActivity: Activity = {
    id: "activity-1",
    userId: "user-1",
    title: "Instagram DM",
    type: ActivityType.INSTAGRAM_MESSAGE,
    completed: false,
    status: ActivityStatus.PENDING,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const readActivity: Activity = {
    ...unreadActivity,
    readAt: new Date("2024-06-01"),
  };

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      getById: jest.fn(),
      getForLead: jest.fn(),
      getForIdea: jest.fn(),
      getPending: jest.fn(),
      search: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      complete: jest.fn(),
      moveStatus: jest.fn(),
      markRead: jest.fn(),
      markUnread: jest.fn(),
      getUnreadCount: jest.fn(),
    };
    markActivityRead = new MarkActivityRead(mockRepository);
  });

  it("should set read_at only, leaving status and completed untouched (BR-3)", async () => {
    mockRepository.getById.mockResolvedValue(unreadActivity);
    mockRepository.markRead.mockResolvedValue(readActivity);

    const result = await markActivityRead.execute("activity-1");

    expect(mockRepository.getById).toHaveBeenCalledWith("activity-1");
    expect(mockRepository.markRead).toHaveBeenCalledWith("activity-1");
    // read never implies completion (BR-3)
    expect(result.readAt).toBeInstanceOf(Date);
    expect(result.status).toBe(ActivityStatus.PENDING);
    expect(result.completed).toBe(false);
  });

  it("should throw NotFoundError when the activity does not exist", async () => {
    mockRepository.getById.mockResolvedValue(null);

    await expect(markActivityRead.execute("non-existent")).rejects.toBeInstanceOf(
      NotFoundError
    );

    expect(mockRepository.markRead).not.toHaveBeenCalled();
  });
});