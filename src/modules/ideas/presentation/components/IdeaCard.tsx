"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/ui/components/card";
import { Idea } from "../../domain/entities/Idea";
import { IdeaStatusBadge } from "./IdeaStatusBadge";
import { IdeaPriorityBadge } from "./IdeaPriorityBadge";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TagBadge } from "./TagBadge";
import { cn } from "@/lib/utils";

interface IdeaCardProps {
  idea: Idea;
  onClick?: (id: string) => void;
  isOverlay?: boolean;
}

export function IdeaCard({ idea, onClick, isOverlay }: IdeaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: idea.id,
    data: {
      type: "Idea",
      idea,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        data-state="dragging"
        className="h-28 w-full rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-state={isOverlay ? "overlay" : "idle"}
      data-testid="idea-card-wrapper"
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isOverlay && "rotate-3 scale-105 shadow-xl"
      )}
    >
      <Card
        className="hover:shadow-md transition-shadow"
        onClick={() => onClick?.(idea.id)}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-lg font-bold leading-tight">
              {idea.title}
            </CardTitle>
            <IdeaPriorityBadge priority={idea.priority} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {idea.description || "Sin descripción"}
          </p>

          {idea.tags && idea.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {idea.tags.slice(0, 3).map((tag) => (
                <TagBadge key={tag.id} tag={tag} className="px-1.5 py-0 text-[10px]" />
              ))}
              {idea.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{idea.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-0 flex justify-between items-center text-xs text-muted-foreground">
          <IdeaStatusBadge status={idea.status} />
          <div className="flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" />
            <span>{format(idea.createdAt, "dd MMM", { locale: es })}</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
