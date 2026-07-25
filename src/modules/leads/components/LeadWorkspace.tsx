'use client';

import * as React from 'react';
import { Lead } from '@/core/domain/Lead';
import { Tag } from '@/core/domain/Tag';
import { Note } from '@/core/domain/Note';
import type { Pipeline, PipelineStage } from '@/core/domain/Pipeline';
import { TagSelector } from '@/modules/shared/components/TagSelector';
import { NoteForm } from '@/modules/shared/components/NoteForm';
import { NoteTimeline } from '@/modules/shared/components/NoteTimeline';
import { useTagRepository, useNoteRepository, usePipelineRepository, useLeadRepository } from '@/ui/providers/RepositoryProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
import { MessageSquare, History, Lightbulb, MessageCircle } from 'lucide-react';
import { LeadActivitiesSection } from '@/modules/activities/presentation/components/LeadActivitiesSection';
import { RelatedIdeasSection } from '@/modules/ideas/presentation/components/RelatedIdeasSection';
import { InstagramSendDialog } from '@/modules/instagram/components/InstagramSendDialog';
import { InstagramConversation } from '@/modules/instagram/components/InstagramConversation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { toast } from 'sonner';

interface LeadWorkspaceProps {
  lead: Lead;
}

export function LeadWorkspace({ lead }: LeadWorkspaceProps) {
  const [tags, setTags] = React.useState<Tag[]>(lead.tags || []);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [stages, setStages] = React.useState<PipelineStage[]>([]);
  const [currentStage, setCurrentStage] = React.useState(lead.status);
  const [loading, setLoading] = React.useState(true);
  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string | null>(
    lead.pipelineId ?? null
  );

  const tagRepository = useTagRepository();
  const noteRepository = useNoteRepository();
  const pipelineRepo = usePipelineRepository();
  const leadRepo = useLeadRepository();

  const fetchNotes = React.useCallback(async () => {
    try {
      const data = await noteRepository.getForEntity(lead.id, 'lead');
      setNotes(data);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  }, [lead.id, noteRepository, setNotes, setLoading]);

  React.useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Fetch pipelines and stages on mount
  React.useEffect(() => {
    async function loadPipelinesAndStages() {
      try {
        const allPipelines = await pipelineRepo.getAll();
        setPipelines(allPipelines);

        const pipelineId = lead.pipelineId || (allPipelines.length > 0 ? allPipelines[0].id : null);
        if (pipelineId) {
          setSelectedPipelineId(pipelineId);
          const data = await pipelineRepo.getStages(pipelineId);
          setStages(data);
        }
      } catch (err) {
        console.error('Error loading pipelines and stages:', err);
      }
    }
    loadPipelinesAndStages();
  }, [lead.pipelineId, pipelineRepo]);

  // Handle pipeline change
  const handlePipelineChange = async (newPipelineId: string) => {
    setSelectedPipelineId(newPipelineId);
    try {
      const newStages = await pipelineRepo.getStages(newPipelineId);
      setStages(newStages);

      // Check if current stage exists in new pipeline
      const stageExists = newStages.some(
        (s) => s.id === lead.stageId || s.name === lead.status
      );
      if (!stageExists) {
        toast.warning('El stage actual no existe en este pipeline. Seleccioná uno nuevo.');
      }
    } catch (err) {
      console.error('Error loading stages for pipeline:', err);
    }
  };

  const handleAssignTag = async (tag: Tag) => {
    await tagRepository.assignToEntity(tag.id, lead.id, 'lead');
    setTags((prev) => [...prev, tag]);
  };

  const handleRemoveTag = async (tagId: string) => {
    await tagRepository.removeFromEntity(tagId, lead.id, 'lead');
    setTags((prev) => prev.filter((t) => t.id !== tagId));
  };

  const handleStageChange = async (stageName: string) => {
    setCurrentStage(stageName);
    try {
      await leadRepo.updateStatus(lead.id, stageName);
      toast.success(`Etapa cambiada a "${stageName}"`);
    } catch (err) {
      console.error('Error updating stage:', err);
      toast.error('Error al cambiar la etapa');
      setCurrentStage(lead.status); // revert on error
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Columna Izquierda: Tags y Etapa */}
      <div className="md:col-span-1 space-y-6">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground tracking-wider">Etiquetas</h3>
          <TagSelector 
            selectedTags={tags} 
            onAssign={handleAssignTag} 
            onRemove={handleRemoveTag} 
          />
        </div>

        {/* Pipeline Selector — only show when multiple pipelines */}
        {pipelines.length > 1 && (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground tracking-wider">Pipeline</h3>
            <Select
              value={selectedPipelineId ?? undefined}
              onValueChange={handlePipelineChange}
            >
              <SelectTrigger aria-label="Pipeline">
                <SelectValue placeholder="Seleccionar pipeline..." />
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
        )}

        {/* Pipeline name display when only one pipeline */}
        {pipelines.length === 1 && (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground tracking-wider">Pipeline</h3>
            <p className="text-sm font-medium">{pipelines[0].name}</p>
          </div>
        )}

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground tracking-wider">Etapa</h3>
          {stages.length > 0 ? (
            <Select value={currentStage} onValueChange={handleStageChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar etapa..." />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.name}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span>{stage.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">No hay etapas disponibles</p>
          )}
        </div>
      </div>

      {/* Columna Derecha: Workspace con Tabs */}
      <div className="md:col-span-2">
        <Tabs defaultValue="notes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="instagram" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Instagram
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

          <TabsContent value="instagram" className="space-y-6">
            <InstagramSendDialog
              leadId={lead.id}
              leadName={lead.name}
              instagramHandle={lead.instagramHandle}
              instagramScopedId={lead.instagramScopedId}
            />

            <InstagramConversation leadId={lead.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
