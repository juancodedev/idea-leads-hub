'use client';

import React, { createContext, useContext, useRef } from 'react';
import { createClient } from '@/infrastructure/database/client';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { SupabaseNoteRepository } from '@/infrastructure/repositories/SupabaseNoteRepository';
import { SupabaseTagRepository } from '@/infrastructure/repositories/SupabaseTagRepository';
import { SupabasePipelineRepository } from '@/infrastructure/repositories/SupabasePipelineRepository';
import { SupabaseActivityRepository } from '@/modules/activities/infrastructure/repositories/SupabaseActivityRepository';
import { SupabaseIdeaRepository } from '@/modules/ideas/infrastructure/repositories/SupabaseIdeaRepository';
import type { LeadRepository, NoteRepository, TagRepository, PipelineRepository, ActivityRepository, IdeaRepository } from '@/core/ports';

export interface Repositories {
  lead: LeadRepository;
  note: NoteRepository;
  tag: TagRepository;
  pipeline: PipelineRepository;
  idea: IdeaRepository;
  activity: ActivityRepository;
}

const RepositoryContext = createContext<Repositories | null>(null);

export function RepositoryProvider({
  children,
  ...overrides
}: { children: React.ReactNode } & Partial<Repositories>) {
  const reposRef = useRef<Repositories | null>(null);

  if (!reposRef.current) {
    reposRef.current = initRepositories(overrides);
  }

  return (
    <RepositoryContext.Provider value={reposRef.current}>
      {children}
    </RepositoryContext.Provider>
  );
}

function initRepositories(overrides: Partial<Repositories>): Repositories {
  const allProvided = overrides.lead && overrides.note && overrides.tag
    && overrides.pipeline && overrides.idea && overrides.activity;

  if (allProvided) {
    return overrides as Repositories;
  }

  const supabase = createClient();
  return {
    lead: overrides.lead ?? new SupabaseLeadRepository(supabase),
    note: overrides.note ?? new SupabaseNoteRepository(supabase),
    tag: overrides.tag ?? new SupabaseTagRepository(supabase),
    pipeline: overrides.pipeline ?? new SupabasePipelineRepository(supabase),
    idea: overrides.idea ?? new SupabaseIdeaRepository(supabase),
    activity: overrides.activity ?? new SupabaseActivityRepository(supabase),
  };
}

function createRepoHook<K extends keyof Repositories>(key: K) {
  return (): Repositories[K] => {
    const ctx = useContext(RepositoryContext);
    if (!ctx) {
      const hookName = `use${key.charAt(0).toUpperCase() + key.slice(1)}Repository`;
      throw new Error(`${hookName} must be used within RepositoryProvider`);
    }
    return ctx[key];
  };
}

export const useLeadRepository = createRepoHook('lead');
export const useNoteRepository = createRepoHook('note');
export const useTagRepository = createRepoHook('tag');
export const usePipelineRepository = createRepoHook('pipeline');
export const useIdeaRepository = createRepoHook('idea');
export const useActivityRepository = createRepoHook('activity');
