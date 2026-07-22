'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lead, UpdateLeadDTO } from '@/core/domain/Lead';
import { PipelineStage } from '@/core/domain/Pipeline';
import { LeadSchema, LeadFormValues } from '@/core/domain/LeadSchema';
import { Note } from '@/core/domain/Note';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/ui/components/sheet';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';
import { Loader2 } from 'lucide-react';
import { useLeadRepository, useNoteRepository } from '@/ui/providers/RepositoryProvider';
import { useLeadsStore } from '../store/useLeadsStore';
import { NoteForm } from '@/modules/shared/components/NoteForm';
import { NoteTimeline } from '@/modules/shared/components/NoteTimeline';
import { LeadActivitiesSection } from '@/modules/activities/presentation/components/LeadActivitiesSection';
import { toast } from 'sonner';

export interface LeadPopupProps {
  lead: Lead;
  stages: PipelineStage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated?: (lead: Lead) => void;
}

export function LeadPopup({ lead, stages, open, onOpenChange, onLeadUpdated }: LeadPopupProps) {
  const { updateLead } = useLeadsStore();
  const leadRepository = useLeadRepository();
  const noteRepository = useNoteRepository();

  const [notes, setNotes] = useState<Note[]>([]);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [stageId, setStageId] = useState<string>(lead.stageId || '');
  const leadIdRef = useRef(lead.id);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(LeadSchema),
    defaultValues: {
      name: lead.name || '',
      company: lead.company || '',
      email: lead.email || '',
      phone: lead.phone || '',
      address: lead.address || '',
      website: lead.website || '',
      instagramHandle: lead.instagramHandle || '',
      instagramScopedId: lead.instagramScopedId || '',
      status: lead.status,
      source: lead.source || '',
      notes: lead.notes || '',
    },
  });

  const fetchNotes = useCallback(async () => {
    setIsNotesLoading(true);
    try {
      const data = await noteRepository.getForEntity(lead.id, 'lead');
      setNotes(data);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setIsNotesLoading(false);
    }
  }, [lead.id, noteRepository]);

  useEffect(() => {
    if (open) {
      const isNewLead = lead.id !== leadIdRef.current;
      if (isNewLead) {
        leadIdRef.current = lead.id;
        form.reset({
          name: lead.name || '',
          company: lead.company || '',
          email: lead.email || '',
          phone: lead.phone || '',
          address: lead.address || '',
          website: lead.website || '',
          instagramHandle: lead.instagramHandle || '',
          instagramScopedId: lead.instagramScopedId || '',
          status: lead.status,
          source: lead.source || '',
          notes: lead.notes || '',
        });
        setStageId(lead.stageId || '');
        fetchNotes();
      }
    }
  }, [open, lead.id, form.reset, fetchNotes]);

  async function onSubmit(values: LeadFormValues) {
    try {
      const updateData: UpdateLeadDTO = {
        id: lead.id,
        name: values.name,
        company: values.company,
        email: values.email,
        phone: values.phone || undefined,
        address: values.address || undefined,
        website: values.website || undefined,
        instagramHandle: values.instagramHandle || undefined,
        instagramScopedId: values.instagramScopedId || undefined,
        source: values.source || undefined,
        notes: values.notes || undefined,
        pipelineId: values.pipelineId || undefined,
        stageId: stageId || values.stageId || undefined,
      };

      const updatedLead = await leadRepository.update(updateData);
      if (updatedLead) {
        updateLead(updatedLead);
        onLeadUpdated?.(updatedLead);
      }
      toast.success('Lead actualizado correctamente');
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Error al actualizar el lead', {
        description: error.message,
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lead.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          {/* Información del Lead */}
          <section>
            <h3 className="mb-4 text-lg font-semibold">Información del Lead</h3>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" {...form.register('name')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input id="company" {...form.register('company')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...form.register('email')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input id="phone" {...form.register('phone')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Sitio Web</Label>
                  <Input id="website" type="url" {...form.register('website')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input id="address" {...form.register('address')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagramHandle">Instagram</Label>
                  <Input id="instagramHandle" placeholder="@usuario o https://instagram.com/..." {...form.register('instagramHandle')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagramScopedId">Instagram ID (numérico)</Label>
                  <Input id="instagramScopedId" placeholder="Ej: 17841405822304715" {...form.register('instagramScopedId')} />
                </div>
              </div>

              {/* Stage selector */}
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select
                  value={stageId}
                  onValueChange={setStageId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Guardar
                </Button>
              </div>
            </form>
          </section>

          {/* Notes section */}
          <section>
            <h3 className="mb-4 text-lg font-semibold">Notas</h3>
            <NoteForm entityId={lead.id} entityType="lead" onNoteCreated={fetchNotes} />
            <div className="mt-4">
              <NoteTimeline notes={notes} onNoteDeleted={fetchNotes} />
            </div>
          </section>

          {/* Activity history section */}
          <section>
            <LeadActivitiesSection leadId={lead.id} />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
