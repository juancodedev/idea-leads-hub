'use client';

import React, { useState, useEffect } from 'react';
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
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { Lead } from '@/core/domain/Lead';
import { PipelineStage } from '@/core/domain/Pipeline';
import { PipelineColumn } from './PipelineColumn';
import { PipelineCard } from './PipelineCard';
import { LeadPopup } from './LeadPopup';
import { useLeadsStore } from '../store/useLeadsStore';
import { createClient } from '@/infrastructure/database/client';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { toast } from 'sonner';

export function PipelineBoard({ initialLeads, stages }: { initialLeads: Lead[], stages: PipelineStage[] }) {
  const { leads, setLeads, updateLead, updateLeadStage } = useLeadsStore();
  const [activeLead, setActiveLead] = React.useState<Lead | null>(null);
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null);
  const selectedLead = leads.find((l) => l.id === selectedLeadId);
  
  const supabase = createClient();
  const repository = new SupabaseLeadRepository(supabase);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads, setLeads]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = leads.find((l) => l.id === active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragOver = async (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveALead = active.data.current?.type === 'Lead';
    if (!isActiveALead) return;

    const isOverAColumn = over.data.current?.type === 'Column';
    const isOverALead = over.data.current?.type === 'Lead';

    let newStageId: string | null = null;

    if (isOverAColumn) {
      newStageId = overId as string;
    } else if (isOverALead) {
      const overLead = leads.find((l) => l.id === overId);
      if (overLead) newStageId = overLead.stageId || null;
    }

    if (newStageId) {
      const activeLead = leads.find((l) => l.id === activeId);
      if (activeLead && activeLead.stageId !== newStageId) {
        const destinationStage = stages.find((s) => s.id === newStageId);
        updateLeadStage(activeId as string, newStageId, destinationStage?.name);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    let newStageId: string | null = null;

    if (over.data.current?.type === 'Column') {
      newStageId = overId;
    } else if (over.data.current?.type === 'Lead') {
      const overLead = leads.find(l => l.id === overId);
      if (overLead) newStageId = overLead.stageId || null;
    }

    // Usamos activeLead que capturamos al iniciar el arrastre para tener la referencia original
    if (activeLead && newStageId && activeLead.stageId !== newStageId) {
      const destinationStage = stages.find(s => s.id === newStageId);
      
      // Actualización optimista inmediata del status y stage
      updateLeadStage(activeId, newStageId, destinationStage?.name);

      try {
        const updatedLead = await repository.update({ 
          id: activeId, 
          stageId: newStageId 
        });
        
        // Confirmamos con los datos reales del servidor (que ya pasaron por el trigger)
        if (updatedLead) {
          updateLead(updatedLead);
        }
      } catch (error) {
        toast.error('Error al actualizar la etapa');
        console.error('Error actualizando etapa en Supabase:', error);
        // Aquí podrías revertir el estado si fuera crítico
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
      <div className="flex h-[calc(100vh-8rem)] gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <PipelineColumn 
            key={stage.id} 
            stage={stage} 
            leads={leads.filter((l) => l.stageId === stage.id)} 
            onCardClick={setSelectedLeadId}
          />
        ))}
        {stages.length === 0 && (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground">
            No hay etapas configuradas para este pipeline.
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activeLead ? <PipelineCard lead={activeLead} isOverlay /> : null}
      </DragOverlay>

      {selectedLead && (
        <LeadPopup
          lead={selectedLead}
          stages={stages}
          open={!!selectedLead}
          onOpenChange={(open) => !open && setSelectedLeadId(null)}
          onLeadUpdated={(updated) => {
            updateLead(updated);
            setSelectedLeadId(null);
          }}
        />
      )}
    </DndContext>
  );
}
