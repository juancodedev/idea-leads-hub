import { CreateActivity } from "./CreateActivity";
import { ActivityRepository } from "../../domain/repositories/ActivityRepository";
import { ActivityType } from "../../domain/enums/ActivityType";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { Activity } from "../../domain/entities/Activity";

describe('CreateActivity Use Case', () => {
  let createActivity: CreateActivity;
  let mockRepository: jest.Mocked<ActivityRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      getById: jest.fn(),
      getForLead: jest.fn(),
      getPending: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      complete: jest.fn(),
      moveStatus: jest.fn(),
      markRead: jest.fn(),
      markUnread: jest.fn(),
      getUnreadCount: jest.fn(),
    } as any;
    createActivity = new CreateActivity(mockRepository);
  });

  it('should create an activity with valid data', async () => {
    const dto = {
      leadId: '123e4567-e89b-12d3-a456-426614174000',
      type: ActivityType.CALL,
      title: 'Llamada inicial',
      description: 'Llamar para presentarse',
      dueDate: new Date(),
    };

    const expectedActivity: Activity = {
      id: 'activity-id',
      userId: 'user-id',
      completed: false,
      status: ActivityStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...dto
    };

    mockRepository.create.mockResolvedValue(expectedActivity);

    const result = await createActivity.execute(dto);

    expect(result).toEqual(expectedActivity);
    expect(mockRepository.create).toHaveBeenCalledWith(dto);
  });

  it('should pass an explicit status through to the repository (P3.3)', async () => {
    const dto = {
      type: ActivityType.CALL,
      title: 'Llamada inicial',
      status: ActivityStatus.IN_PROGRESS,
    };

    const expectedActivity: Activity = {
      id: 'activity-id',
      userId: 'user-id',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...dto
    };

    mockRepository.create.mockResolvedValue(expectedActivity);

    const result = await createActivity.execute(dto);

    expect(mockRepository.create).toHaveBeenCalledWith(dto);
    expect(result.status).toBe(ActivityStatus.IN_PROGRESS);
  });

  it('should throw an error if title is empty', async () => {
    const dto = {
      leadId: 'lead-id',
      type: ActivityType.CALL,
      title: '',
      description: 'Desc',
    };

    await expect(createActivity.execute(dto)).rejects.toThrow("El título de la actividad es obligatorio");
  });
});
