'use client';

import React, { useCallback } from 'react';
import { ActivityItem } from '@/modules/activities/components/ActivityItem';
import type { Activity } from '@/modules/activities/domain/entities/Activity';
import { toggleActivityCompletion } from './actions';

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
      <div className="p-8 text-center text-muted-foreground">
        No tienes actividades pendientes. ¡Buen trabajo!
      </div>
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
