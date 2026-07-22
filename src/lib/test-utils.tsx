import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { RepositoryProvider, Repositories } from '@/ui/providers/RepositoryProvider';

function createMockRepositories(): Repositories {
  return {
    lead: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateStatus: jest.fn(),
    },
    note: {
      getForEntity: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tag: {
      getAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      delete: jest.fn(),
      assignToEntity: jest.fn(),
      removeFromEntity: jest.fn(),
      getForEntity: jest.fn().mockResolvedValue([]),
    },
    pipeline: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getStages: jest.fn().mockResolvedValue([]),
      createStage: jest.fn(),
      updateStage: jest.fn(),
      deleteStage: jest.fn(),
      reorderStages: jest.fn(),
    },
    idea: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      archive: jest.fn(),
      restore: jest.fn(),
      moveStatus: jest.fn(),
    },
    activity: {
      getById: jest.fn().mockResolvedValue(null),
      getForLead: jest.fn().mockResolvedValue([]),
      getForIdea: jest.fn().mockResolvedValue([]),
      getPending: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      complete: jest.fn(),
    },
  };
}

function renderWithProviders(
  ui: React.ReactElement,
  {
    repos = createMockRepositories(),
    ...options
  }: { repos?: Repositories } & Omit<RenderOptions, 'wrapper'> = {}
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <RepositoryProvider {...repos}>{children}</RepositoryProvider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}

export { renderWithProviders, createMockRepositories };
