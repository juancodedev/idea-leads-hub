"use client";

import { Activity } from "../../domain/entities/Activity";
import { ActivityTypeIcon } from "./ActivityTypeIcon";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Checkbox } from "@/ui/components/checkbox";
import { cn } from "@/lib/utils";
import { activitiesModule } from "../../index";
import { toast } from "sonner";
import { useState } from "react";

interface ActivityItemProps {
  activity: Activity;
  onUpdate?: () => void;
}

export function ActivityItem({ activity, onUpdate }: ActivityItemProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const module = activitiesModule();

  const handleToggleComplete = async () => {
    if (activity.completed) return; // For now, only allow marking as complete
    
    setIsCompleting(true);
    try {
      await module.completeActivity.execute(activity.id);
      toast.success("Actividad completada");
      if (onUpdate) onUpdate();
    } catch (error) {
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
          {!activity.completed && (
            <Checkbox 
              checked={activity.completed} 
              onCheckedChange={handleToggleComplete}
              disabled={isCompleting}
            />
          )}
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
