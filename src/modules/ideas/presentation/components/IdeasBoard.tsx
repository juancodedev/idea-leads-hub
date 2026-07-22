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
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
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

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;
    if (active.data.current?.type !== "Idea") return;

    // Detect target column status from droppable over
    let newStatus: IdeaStatus | null = null;

    if (over.data.current?.type === "Column") {
      newStatus = over.data.current.status as IdeaStatus;
    } else {
      // Over a card — find its status
      const overIdea = ideas.find((i) => i.id === overId);
      if (overIdea) newStatus = overIdea.status;
    }

    if (newStatus) {
      const activeIdea = ideas.find((i) => i.id === activeId);
      if (activeIdea && activeIdea.status !== newStatus) {
        // Optimistic status update during drag (visual feedback)
        updateIdea({ ...activeIdea, status: newStatus });
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIdea(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    let newStatus: IdeaStatus | null = null;

    if (over.data.current?.type === "Column") {
      newStatus = over.data.current.status as IdeaStatus;
    } else {
      const overIdea = ideas.find((i) => i.id === overId);
      if (overIdea) newStatus = overIdea.status;
    }

    if (activeIdea && newStatus) {
      if (activeIdea.status !== newStatus) {
        // Cross-column move — already optimistically updated in handleDragOver
        // Persist the move
        try {
          await module.moveIdeaStatus.execute(activeId, newStatus);
        } catch (error: any) {
          toast.error("Error al mover la idea");
          updateIdea(activeIdea); // Revert to original
        }
      } else {
        // Within-column reorder — use arrayMove
        const columnIdeas = ideas.filter((i) => i.status === newStatus);
        const oldIndex = columnIdeas.findIndex((i) => i.id === activeId);
        const newIndex = columnIdeas.findIndex((i) => i.id === overId);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(columnIdeas, oldIndex, newIndex);
          // Update the store with the reordered column items
          const updatedIdeas = ideas.map((i) => {
            const reorderedPos = reordered.findIndex((r) => r.id === i.id);
            if (reorderedPos !== -1) {
              return { ...i, status: newStatus! };
            }
            return i;
          });
          // Since we don't have a sort order field, we update the store
          // with the reordered array preserving the rest of the ideas
          const otherIdeas = ideas.filter(
            (i) => i.status !== newStatus || i.id === activeId
          );
          const finalIdeas = [
            ...otherIdeas.filter((i) => i.id !== activeId),
            ...reordered,
          ];
          setIdeas(finalIdeas);
        }
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
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
        {activeIdea ? <IdeaCard idea={activeIdea} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
