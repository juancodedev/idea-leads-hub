"use client";

import { Activity } from "../../domain/entities/Activity";
import { ActivityItem } from "./ActivityItem";
import { History } from "lucide-react";

interface ActivityListProps {
  activities: Activity[];
  onUpdate?: () => void;
  title?: string;
}

export function ActivityList({ activities, onUpdate, title = "Línea de Tiempo" }: ActivityListProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
        <History className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm font-medium">No hay actividades registradas.</p>
        <p className="text-xs">Empieza por añadir una nota o una llamada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        {activities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}
