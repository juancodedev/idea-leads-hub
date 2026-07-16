"use client";

import { useState } from "react";
import { Activity } from "../../../activities/domain/entities/Activity";
import { AddActivityForm } from "./AddActivityForm";
import { ActivityType } from "../../../activities/domain/enums/ActivityType";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Phone, 
  Mail, 
  Calendar, 
  CheckSquare, 
  FileText, 
  Search, 
  Zap, 
  MessageSquare,
  MessageCircle,
  Paperclip,
  ExternalLink
} from "lucide-react";
import { Badge } from "@/ui/components/badge";

interface ActivityItemProps {
  activity: Activity;
  onUpdate?: () => void;
}

const typeConfig = {
  [ActivityType.CALL]: { icon: Phone, color: "text-blue-500", bg: "bg-blue-500/10", label: "Llamada" },
  [ActivityType.EMAIL]: { icon: Mail, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Correo" },
  [ActivityType.MEETING]: { icon: Calendar, color: "text-purple-500", bg: "bg-purple-500/10", label: "Reunión" },
  [ActivityType.TASK]: { icon: CheckSquare, color: "text-orange-500", bg: "bg-orange-500/10", label: "Tarea" },
  [ActivityType.NOTE]: { icon: MessageSquare, color: "text-slate-500", bg: "bg-slate-500/10", label: "Nota" },
  [ActivityType.REMINDER]: { icon: Zap, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Recordatorio" },
  [ActivityType.FOLLOW_UP]: { icon: FileText, color: "text-indigo-500", bg: "bg-indigo-500/10", label: "Seguimiento" },
  [ActivityType.INVESTIGATION]: { icon: Search, color: "text-cyan-500", bg: "bg-cyan-500/10", label: "Investigación" },
  [ActivityType.ACTION]: { icon: Zap, color: "text-rose-500", bg: "bg-rose-500/10", label: "Acción" },
  [ActivityType.INSTAGRAM_MESSAGE]: { icon: MessageCircle, color: "text-pink-500", bg: "bg-pink-500/10", label: "Instagram DM" },
};

export function ActivityItem({ activity, onUpdate }: ActivityItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const config = typeConfig[activity.type] || typeConfig[ActivityType.NOTE];
  const Icon = config.icon;

  if (isEditing) {
    return (
      <div className="py-4">
        <AddActivityForm 
          ideaId={activity.ideaId || ""} 
          activity={activity} 
          onSuccess={() => {
            setIsEditing(false);
            onUpdate?.();
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div 
      className="flex gap-4 py-4 first:pt-0 last:pb-0 group cursor-default select-none"
      onDoubleClick={() => setIsEditing(true)}
    >
      <div className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.bg} ${config.color}`}>
        <Icon className="h-5 w-5" />
      </div>
      
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground/80">Tú</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: es })}
            </span>
            <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wider h-5 px-1.5 font-bold">
              {config.label}
            </Badge>
            {activity.updatedAt.getTime() !== activity.createdAt.getTime() && (
              <span className="text-[10px] text-muted-foreground italic">(editado)</span>
            )}
          </div>
        </div>

        <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {activity.description}
        </div>

        {activity.attachments && activity.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {activity.attachments.map((file, idx) => (
              <a
                key={idx}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1 text-xs transition-all hover:bg-muted hover:border-muted-foreground/30"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
