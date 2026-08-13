import { MarkActivityUnread } from "./MarkActivityUnread";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";
import { Activity } from "../../domain/entities/Activity";
import { ActivityType } from "../../domain/enums/ActivityType";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { NotFoundError } from "@/infrastructure/repositories/errors";

describe("MarkActivityUnread Use Case (P3.3)", () => {
  let markActivityUnread: MarkActivityUnread;
  let mockRepository: jest.Mocked<ActivityRepository>;

  const readActivity: Activity = {
    id: "activity-1",
    userId: "user-1",
    title: "Instagram DM",
    type: ActivityType.INSTAGRAM_MESSAGE,
    completed: true,
    status: ActivityStatus.COMPLETED,
    completedAt: new Date("2024-06-01"),
    readAt: new Date("2024-06-02"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const unreadActivity: Activity = {
    ...readActivity,
    readAt: undefined,
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
    markActivityUnread = new MarkActivityUnread(mockRepository);
  });

  it("should clear read_at only, leaving status and completed untouched (BR-3)", async () => {
    mockRepository.getById.mockResolvedValue(readActivity);
    mockRepository.markUnread.mockResolvedValue(unreadActivity);

    const result = await markActivityUnread.execute("activity-1");

    expect(mockRepository.getById).toHaveBeenCalledWith("activity-1");
    expect(mockRepository.markUnread).toHaveBeenCalledWith("activity-1");
    // unread never implies incomplete (BR-3): a COMPLETED message stays COMPLETED
    expect(result.readAt).toBeUndefined();
    expect(result.status).toBe(ActivityStatus.COMPLETED);
    expect(result.completed).toBe(true);
  });

  it("should throw NotFoundError when the activity does not exist", async () => {
    mockRepository.getById.mockResolvedValue(null);

    await expect(markActivityUnread.execute("non-existent")).rejects.toBeInstanceOf(
      NotFoundError
    );

    expect(mockRepository.markUnread).not.toHaveBeenCalled();
  });
});