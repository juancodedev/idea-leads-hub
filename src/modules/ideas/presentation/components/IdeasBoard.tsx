"use client";

import React, { useState } from "react";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { Idea } from "../../domain/entities/Idea";
import { IdeaStatus } from "../../domain/enums/IdeaEnums";
import { IdeaColumn } from "./IdeaColumn";
import { IdeaCard } from "./IdeaCard";
import { useIdeasStore } from "../../store/useIdeasStore";
import { ideaModule } from "../../index";
import { toast } from "sonner";

interface IdeasBoardProps {
  initialIdeas: Idea[];
}

const COLUMNS = [
  { status: IdeaStatus.BACKLOG, label: "Backlog" },
  { status: IdeaStatus.RESEARCHING, label: "Investigando" },
  { status: IdeaStatus.PLANNED, label: "Planificadas" },
  { status: IdeaStatus.IN_PROGRESS, label: "En Progreso" },
  { status: IdeaStatus.COMPLETED, label: "Completadas" },
];

export function IdeasBoard({ initialIdeas }: IdeasBoardProps) {
  const { ideas, setIdeas, updateIdea } = useIdeasStore();
  const [activeIdea, setActiveIdea] = useState<Idea | null>(null);
  const module = ideaModule();
  const router = useRouter();

  React.useEffect(() => {
    setIdeas(initialIdeas);
  }, [initialIdeas, setIdeas]);

  const handleIdeaClick = (id: string) => {
    router.push(`/ideas/${id}/edit`);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const idea = ideas.find((i) => i.id === active.id);
    if (idea) setActiveIdea(idea);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIdea(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    let newStatus: IdeaStatus | null = null;

    if (over.data.current?.type === "Column") {
      newStatus = over.data.current.status;
    } else {
      const overIdea = ideas.find((i) => i.id === overId);
      if (overIdea) newStatus = overIdea.status;
    }

    if (activeIdea && newStatus && activeIdea.status !== newStatus) {
      // Optimistic update
      const updatedIdea = { ...activeIdea, status: newStatus };
      updateIdea(updatedIdea);

      try {
        await module.moveIdeaStatus.execute(activeId, newStatus);
      } catch (error: any) {
        toast.error("Error al mover la idea");
        updateIdea(activeIdea); // Revert
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-6 overflow-x-auto pb-6">
        {COLUMNS.map((col) => (
          <IdeaColumn 
            key={col.status} 
            status={col.status} 
            label={col.label} 
            ideas={ideas.filter(i => i.status === col.status)} 
            onIdeaClick={handleIdeaClick}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: { active: { opacity: "0.5" } },
        }),
      }}>
        {activeIdea ? <IdeaCard idea={activeIdea} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
