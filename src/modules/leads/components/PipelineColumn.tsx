'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PipelineStage } from '@/core/domain/Pipeline';
import { PipelineCard } from './PipelineCard';
import { Lead } from '@/core/domain/Lead';

interface PipelineColumnProps {
  stage: PipelineStage;
  leads: Lead[];
}

export function PipelineColumn({ stage, leads }: PipelineColumnProps) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
    data: {
      type: 'Column',
      stageId: stage.id,
    },
  });

  return (
    <div className="flex w-80 flex-shrink-0 flex-col rounded-lg bg-muted/50 p-4 border">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[var(--stage-color)]" style={{ '--stage-color': stage.color } as React.CSSProperties} />
          <h3 className="font-semibold text-sm text-muted-foreground">{stage.name}</h3>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {leads.length}
        </span>
      </div>

      <div ref={setNodeRef} className="flex flex-1 flex-col gap-3">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <PipelineCard key={lead.id} lead={lead} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
