import { ToggleActivityCompletion } from '../ToggleActivityCompletion';
import { ActivityRepository } from '../../../ports/ActivityRepository';
import { Activity } from '../../../domain/Activity';

describe('ToggleActivityCompletion', () => {
  let useCase: ToggleActivityCompletion;
  let mockRepository: jest.Mocked<ActivityRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      getById: jest.fn(),
      getAllPending: jest.fn(),
      toggleCompleted: jest.fn(),
      delete: jest.fn(),
    } as any;

    useCase = new ToggleActivityCompletion(mockRepository);
  });

  it('debe llamar al repositorio para cambiar el estado de completado', async () => {
    const activityId = '123';
    const completed = true;
    
    const mockActivity: Activity = {
      id: activityId,
      leadId: 'lead1',
      description: 'Test',
      type: 'Tarea',
      completed: true,
      dueDate: null,
      userId: 'user1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (mockRepository.toggleCompleted as jest.Mock).mockResolvedValue(mockActivity);

    const result = await useCase.execute(activityId, completed);

    expect(mockRepository.toggleCompleted).toHaveBeenCalledWith(activityId, completed);
    expect(result.completed).toBe(true);
  });
});
