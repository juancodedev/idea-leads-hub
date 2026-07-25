'use client';

import * as React from 'react';
import type { PipelineStage } from '@/core/domain/Pipeline';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { StageItem } from './StageItem';

interface StageListProps {
  stages: PipelineStage[];
  leadsByStage: Record<string, number>;
  onReorder: (stages: { id: string; position: number }[]) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => void;
}

export function StageList({
  stages,
  leadsByStage,
  onReorder,
  onRename,
  onDelete,
}: StageListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder locally
    const reordered = [...stages];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Map to position updates
    const updates = reordered.map((s, i) => ({ id: s.id, position: i }));
    await onReorder(updates);
  };

  if (stages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay etapas en este pipeline.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={stages.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {stages.map((stage) => (
            <StageItem
              key={stage.id}
              stage={stage}
              onRename={onRename}
              onDelete={onDelete}
              hasLeads={(leadsByStage[stage.id] ?? 0) > 0}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
