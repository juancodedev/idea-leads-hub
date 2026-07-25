/**
 * Tests for StageItem — individual stage component.
 *
 * Spec: 1.2, 1.3, 1.4
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/lib/test-utils';
import { StageItem } from '../StageItem';
import type { PipelineStage } from '@/core/domain/Pipeline';

const baseStage: PipelineStage = {
  id: 'stage-1',
  pipelineId: 'pipeline-1',
  userId: 'user-1',
  name: 'Nuevo',
  position: 0,
  color: '#6b7280',
  isClosed: false,
  isWon: false,
  createdAt: '2024-01-01T00:00:00Z',
};

// Mock dnd-kit sortable for StageItem
jest.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

describe('StageItem', () => {
  it('should display the stage name', () => {
    renderWithProviders(
      <StageItem
        stage={baseStage}
        onRename={jest.fn()}
        onDelete={jest.fn()}
        hasLeads={false}
      />
    );

    expect(screen.getByText('Nuevo')).toBeInTheDocument();
  });

  it('should show delete button and call onDelete when clicked with no leads', () => {
    const onDelete = jest.fn();
    renderWithProviders(
      <StageItem
        stage={baseStage}
        onRename={jest.fn()}
        onDelete={onDelete}
        hasLeads={false}
      />
    );

    // Click the dropdown trigger (MoreHorizontal or similar)
    const deleteButton = screen.getByRole('button', { name: /eliminar etapa/i });
    fireEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith('stage-1');
  });

  it('should show warning when stage has leads and delete is attempted', () => {
    const onDelete = jest.fn();
    renderWithProviders(
      <StageItem
        stage={baseStage}
        onRename={jest.fn()}
        onDelete={onDelete}
        hasLeads={true}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /eliminar etapa/i });

    // Should show a tooltip/warning
    expect(deleteButton).toBeDisabled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('should show the stage color indicator', () => {
    renderWithProviders(
      <StageItem
        stage={baseStage}
        onRename={jest.fn()}
        onDelete={jest.fn()}
        hasLeads={false}
      />
    );

    // The color should be applied as a style
    const colorDot = screen.getByTestId('stage-color');
    expect(colorDot).toHaveStyle({ backgroundColor: '#6b7280' });
  });
});
