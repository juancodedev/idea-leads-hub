/**
 * Tests for InlineRename — click-to-rename for pipeline stages.
 *
 * Spec: 1.2 Usuario renombra "Nuevo" → "Lead Inicial"
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, createMockRepositories } from '@/lib/test-utils';
import { InlineRename } from '../InlineRename';

describe('InlineRename', () => {
  it('should display the current value as text', () => {
    renderWithProviders(
      <InlineRename value="Nuevo" onSave={jest.fn()} />
    );

    expect(screen.getByText('Nuevo')).toBeInTheDocument();
  });

  it('should show input when text is clicked', () => {
    renderWithProviders(
      <InlineRename value="Nuevo" onSave={jest.fn()} />
    );

    fireEvent.click(screen.getByText('Nuevo'));

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Nuevo');
  });

  it('should call onSave with new value on Enter', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <InlineRename value="Nuevo" onSave={onSave} />
    );

    fireEvent.click(screen.getByText('Nuevo'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Lead Inicial' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Lead Inicial');
    });
  });

  it('should revert to original value on Escape', () => {
    renderWithProviders(
      <InlineRename value="Nuevo" onSave={jest.fn()} />
    );

    fireEvent.click(screen.getByText('Nuevo'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Lead Inicial' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    // Should show original value again
    expect(screen.getByText('Nuevo')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('should revert to original value on blur without saving', () => {
    renderWithProviders(
      <InlineRename value="Nuevo" onSave={jest.fn()} />
    );

    fireEvent.click(screen.getByText('Nuevo'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Lead Inicial' } });
    fireEvent.blur(input);

    // Should show original value again
    expect(screen.getByText('Nuevo')).toBeInTheDocument();
  });

  it('should show loading state while saving', async () => {
    const onSave = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    renderWithProviders(
      <InlineRename value="Nuevo" onSave={onSave} />
    );

    fireEvent.click(screen.getByText('Nuevo'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Lead Inicial' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Input should be disabled while saving
    await waitFor(() => {
      expect(input).toBeDisabled();
    });
  });
});
