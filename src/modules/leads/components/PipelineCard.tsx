'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead } from '@/core/domain/Lead';
import { Card, CardContent } from '@/ui/components/card';
import { cn } from '@/lib/utils';

interface PipelineCardProps {
  lead: Lead;
  isOverlay?: boolean;
  onClick?: (id: string) => void;
}

export function PipelineCard({ lead, isOverlay, onClick }: PipelineCardProps) {
  const displayDate = lead.lastActivityAt ?? lead.createdAt;
  const formattedDate = new Intl.DateTimeFormat('es-ES', { month: 'short', day: 'numeric' }).format(new Date(displayDate));

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
        className="h-24 w-full rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30"
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
      onClick={() => onClick?.(lead.id)}
    >
      <Card className="hover:border-border">
        <CardContent className="p-4">
          <h4 className="font-semibold text-card-foreground">{lead.name}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{lead.company}</p>
          
          {lead.tags && lead.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {lead.tags.slice(0, 3).map(tag => (
                <div
                  key={tag.id}
                  className="h-1.5 w-6 rounded-full bg-[var(--tag-color)]"
                  style={{ '--tag-color': tag.color } as React.CSSProperties}
                  title={tag.name}
                />
              ))}
              {lead.tags.length > 3 && <span className="text-[8px] text-muted-foreground">+{lead.tags.length - 3}</span>}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
             <span title={`Last activity: ${formattedDate}`} aria-label={`Last activity: ${formattedDate}`}>{formattedDate}</span>
             {lead.source && <span className="rounded bg-muted px-1">{lead.source}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
