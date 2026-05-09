"use client";

import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Circle, Clock, Mail, Phone, Users, MessageSquare } from "lucide-react";
import { Activity, ActivityType } from "@/core/domain/Activity";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/ui/components/checkbox";

const iconMap: Record<ActivityType, any> = {
  Email: Mail,
  Llamada: Phone,
  Reunión: Users,
  Nota: MessageSquare,
  Tarea: CheckCircle2,
};

interface ActivityItemProps {
  activity: Activity;
  onToggle: (id: string, completed: boolean) => void;
}

export function ActivityItem({ activity, onToggle }: ActivityItemProps) {
  const Icon = iconMap[activity.type] || Circle;
  
  return (
    <div className={cn(
      "flex items-start p-4 border-b last:border-0 hover:bg-accent/5 transition-colors",
      activity.completed && "opacity-60"
    )}>
      <div className="pt-1 mr-4">
        <Checkbox 
          checked={activity.completed} 
          onCheckedChange={(checked) => onToggle(activity.id, !!checked)}
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className={cn(
              "font-medium truncate",
              activity.completed && "line-through"
            )}>
              {activity.description}
            </span>
          </div>
          {activity.dueDate && (
            <div className="flex items-center text-xs text-muted-foreground whitespace-nowrap ml-2">
              <Clock className="h-3 w-3 mr-1" />
              {format(activity.dueDate, "d MMM", { locale: es })}
            </div>
          )}
        </div>
        
        {/* Lead name or other info could go here */}
      </div>
    </div>
  );
}
