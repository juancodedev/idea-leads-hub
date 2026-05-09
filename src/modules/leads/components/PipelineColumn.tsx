'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PipelineStage } from '@/core/domain/Pipeline';
import { PipelineCard } from './PipelineCard';

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
    <div className="flex w-80 flex-shrink-0 flex-col rounded-lg bg-slate-100/50 p-4 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
          <h3 className="font-semibold text-slate-700 dark:text-slate-300">{stage.name}</h3>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
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
