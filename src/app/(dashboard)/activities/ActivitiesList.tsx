'use client';

import React, { useCallback } from 'react';
import { ActivityItem } from '@/modules/activities/components/ActivityItem';
import type { Activity } from '@/modules/activities/domain/entities/Activity';
import { toggleActivityCompletion } from './actions';
import { EmptyState } from '@/ui/components/EmptyState';
import { CheckSquare } from 'lucide-react';

interface ActivitiesListProps {
  activities: Activity[];
}

export function ActivitiesList({ activities }: ActivitiesListProps) {
  const handleToggle = useCallback(async (id: string, completed: boolean) => {
    try {
      await toggleActivityCompletion(id, completed);
    } catch (error) {
      console.error('Failed to toggle activity:', error);
    }
  }, []);

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No hay actividades pendientes"
        description="¡Buen trabajo! Las actividades que crees aparecerán aquí."
      />
    );
  }

  return (
    <div className="flex flex-col">
      {activities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
