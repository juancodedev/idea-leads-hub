import { GetActivities } from "../GetActivities";
import { ActivityRepository } from "@/modules/activities/domain/repositories/ActivityRepository";
import { Activity, ActivityAttachment } from "@/modules/activities/domain/entities/Activity";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";
import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";

describe("GetActivities Use Case", () => {
  let getActivities: GetActivities;
  let mockRepository: jest.Mocked<ActivityRepository>;

  const baseActivity: Activity = {
    id: "activity-1",
    userId: "user-1",
    title: "Test activity",
    type: ActivityType.TASK,
    completed: false,
    status: ActivityStatus.PENDING,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
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
    getActivities = new GetActivities(mockRepository);
  });

  it("should return activities for a lead when leadId filter is provided", async () => {
    const expected: Activity[] = [
      { ...baseActivity, id: "act-1", leadId: "lead-1" },
      { ...baseActivity, id: "act-2", leadId: "lead-1" },
    ];
    mockRepository.getForLead.mockResolvedValue(expected);

    const result = await getActivities.execute({ leadId: "lead-1" });

    expect(result).toEqual(expected);
    expect(mockRepository.getForLead).toHaveBeenCalledWith("lead-1");
    expect(mockRepository.getForIdea).not.toHaveBeenCalled();
  });

  it("should return activities for an idea when ideaId filter is provided", async () => {
    const expected: Activity[] = [
      { ...baseActivity, id: "act-3", ideaId: "idea-1" },
    ];
    mockRepository.getForIdea.mockResolvedValue(expected);

    const result = await getActivities.execute({ ideaId: "idea-1" });

    expect(result).toEqual(expected);
    expect(mockRepository.getForIdea).toHaveBeenCalledWith("idea-1");
    expect(mockRepository.getForLead).not.toHaveBeenCalled();
  });

  it("should return empty array when no filters are provided", async () => {
    const result = await getActivities.execute({});

    expect(result).toEqual([]);
    expect(mockRepository.getForLead).not.toHaveBeenCalled();
    expect(mockRepository.getForIdea).not.toHaveBeenCalled();
  });

  it("should prioritize leadId over ideaId when both are provided", async () => {
    const expected: Activity[] = [
      { ...baseActivity, id: "act-4", leadId: "lead-2" },
    ];
    mockRepository.getForLead.mockResolvedValue(expected);

    const result = await getActivities.execute({ leadId: "lead-2", ideaId: "idea-2" });

    expect(result).toEqual(expected);
    expect(mockRepository.getForLead).toHaveBeenCalledWith("lead-2");
    expect(mockRepository.getForIdea).not.toHaveBeenCalled();
  });
});
