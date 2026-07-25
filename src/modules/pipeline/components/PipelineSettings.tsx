'use client';

import * as React from 'react';
import type { Pipeline, PipelineStage } from '@/core/domain/Pipeline';
import { usePipelineRepository, useLeadRepository } from '@/ui/providers/RepositoryProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';
import { Button } from '@/ui/components/button';
import { Skeleton } from '@/ui/components/skeleton';
import { StageList } from './StageList';
import { AddStageButton } from './AddStageButton';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/components/dialog';

export function PipelineSettings() {
  const pipelineRepo = usePipelineRepository();
  const leadRepo = useLeadRepository();

  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string | null>(null);
  const [stages, setStages] = React.useState<PipelineStage[]>([]);
  const [leadsByStage, setLeadsByStage] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [deleteConfirmStageId, setDeleteConfirmStageId] = React.useState<string | null>(null);

  // Load pipelines on mount
  React.useEffect(() => {
    async function load() {
      try {
        const data = await pipelineRepo.getAll();
        setPipelines(data);
        if (data.length > 0) {
          setSelectedPipelineId(data[0].id);
        }
      } catch (err) {
        toast.error('Error al cargar pipelines');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [pipelineRepo]);

  // Load stages when pipeline changes
  React.useEffect(() => {
    if (!selectedPipelineId) return;

    async function loadStages() {
      try {
        const data = await pipelineRepo.getStages(selectedPipelineId);
        setStages(data);
      } catch (err) {
        toast.error('Error al cargar etapas');
        console.error(err);
      }
    }

    async function loadLeads() {
      try {
        const allLeads = await leadRepo.getAll();
        const byStage: Record<string, number> = {};
        for (const lead of allLeads) {
          if (lead.stageId) {
            byStage[lead.stageId] = (byStage[lead.stageId] ?? 0) + 1;
          }
        }
        setLeadsByStage(byStage);
      } catch (err) {
        console.error('Error loading leads for stage validation:', err);
      }
    }

    loadStages();
    loadLeads();
  }, [selectedPipelineId, pipelineRepo, leadRepo]);

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  const handleAddStage = async (name: string) => {
    if (!selectedPipelineId) return;
    // Check for duplicate name (case-insensitive)
    const exists = stages.some(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      toast.error('Ya existe una etapa con ese nombre en este pipeline');
      throw new Error('Duplicate stage name');
    }

    const newStage = await pipelineRepo.createStage({
      pipelineId: selectedPipelineId,
      name,
      position: stages.length,
    });
    setStages((prev) => [...prev, newStage]);
    toast.success(`Etapa "${name}" creada`);
  };

  const handleRenameStage = async (id: string, name: string) => {
    // Check for duplicate name (case-insensitive, exclude self)
    const exists = stages.some(
      (s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      toast.error('Ya existe una etapa con ese nombre en este pipeline');
      throw new Error('Duplicate stage name');
    }

    const updated = await pipelineRepo.updateStage(id, { name });
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, name: updated.name } : s)));
    toast.success(`Etapa renombrada a "${name}"`);
  };

  const handleReorderStages = async (updates: { id: string; position: number }[]) => {
    // Optimistic update
    setStages((prev) => {
      const updated = [...prev];
      for (const u of updates) {
        const idx = updated.findIndex((s) => s.id === u.id);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], position: u.position };
        }
      }
      return updated.sort((a, b) => a.position - b.position);
    });

    try {
      await pipelineRepo.reorderStages(updates);
    } catch (err) {
      toast.error('Error al reordenar etapas');
      // Reload stages to revert
      if (selectedPipelineId) {
        const data = await pipelineRepo.getStages(selectedPipelineId);
        setStages(data);
      }
    }
  };

  const handleDeleteRequest = (id: string) => {
    const stage = stages.find((s) => s.id === id);
    if (!stage) return;

    const leadCount = leadsByStage[id] ?? 0;
    if (leadCount > 0) {
      // Show dialog for reassignment
      setDeleteConfirmStageId(id);
      return;
    }

    // No leads, delete directly
    confirmAndDelete(id);
  };

  const confirmAndDelete = async (id: string) => {
    try {
      await pipelineRepo.deleteStage(id);
      setStages((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirmStageId(null);
      toast.success('Etapa eliminada');
    } catch (err) {
      toast.error('Error al eliminar la etapa');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No hay pipelines aún.</p>
      </div>
    );
  }

  const deleteStage = stages.find((s) => s.id === deleteConfirmStageId);
  const leadCount = deleteConfirmStageId ? (leadsByStage[deleteConfirmStageId] ?? 0) : 0;

  return (
    <div className="space-y-6">
      {/* Pipeline Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Pipeline:</label>
        <Select
          value={selectedPipelineId ?? undefined}
          onValueChange={setSelectedPipelineId}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Seleccionar pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stages */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
          Etapas ({stages.length})
        </h3>

        <StageList
          stages={stages}
          leadsByStage={leadsByStage}
          onReorder={handleReorderStages}
          onRename={handleRenameStage}
          onDelete={handleDeleteRequest}
        />
      </div>

      {/* Add Stage */}
      <AddStageButton onAdd={handleAddStage} />

      {/* Delete Confirmation Dialog for stages with leads */}
      <Dialog
        open={!!deleteConfirmStageId}
        onOpenChange={(open) => !open && setDeleteConfirmStageId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Etapa con leads activos</DialogTitle>
            <DialogDescription>
              La etapa &ldquo;{deleteStage?.name}&rdquo; tiene {leadCount} lead{leadCount !== 1 ? 's' : ''} activo{leadCount !== 1 ? 's' : ''}. 
              Reasignalos a otra etapa antes de eliminar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmStageId(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
