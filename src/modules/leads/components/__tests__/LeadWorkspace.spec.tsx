/**
 * Tests for LeadWorkspace pipeline selector.
 *
 * Spec: 2.1 → 2.4
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, createMockRepositories } from '@/lib/test-utils';
import { LeadWorkspace } from '../LeadWorkspace';
import { Lead } from '@/core/domain/Lead';
import type { Pipeline, PipelineStage } from '@/core/domain/Pipeline';

const baseLead: Lead = {
  id: 'lead-1',
  name: 'Juan Pérez',
  company: 'Acme Corp',
  email: 'juan@acme.com',
  status: 'Nuevo',
  userId: 'user-1',
  pipelineId: 'p1',
  stageId: 's1',
  tags: [],
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
};

const pipelines: Pipeline[] = [
  {
    id: 'p1',
    name: 'Ventas',
    userId: 'u1',
    createdAt: '',
    stages: [
      { id: 's1', pipelineId: 'p1', userId: 'u1', name: 'Nuevo', position: 0, color: '#6b7280', isClosed: false, isWon: false, createdAt: '' },
      { id: 's2', pipelineId: 'p1', userId: 'u1', name: 'Contactado', position: 1, color: '#3b82f6', isClosed: false, isWon: false, createdAt: '' },
    ],
  },
  {
    id: 'p2',
    name: 'Soporte',
    userId: 'u1',
    createdAt: '',
    stages: [
      { id: 's3', pipelineId: 'p2', userId: 'u1', name: 'Abierto', position: 0, color: '#22c55e', isClosed: false, isWon: false, createdAt: '' },
      { id: 's4', pipelineId: 'p2', userId: 'u1', name: 'Cerrado', position: 1, color: '#ef4444', isClosed: true, isWon: false, createdAt: '' },
    ],
  },
];

const p1Stages = pipelines[0].stages!;
const p2Stages = pipelines[1].stages!;

// Mock sonner toast
const mockToastSuccess = jest.fn();
const mockToastWarning = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    warning: (...args: any[]) => mockToastWarning(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

// Mock child components to simplify testing
jest.mock('@/modules/instagram/components/InstagramSendDialog', () => ({
  InstagramSendDialog: () => <div data-testid="ig-send-dialog" />,
}));
jest.mock('@/modules/instagram/components/InstagramConversation', () => ({
  InstagramConversation: () => <div data-testid="ig-conversation" />,
}));
jest.mock('@/modules/activities/presentation/components/LeadActivitiesSection', () => ({
  LeadActivitiesSection: () => <div data-testid="activities-section" />,
}));
jest.mock('@/modules/ideas/presentation/components/RelatedIdeasSection', () => ({
  RelatedIdeasSection: () => <div data-testid="ideas-section" />,
}));
jest.mock('@/modules/shared/components/TagSelector', () => ({
  TagSelector: () => <div data-testid="tag-selector" />,
}));
jest.mock('@/modules/shared/components/NoteForm', () => ({
  NoteForm: () => <div data-testid="note-form" />,
}));
jest.mock('@/modules/shared/components/NoteTimeline', () => ({
  NoteTimeline: () => <div data-testid="note-timeline" />,
}));

describe('LeadWorkspace — Pipeline Selector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show pipeline selector when multiple pipelines exist', async () => {
    const repos = createMockRepositories();
    repos.pipeline.getAll = jest.fn().mockResolvedValue(pipelines);
    repos.pipeline.getStages = jest.fn().mockResolvedValue(p1Stages);

    renderWithProviders(<LeadWorkspace lead={baseLead} />, { repos });

    await waitFor(() => {
      expect(screen.getByText('Ventas')).toBeInTheDocument();
    });
  });

  it('should load stages for the selected pipeline on mount', async () => {
    const repos = createMockRepositories();
    repos.pipeline.getAll = jest.fn().mockResolvedValue(pipelines);
    repos.pipeline.getStages = jest.fn().mockResolvedValue(p1Stages);

    renderWithProviders(<LeadWorkspace lead={baseLead} />, { repos });

    await waitFor(() => {
      // Stage selector should show the stages for pipeline p1
      expect(repos.pipeline.getStages).toHaveBeenCalledWith('p1');
    });
  });

  it('should load stages when pipeline changes via selector', async () => {
    const repos = createMockRepositories();
    repos.pipeline.getAll = jest.fn().mockResolvedValue(pipelines);
    repos.pipeline.getStages = jest.fn()
      .mockResolvedValueOnce(p1Stages) // initial load for p1
      .mockResolvedValueOnce(p2Stages); // when switching to p2

    renderWithProviders(<LeadWorkspace lead={baseLead} />, { repos });

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Ventas')).toBeInTheDocument();
    });

    // Find and click the pipeline selector to open it
    const pipelineSelect = screen.getByLabelText(/pipeline/i);
    fireEvent.click(pipelineSelect);

    // Click the "Soporte" option
    const soporteOption = screen.getByText('Soporte');
    fireEvent.click(soporteOption);

    await waitFor(() => {
      expect(repos.pipeline.getStages).toHaveBeenCalledWith('p2');
    });
  });

  it('should show warning toast when current stage does not exist in new pipeline', async () => {
    const repos = createMockRepositories();
    repos.pipeline.getAll = jest.fn().mockResolvedValue(pipelines);
    repos.pipeline.getStages = jest.fn()
      .mockResolvedValueOnce(p1Stages) // initial
      .mockResolvedValueOnce(p2Stages); // after switch

    renderWithProviders(<LeadWorkspace lead={baseLead} />, { repos });

    await waitFor(() => {
      expect(screen.getByText('Ventas')).toBeInTheDocument();
    });

    // Switch pipeline
    const pipelineSelect = screen.getByLabelText(/pipeline/i);
    fireEvent.click(pipelineSelect);
    const soporteOption = screen.getByText('Soporte');
    fireEvent.click(soporteOption);

    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('no existe')
      );
    });
  });

  it('should not show selector when only one pipeline exists', async () => {
    const singlePipeline = [pipelines[0]];
    const repos = createMockRepositories();
    repos.pipeline.getAll = jest.fn().mockResolvedValue(singlePipeline);
    repos.pipeline.getStages = jest.fn().mockResolvedValue(p1Stages);

    renderWithProviders(<LeadWorkspace lead={baseLead} />, { repos });

    await waitFor(() => {
      // Pipeline name should be shown as text, not as a select
      expect(screen.getByText('Ventas')).toBeInTheDocument();
    });

    // Should show pipeline name as plain text (not in a select trigger)
    const pipelineText = screen.getByText('Ventas');
    expect(pipelineText.tagName).toBe('P');
  });
});
