'use client';

import { useState, useEffect } from 'react';
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
import { PipelineColumn } from './PipelineColumn';
import { PipelineCard } from './PipelineCard';
import { useLeadsStore } from '../store/useLeadsStore';
import { createClient } from '@/infrastructure/database/client';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { toast } from 'sonner';

const COLUMNS: Lead['status'][] = [
  'Nuevo', 
  'Contactado', 
  'Interesado', 
  'Propuesta', 
  'Ganado', 
  'Perdido'
];

export function PipelineBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const { leads, setLeads, updateLeadStatus } = useLeadsStore();
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  
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

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveALead = active.data.current?.type === 'Lead';
    const isOverAColumn = over.data.current?.type === 'Column';

    if (isActiveALead && isOverAColumn) {
      const activeLead = leads.find((l) => l.id === activeId);
      if (activeLead && activeLead.status !== overId) {
        updateLeadStatus(activeId as string, overId as Lead['status']);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as Lead['status'];
    const lead = leads.find(l => l.id === leadId);

    if (lead && lead.status !== newStatus) {
      try {
        await repository.updateStatus(leadId, newStatus);
      } catch (error) {
        toast.error('Error al actualizar el estado');
        // Rollback opcional: recargar datos o revertir estado en store
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
      <div className="flex h-[calc(100vh-12rem)] gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((status) => (
          <PipelineColumn 
            key={status} 
            status={status} 
            leads={leads.filter((l) => l.status === status)} 
          />
        ))}
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
    </DndContext>
  );
}
