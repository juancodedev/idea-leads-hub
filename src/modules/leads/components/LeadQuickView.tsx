'use client';

import * as React from 'react';
import { Lead } from '@/core/domain/Lead';
import { PipelineStage } from '@/core/domain/Pipeline';
import { Tag } from '@/core/domain/Tag';
import { Button } from '@/ui/components/button';
import { Badge } from '@/ui/components/badge';
import {
  Building,
  Mail,
  Phone,
  ExternalLink,
  Calendar,
  Tag as TagIcon
} from 'lucide-react';
import { TagSelector } from '@/modules/shared/components/TagSelector';
import { NoteTimeline } from '@/modules/shared/components/NoteTimeline';
import { NoteForm } from '@/modules/shared/components/NoteForm';
import { createClient } from '@/infrastructure/database/client';
import { SupabaseTagRepository } from '@/infrastructure/repositories/SupabaseTagRepository';
import { SupabaseNoteRepository } from '@/infrastructure/repositories/SupabaseNoteRepository';
import Link from 'next/link';

interface LeadQuickViewProps {
  lead: Lead;
  stages: PipelineStage[];
  onUpdate: () => void;
}

export function LeadQuickView({ lead, stages, onUpdate }: LeadQuickViewProps) {
  const stage = stages.find(s => s.id === lead.stageId);
  const supabase = createClient();
  const tagRepo = new SupabaseTagRepository(supabase);
  const noteRepo = new SupabaseNoteRepository(supabase);

  const handleAssignTag = async (tag: Tag) => {
    await tagRepo.assignToEntity(tag.id, lead.id, 'lead');
    onUpdate();
  };

  const handleRemoveTag = async (tagId: string) => {
    await tagRepo.removeFromEntity(tagId, lead.id, 'lead');
    onUpdate();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Área con Scroll */}
      <div className="flex-1 overflow-y-auto pr-4 space-y-6">
        {/* Cabecera */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            {stage && (
              <Badge style={{ backgroundColor: `${stage.color}20`, color: stage.color, borderColor: stage.color }} variant="outline">
                {stage.name}
              </Badge>
            )}
            <Badge variant="secondary">{lead.status}</Badge>
          </div>
          <h2 className="text-2xl font-bold">{lead.name}</h2>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <Building className="h-4 w-4" /> {lead.company}
          </p>
        </div>

        {/* Contacto */}
        <div className="grid gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{lead.email}</span>
          </div>
          {lead.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{lead.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Creado el {new Date(lead.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Etiquetas */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TagIcon className="h-4 w-4" /> Etiquetas
          </h3>
          <TagSelector
            selectedTags={lead.tags || []}
            onAssign={handleAssignTag}
            onRemove={handleRemoveTag}
          />
        </div>

        {/* Notas */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Notas y Actividad</h3>
          <NoteForm 
            entityId={lead.id} 
            entityType="lead" 
            onNoteCreated={onUpdate} 
          />
          <div className="space-y-2">
            <NoteTimeline 
              notes={lead.notes_data || []} 
              onNoteDeleted={onUpdate}
            />
          </div>
        </div>
      </div>

      {/* Footer Fijo */}
      <div className="pt-4 mt-4 border-t bg-white dark:bg-slate-950">
        <Link href={`/leads/${lead.id}`} className="w-full">
          <Button className="w-full" variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" /> Abrir Perfil Completo
          </Button>
        </Link>
      </div>
    </div>
  );
}
