/**
 * Tests for PipelineSettings — full pipeline management page.
 *
 * Spec: 1.1 → 1.7
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, createMockRepositories } from '@/lib/test-utils';
import { PipelineSettings } from '../PipelineSettings';
import type { Pipeline, PipelineStage } from '@/core/domain/Pipeline';

const mockStages: PipelineStage[] = [
  { id: 's1', pipelineId: 'p1', userId: 'u1', name: 'Nuevo', position: 0, color: '#6b7280', isClosed: false, isWon: false, createdAt: '' },
  { id: 's2', pipelineId: 'p1', userId: 'u1', name: 'Contactado', position: 1, color: '#3b82f6', isClosed: false, isWon: false, createdAt: '' },
];

const s3Stages: PipelineStage[] = [
  { id: 's3', pipelineId: 'p2', userId: 'u1', name: 'Abierto', position: 0, color: '#22c55e', isClosed: false, isWon: false, createdAt: '' },
];

const mockPipelines: Pipeline[] = [
  {
    id: 'p1',
    name: 'Ventas',
    userId: 'u1',
    createdAt: '2024-01-01T00:00:00Z',
    stages: mockStages,
  },
  {
    id: 'p2',
    name: 'Soporte',
    userId: 'u1',
    createdAt: '2024-01-01T00:00:00Z',
    stages: s3Stages,
  },
];

// --- Mock sonner toast ---
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

describe('PipelineSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show pipeline selector when multiple pipelines exist', async () => {
    const repos = createMockRepositories();
    repos.pipeline.getAll = jest.fn().mockResolvedValue(mockPipelines);
    repos.pipeline.getStages = jest.fn().mockResolvedValue(mockStages);
    repos.lead.getAll = jest.fn().mockResolvedValue([]);

    renderWithProviders(<PipelineSettings />, { repos });

    await waitFor(() => {
      expect(screen.getByText('Ventas')).toBeInTheDocument();
    });
  });

  it('should display stages for the selected pipeline', async () => {
    const repos = createMockRepositories();
    repos.pipeline.getAll = jest.fn().mockResolvedValue(mockPipelines);
    repos.pipeline.getStages = jest.fn().mockResolvedValue(mockStages);
    repos.lead.getAll = jest.fn().mockResolvedValue([]);

    renderWithProviders(<PipelineSettings />, { repos });

    await waitFor(() => {
      expect(screen.getByText('Nuevo')).toBeInTheDocument();
      expect(screen.getByText('Contactado')).toBeInTheDocument();
    });
  });

  it('should show empty state on API failure gracefully', async () => {
    const repos = createMockRepositories();
    repos.pipeline.getAll = jest.fn().mockRejectedValue(new Error('Network error'));

    renderWithProviders(<PipelineSettings />, { repos });

    await waitFor(() => {
      // Should show error toast
      expect(mockToastError).toHaveBeenCalledWith('Error al cargar pipelines');
    });
  });

  it('should show add stage button', async () => {
    const repos = createMockRepositories();
    repos.pipeline.getAll = jest.fn().mockResolvedValue(mockPipelines);
    repos.pipeline.getStages = jest.fn().mockResolvedValue(mockStages);
    repos.lead.getAll = jest.fn().mockResolvedValue([]);

    renderWithProviders(<PipelineSettings />, { repos });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /añadir etapa|nueva etapa/i })).toBeInTheDocument();
    });
  });

  it('should handle stage creation via AddStageButton', async () => {
    const repos = createMockRepositories();
    repos.pipeline.getAll = jest.fn().mockResolvedValue(mockPipelines);
    repos.pipeline.getStages = jest.fn().mockResolvedValue(mockStages);
    repos.pipeline.createStage = jest.fn().mockResolvedValue({
      id: 's4',
      pipelineId: 'p1',
      userId: 'u1',
      name: 'Revisado',
      position: 2,
      color: '#a855f7',
      isClosed: false,
      isWon: false,
      createdAt: '',
    });
    repos.lead.getAll = jest.fn().mockResolvedValue([]);

    renderWithProviders(<PipelineSettings />, { repos });

    await waitFor(() => {
      expect(screen.getByText('Nuevo')).toBeInTheDocument();
    });

    // Click add stage and submit
    const addButton = screen.getByRole('button', { name: /añadir etapa|nueva etapa/i });
    fireEvent.click(addButton);

    const input = screen.getByPlaceholderText(/nombre de la etapa/i);
    fireEvent.change(input, { target: { value: 'Revisado' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(repos.pipeline.createStage).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Revisado', pipelineId: 'p1' })
      );
    });
  });
});
