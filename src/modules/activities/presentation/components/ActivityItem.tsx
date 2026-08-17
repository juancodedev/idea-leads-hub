"use client";

import { Activity } from "../../domain/entities/Activity";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { ActivityTypeIcon } from "./ActivityTypeIcon";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Checkbox } from "@/ui/components/checkbox";
import { cn } from "@/lib/utils";
import { useActivityRepository } from "@/ui/providers/RepositoryProvider";
import { toast } from "sonner";
import { useState } from "react";

const STATUS_LABELS: Record<ActivityStatus, string> = {
  [ActivityStatus.PENDING]: "Pendiente",
  [ActivityStatus.IN_PROGRESS]: "En Progreso",
  [ActivityStatus.COMPLETED]: "Completada",
};

interface ActivityItemProps {
  activity: Activity;
  onUpdate?: () => void;
  /** Free-transition status control (design 6.1). When provided, both the
   *  selector and the complete checkbox delegate here — e.g. the /activities
   *  page routes every transition through the changeActivityStatus server
   *  action (audit + revalidate). Omit it to keep the timeline checkbox path. */
  onStatusChange?: (id: string, status: ActivityStatus) => void;
}

export function ActivityItem({ activity, onUpdate, onStatusChange }: ActivityItemProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const repository = useActivityRepository();

  const handleToggleComplete = async () => {
    if (activity.completed) return; // For now, only allow marking as complete

    // Server-action path: delegate to the parent so the transition is audited
    // and the list can apply its optimistic update + revert (BR-4).
    if (onStatusChange) {
      onStatusChange(activity.id, ActivityStatus.COMPLETED);
      return;
    }

    setIsCompleting(true);
    try {
      // Keep the existence check that CompleteActivity use case had
      const existing = await repository.getById(activity.id);
      if (!existing) throw new Error("Actividad no encontrada");
      // Status surface (BR-4): complete moves through moveStatus so
      // `completed` stays dual-written from `status = 'COMPLETED'`.
      await repository.moveStatus(activity.id, ActivityStatus.COMPLETED);
      toast.success("Actividad completada");
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error completing activity:", error);
      toast.error("Error al completar la actividad");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className={cn(
      "relative pl-8 pb-8 last:pb-0 border-l border-muted-foreground/20 ml-3",
      activity.completed && "opacity-60"
    )}>
      {/* Icon Node */}
      <div className={cn(
        "absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm",
        activity.completed ? "border-green-500 text-green-500" : "border-primary text-primary"
      )}>
        <ActivityTypeIcon type={activity.type} className="h-3 w-3" />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className={cn(
            "text-sm font-semibold",
            activity.completed && "line-through text-muted-foreground"
          )}>
            {activity.title}
          </h4>
          <div className="flex items-center gap-2">
            {onStatusChange && (
              <select
                value={activity.status}
                onChange={(e) => onStatusChange(activity.id, e.target.value as ActivityStatus)}
                aria-label="Estado"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {Object.values(ActivityStatus).map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
            )}
            {!activity.completed && (
              <Checkbox 
                checked={activity.completed} 
                onCheckedChange={handleToggleComplete}
                disabled={isCompleting}
              />
            )}
          </div>
        </div>
        
        {activity.description && (
          <p className="text-sm text-muted-foreground">
            {activity.description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{format(activity.createdAt, "PPP p", { locale: es })}</span>
          {activity.dueDate && (
            <span className={cn(
              "font-medium",
              new Date(activity.dueDate) < new Date() && !activity.completed && "text-destructive"
            )}>
              Vence: {format(activity.dueDate, "dd/MM/yyyy", { locale: es })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
