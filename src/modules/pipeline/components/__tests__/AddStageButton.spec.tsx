/**
 * Tests for AddStageButton — inline add new stage.
 *
 * Spec: 1.1 Usuario crea nueva etapa "Revisado"
 *       1.6 Usuario crea etapa con nombre duplicado
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/lib/test-utils';
import { AddStageButton } from '../AddStageButton';

describe('AddStageButton', () => {
  it('should show a button to add a new stage initially', () => {
    renderWithProviders(
      <AddStageButton onAdd={jest.fn()} />
    );

    expect(screen.getByRole('button', { name: /añadir etapa|nueva etapa/i })).toBeInTheDocument();
  });

  it('should show input when button is clicked', () => {
    renderWithProviders(
      <AddStageButton onAdd={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: /añadir etapa|nueva etapa/i }));

    expect(screen.getByPlaceholderText(/nombre de la etapa/i)).toBeInTheDocument();
  });

  it('should call onAdd with the entered name on Enter', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <AddStageButton onAdd={onAdd} />
    );

    fireEvent.click(screen.getByRole('button', { name: /añadir etapa|nueva etapa/i }));
    const input = screen.getByPlaceholderText(/nombre de la etapa/i);
    fireEvent.change(input, { target: { value: 'Revisado' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('Revisado');
    });
  });

  it('should not call onAdd when name is empty', () => {
    const onAdd = jest.fn();
    renderWithProviders(
      <AddStageButton onAdd={onAdd} />
    );

    fireEvent.click(screen.getByRole('button', { name: /añadir etapa|nueva etapa/i }));
    const input = screen.getByPlaceholderText(/nombre de la etapa/i);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('should collapse on Escape', () => {
    renderWithProviders(
      <AddStageButton onAdd={jest.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: /añadir etapa|nueva etapa/i }));
    const input = screen.getByPlaceholderText(/nombre de la etapa/i);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByPlaceholderText(/nombre de la etapa/i)).not.toBeInTheDocument();
  });

  it('should show button again after successful add', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <AddStageButton onAdd={onAdd} />
    );

    fireEvent.click(screen.getByRole('button', { name: /añadir etapa|nueva etapa/i }));
    const input = screen.getByPlaceholderText(/nombre de la etapa/i);
    fireEvent.change(input, { target: { value: 'Revisado' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /añadir etapa|nueva etapa/i })).toBeInTheDocument();
    });
  });
});
