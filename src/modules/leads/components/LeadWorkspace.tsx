'use client';

import * as React from 'react';
import { Lead } from '@/core/domain/Lead';
import { Tag } from '@/core/domain/Tag';
import { Note } from '@/core/domain/Note';
import { TagSelector } from '@/modules/shared/components/TagSelector';
import { NoteForm } from '@/modules/shared/components/NoteForm';
import { NoteTimeline } from '@/modules/shared/components/NoteTimeline';
import { createClient } from '@/infrastructure/database/client';
import { SupabaseTagRepository } from '@/infrastructure/repositories/SupabaseTagRepository';
import { SupabaseNoteRepository } from '@/infrastructure/repositories/SupabaseNoteRepository';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
import { MessageSquare, History, Lightbulb } from 'lucide-react';
import { LeadActivitiesSection } from '@/modules/activities/presentation/components/LeadActivitiesSection';
import { RelatedIdeasSection } from '@/modules/ideas/presentation/components/RelatedIdeasSection';

interface LeadWorkspaceProps {
  lead: Lead;
}

export function LeadWorkspace({ lead }: LeadWorkspaceProps) {
  const [tags, setTags] = React.useState<Tag[]>(lead.tags || []);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(true);

  const supabase = createClient();
  const tagRepository = new SupabaseTagRepository(supabase);
  const noteRepository = new SupabaseNoteRepository(supabase);

  const fetchNotes = React.useCallback(async () => {
    try {
      const data = await noteRepository.getForEntity(lead.id, 'lead');
      setNotes(data);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  }, [lead.id, noteRepository]);

  React.useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAssignTag = async (tag: Tag) => {
    await tagRepository.assignToEntity(tag.id, lead.id, 'lead');
    setTags((prev) => [...prev, tag]);
  };

  const handleRemoveTag = async (tagId: string) => {
    await tagRepository.removeFromEntity(tagId, lead.id, 'lead');
    setTags((prev) => prev.filter((t) => t.id !== tagId));
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Columna Izquierda: Información y Tags */}
      <div className="md:col-span-1 space-y-6">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground tracking-wider">Etiquetas</h3>
          <TagSelector 
            selectedTags={tags} 
            onAssign={handleAssignTag} 
            onRemove={handleRemoveTag} 
          />
        </div>
      </div>

      {/* Columna Derecha: Workspace con Tabs */}
      <div className="md:col-span-2">
        <Tabs defaultValue="notes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="notes" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Notas
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <History className="h-4 w-4" />
              Actividad
            </TabsTrigger>
            <TabsTrigger value="ideas" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Ideas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="font-semibold mb-4">Añadir Nota</h3>
              <NoteForm 
                entityId={lead.id} 
                entityType="lead" 
                onNoteCreated={fetchNotes} 
              />
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="font-semibold mb-6">Línea de Tiempo</h3>
              {loading ? (
                <div className="space-y-4">
                  <div className="h-20 bg-slate-100 animate-pulse rounded-lg" />
                  <div className="h-20 bg-slate-100 animate-pulse rounded-lg" />
                </div>
              ) : (
                <NoteTimeline notes={notes} onNoteDeleted={fetchNotes} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <LeadActivitiesSection leadId={lead.id} />
            </div>
          </TabsContent>

          <TabsContent value="ideas" className="space-y-6">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <RelatedIdeasSection leadId={lead.id} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
