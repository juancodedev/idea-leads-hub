'use client';

import * as React from 'react';
import type { PipelineStage } from '@/core/domain/Pipeline';
import { Button } from '@/ui/components/button';
import { Trash2, GripVertical } from 'lucide-react';
import { InlineRename } from './InlineRename';

interface StageItemProps {
  stage: PipelineStage;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => void;
  hasLeads: boolean;
}

export function StageItem({ stage, onRename, onDelete, hasLeads }: StageItemProps) {
  const handleRename = async (name: string) => {
    await onRename(stage.id, name);
  };

  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-colors hover:bg-accent/50">
      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />

      <div
        data-testid="stage-color"
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: stage.color }}
      />

      <div className="flex-1 min-w-0">
        <InlineRename value={stage.name} onSave={handleRename} />
      </div>

      <span className="text-xs text-muted-foreground">
        Pos. {stage.position + 1}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
        onClick={() => !hasLeads && onDelete(stage.id)}
        disabled={hasLeads}
        title={hasLeads ? 'Esta etapa tiene leads activos. Reasignalos antes de eliminar.' : 'Eliminar etapa'}
        aria-label="Eliminar etapa"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
