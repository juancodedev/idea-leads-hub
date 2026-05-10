'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead } from '@/core/domain/Lead';
import { Card, CardContent } from '@/ui/components/card';
import { cn } from '@/lib/utils';

interface PipelineCardProps {
  lead: Lead;
  isOverlay?: boolean;
}

export function PipelineCard({ lead, isOverlay }: PipelineCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: 'Lead',
      lead,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-24 w-full rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isOverlay && "rotate-3 scale-105 shadow-xl"
      )}
    >
      <Card className="hover:border-slate-300 dark:hover:border-slate-600">
        <CardContent className="p-4">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">{lead.name}</h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{lead.company}</p>
          
          {lead.tags && lead.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {lead.tags.slice(0, 3).map(tag => (
                <div 
                  key={tag.id} 
                  className="h-1.5 w-6 rounded-full" 
                  style={{ backgroundColor: tag.color }}
                  title={tag.name}
                />
              ))}
              {lead.tags.length > 3 && <span className="text-[8px] text-muted-foreground">+{lead.tags.length - 3}</span>}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
             <span>{new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' }).format(new Date(lead.createdAt))}</span>
             {lead.source && <span className="rounded bg-slate-100 px-1 dark:bg-slate-800">{lead.source}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
