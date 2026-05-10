"use client";

import { Idea } from "../../domain/entities/Idea";
import { IdeaStatus } from "../../domain/enums/IdeaEnums";
import { IdeaCard } from "./IdeaCard";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";

interface IdeaColumnProps {
  status: IdeaStatus;
  label: string;
  ideas: Idea[];
  onIdeaClick?: (id: string) => void;
}

export function IdeaColumn({ status, label, ideas, onIdeaClick }: IdeaColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: "Column",
      status,
    },
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-80 min-w-[20rem] rounded-xl bg-muted/50 p-4 transition-colors",
        isOver && "bg-muted"
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          {label}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {ideas.length}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <SortableContext items={ideas.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} onClick={onIdeaClick} />
          ))}
        </SortableContext>
        
        {ideas.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground/50">
            <p className="text-xs">Sin ideas</p>
          </div>
        )}
      </div>
    </div>
  );
}
