"use client";

import { Activity } from "@/modules/activities/domain/entities/Activity";
import { ActivityTypeIcon } from "@/modules/activities/presentation/components/ActivityTypeIcon";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Bell, Calendar } from "lucide-react";

interface UpcomingActivitiesProps {
  activities: Activity[];
}

export function UpcomingActivities({ activities }: UpcomingActivitiesProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">Próximas Actividades</CardTitle>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No hay actividades pendientes"
              description="No hay actividades pendientes para hoy."
            />
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
                  <ActivityTypeIcon type={activity.type} className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-medium leading-none">{activity.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Bell className="h-3 w-3" />
                      {activity.dueDate ? format(new Date(activity.dueDate), "dd MMM, HH:mm", { locale: es }) : "Sin fecha"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
