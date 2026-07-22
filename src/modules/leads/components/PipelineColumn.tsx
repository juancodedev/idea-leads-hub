'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { PipelineStage } from '@/core/domain/Pipeline';
import { PipelineCard } from './PipelineCard';
import { EmptyState } from '@/ui/components/EmptyState';
import { Lead } from '@/core/domain/Lead';

interface PipelineColumnProps {
  stage: PipelineStage;
  leads: Lead[];
  onCardClick?: (id: string) => void;
}

export function PipelineColumn({ stage, leads, onCardClick }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      type: 'Column',
      stageId: stage.id,
    },
  });

  return (
    <div className={cn("flex w-80 flex-shrink-0 flex-col rounded-lg bg-muted/50 p-4 border transition-colors", isOver && "bg-muted")}>
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
        {leads.length === 0 ? (
          <EmptyState
            title="Sin leads"
            description="Arrastra leads aquí"
          />
        ) : (
          <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {leads.map((lead) => (
              <PipelineCard key={lead.id} lead={lead} onClick={onCardClick} />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}
