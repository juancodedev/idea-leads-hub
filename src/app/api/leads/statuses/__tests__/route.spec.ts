/**
 * @jest-environment node
 */

jest.mock('@/lib/api/with-auth', () => ({
  withAuth: jest.fn(),
}));

const mockGetAll = jest.fn();
const mockRepository = jest.fn();

jest.mock('@/infrastructure/repositories/SupabasePipelineRepository', () => ({
  SupabasePipelineRepository: function MockPipelineRepository(
    supabase: unknown,
    scopedUserId?: string
  ) {
    mockRepository(supabase, scopedUserId);
    return { getAll: mockGetAll };
  },
}));

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { GET } from '../route';

const pipeline = {
  id: 'pipeline-1',
  name: 'Pipeline de Ventas',
  userId: 'user-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  stages: [
    {
      id: 'stage-1',
      pipelineId: 'pipeline-1',
      userId: 'user-1',
      name: 'Nuevo',
      position: 1,
      color: '#3b82f6',
      isClosed: false,
      isWon: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'stage-3',
      pipelineId: 'pipeline-1',
      userId: 'user-1',
      name: 'Interesado',
      position: 3,
      color: '#f59e0b',
      isClosed: false,
      isWon: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'stage-4',
      pipelineId: 'pipeline-1',
      userId: 'user-1',
      name: 'Perdido',
      position: 6,
      color: '#ef4444',
      isClosed: true,
      isWon: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
  ],
};

function get(): NextRequest {
  return new NextRequest('http://localhost:3000/api/leads/statuses');
}

describe('GET /api/leads/statuses', () => {
  beforeEach(() => {
    mockGetAll.mockReset();
    mockRepository.mockReset();
    (withAuth as jest.Mock).mockResolvedValue({
      supabase: {},
      user: { id: 'user-1', email: 'test@example.com' },
      authType: 'session',
    });
  });

  it('publishes the pipeline stages as the valid status catalog', async () => {
    mockGetAll.mockResolvedValue([pipeline]);

    const response = await GET(get());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.names).toEqual(['Nuevo', 'Interesado', 'Perdido']);
    expect(body.statuses[0]).toEqual({
      name: 'Nuevo',
      stageId: 'stage-1',
      pipelineId: 'pipeline-1',
      pipelineName: 'Pipeline de Ventas',
      position: 1,
      color: '#3b82f6',
      isClosed: false,
      isWon: false,
    });
    expect(body.default).toBe('Nuevo');
  });

  it('opts in to API keys and scopes the repository to the key owner', async () => {
    (withAuth as jest.Mock).mockResolvedValue({
      supabase: {},
      user: { id: 'user-1', email: null },
      authType: 'api_key',
      scopedUserId: 'user-1',
    });
    mockGetAll.mockResolvedValue([pipeline]);

    await GET(get());

    expect(withAuth).toHaveBeenCalledWith(expect.anything(), { allowApiKey: true });
    expect(mockRepository).toHaveBeenCalledWith({}, 'user-1');
  });

  it('answers an empty catalog when the user has no pipeline yet', async () => {
    mockGetAll.mockResolvedValue([]);

    const response = await GET(get());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.statuses).toEqual([]);
    expect(body.names).toEqual([]);
    expect(body.default).toBe('Nuevo');
  });
});