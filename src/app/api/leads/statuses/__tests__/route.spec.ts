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

const stage = (name: string, position: number, doNotContact = false) => ({
  id: `stage-${position}`,
  pipelineId: 'pipeline-1',
  userId: 'user-1',
  name,
  position,
  color: '#3b82f6',
  isClosed: false,
  isWon: false,
  isDoNotContact: doNotContact,
  createdAt: '2024-01-01T00:00:00.000Z',
});

const pipeline = {
  id: 'pipeline-1',
  name: 'Pipeline de Ventas',
  userId: 'user-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  stages: [
    stage('Nuevo', 1),
    stage('Contactado', 2),
    stage('Interesado', 3),
    stage('Perdido', 6, true),
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

  it('publishes the contract shape the integration consumes', async () => {
    mockGetAll.mockResolvedValue([pipeline]);

    const response = await GET(get());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      { value: 'Nuevo', label: 'Nuevo', doNotContact: false },
      { value: 'Contactado', label: 'Contactado', doNotContact: false },
      { value: 'Interesado', label: 'Interesado', doNotContact: false },
      { value: 'Perdido', label: 'Perdido', doNotContact: true },
    ]);
  });

  it('flags the statuses that mean "stop writing to this lead"', async () => {
    mockGetAll.mockResolvedValue([pipeline]);

    const body = await (await GET(get())).json();

    expect(body.filter((s: { doNotContact: boolean }) => s.doNotContact)).toEqual([
      { value: 'Perdido', label: 'Perdido', doNotContact: true },
    ]);
  });

  it('collapses a stage name repeated across pipelines, flagged if any is', async () => {
    const second = {
      ...pipeline,
      id: 'pipeline-2',
      stages: [stage('Nuevo', 1, true)],
    };
    mockGetAll.mockResolvedValue([pipeline, second]);

    const body = await (await GET(get())).json();

    expect(body.filter((s: { value: string }) => s.value === 'Nuevo')).toEqual([
      { value: 'Nuevo', label: 'Nuevo', doNotContact: true },
    ]);
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

    const body = await (await GET(get())).json();

    expect(body).toEqual([]);
  });
});