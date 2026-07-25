/**
 * Tests for StageList — draggable list of stages.
 *
 * Spec: 1.5 Usuario reordena etapas vía drag
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders, createMockRepositories } from '@/lib/test-utils';
import { StageList } from '../StageList';
import type { PipelineStage } from '@/core/domain/Pipeline';

const stages: PipelineStage[] = [
  { id: 's1', pipelineId: 'p1', userId: 'u1', name: 'Nuevo', position: 0, color: '#6b7280', isClosed: false, isWon: false, createdAt: '' },
  { id: 's2', pipelineId: 'p1', userId: 'u1', name: 'Contactado', position: 1, color: '#3b82f6', isClosed: false, isWon: false, createdAt: '' },
  { id: 's3', pipelineId: 'p1', userId: 'u1', name: 'Interesado', position: 2, color: '#f59e0b', isClosed: false, isWon: false, createdAt: '' },
];

// Capture DndContext handlers
const dndHandlers: Record<string, any> = {};

jest.mock('@dnd-kit/core', () => {
  const ReactFromMock = require('react');
  return {
    DndContext: (props: any) => {
      if (props.onDragEnd) dndHandlers.onDragEnd = props.onDragEnd;
      return ReactFromMock.createElement(ReactFromMock.Fragment, null, props.children);
    },
    DragOverlay: (props: any) =>
      ReactFromMock.createElement(ReactFromMock.Fragment, null, props.children),
    useDroppable: () => ({ setNodeRef: jest.fn(), isOver: false, active: null }),
    useSensor: (s: any, o?: any) => ({ sensor: s, options: o }),
    useSensors: (...s: any[]) => s,
    PointerSensor: class { static activators: any[] = []; },
    KeyboardSensor: class {},
    closestCorners: () => null,
    defaultDropAnimationSideEffects: () => ({}),
  };
});

jest.mock('@dnd-kit/sortable', () => {
  const ReactFromMock = require('react');
  return {
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: jest.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    }),
    SortableContext: ({ children }: any) =>
      ReactFromMock.createElement(ReactFromMock.Fragment, null, children),
    verticalListSortingStrategy: {},
    arrayMove: <T,>(arr: T[], from: number, to: number): T[] => {
      const result = [...arr];
      const [removed] = result.splice(from, 1);
      result.splice(to, 0, removed);
      return result;
    },
  };
});

jest.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

describe('StageList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(dndHandlers).forEach((k) => delete dndHandlers[k]);
  });

  it('should render all stages', () => {
    renderWithProviders(
      <StageList
        stages={stages}
        leadsByStage={{}}
        onReorder={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(screen.getByText('Nuevo')).toBeInTheDocument();
    expect(screen.getByText('Contactado')).toBeInTheDocument();
    expect(screen.getByText('Interesado')).toBeInTheDocument();
  });

  it('should show empty state when no stages', () => {
    renderWithProviders(
      <StageList
        stages={[]}
        leadsByStage={{}}
        onReorder={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(screen.getByText(/no hay etapas/i)).toBeInTheDocument();
  });

  it('should call onReorder when drag ends', () => {
    const onReorder = jest.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <StageList
        stages={stages}
        leadsByStage={{}}
        onReorder={onReorder}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    // Simulate drag end
    dndHandlers.onDragEnd({
      active: { id: 's1' },
      over: { id: 's3' },
    });

    expect(onReorder).toHaveBeenCalledWith([
      expect.objectContaining({ id: 's2', position: 0 }),
      expect.objectContaining({ id: 's3', position: 1 }),
      expect.objectContaining({ id: 's1', position: 2 }),
    ]);
  });

  it('should not call onReorder when dragged to same position', () => {
    const onReorder = jest.fn();
    renderWithProviders(
      <StageList
        stages={stages}
        leadsByStage={{}}
        onReorder={onReorder}
        onRename={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    dndHandlers.onDragEnd({
      active: { id: 's1' },
      over: { id: 's1' },
    });

    expect(onReorder).not.toHaveBeenCalled();
  });
});
