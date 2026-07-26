'use client';

import React, { useCallback, useState } from 'react';
import { ActivityItem } from '@/modules/activities/components/ActivityItem';
import type { Activity } from '@/modules/activities/domain/entities/Activity';
import { ActivityType } from '@/modules/activities/domain/enums/ActivityType';
import { toggleActivityCompletion } from './actions';
import { EmptyState } from '@/ui/components/EmptyState';
import { Input } from '@/ui/components/input';
import { CheckSquare, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface ActivitiesListProps {
  activities: Activity[];
  searchParams: Record<string, string>;
}

const TYPE_LABELS: Record<string, string> = {
  CALL: 'Llamada',
  MEETING: 'Reunión',
  FOLLOW_UP: 'Seguimiento',
  EMAIL: 'Email',
  TASK: 'Tarea',
  NOTE: 'Nota',
  REMINDER: 'Recordatorio',
  INVESTIGATION: 'Investigación',
  ACTION: 'Acción',
  INSTAGRAM_MESSAGE: 'Instagram',
};

export function ActivitiesList({ activities, searchParams }: ActivitiesListProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [searchText, setSearchText] = useState(searchParams.q || '');

  const currentType = searchParams.type || '';
  const showCompleted = searchParams.completed === 'true';

  const updateParam = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.replace(`/activities?${next.toString()}`, { scroll: false });
  }, [router, sp]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchText(val);
    updateParam('q', val || null);
  }, [updateParam]);

  const clearSearch = useCallback(() => {
    setSearchText('');
    updateParam('q', null);
  }, [updateParam]);

  const handleToggle = useCallback(async (id: string, completed: boolean) => {
    try {
      await toggleActivityCompletion(id, completed);
    } catch (error) {
      console.error('Failed to toggle activity:', error);
    }
  }, []);

  return (
    <div className="flex flex-col">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-4 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar actividades..."
            value={searchText}
            onChange={handleSearch}
            className="pl-9 pr-8"
          />
          {searchText && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        <select
          value={currentType}
          onChange={(e) => updateParam('type', e.target.value || null)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          {Object.values(ActivityType).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => updateParam('completed', e.target.checked ? 'true' : null)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Completadas
        </label>
      </div>

      {/* List */}
      {activities.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No hay actividades pendientes"
          description={
            searchParams.q || searchParams.type
              ? "No se encontraron actividades que coincidan con los filtros."
              : "¡Buen trabajo! Las actividades que crees aparecerán aquí."
          }
        />
      ) : (
        activities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            onToggle={handleToggle}
          />
        ))
      )}
    </div>
  );
}
