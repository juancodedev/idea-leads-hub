'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LeadSchema, LeadFormValues } from '@/core/domain/LeadSchema';
import { Button } from '@/ui/components/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui/components/form';
import { Input } from '@/ui/components/input';
import { Textarea } from '@/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';
import { useRouter } from 'next/navigation';
import { useLeadRepository, usePipelineRepository } from '@/ui/providers/RepositoryProvider';
import { Lead } from '@/core/domain/Lead';
import type { PipelineStage } from '@/core/domain/Pipeline';
import { toast } from 'sonner';
import React from 'react';

import { useLeadsStore } from '../store/useLeadsStore';

interface LeadFormProps {
  initialData?: Lead;
}

export function LeadForm({ initialData }: LeadFormProps) {
  const router = useRouter();
  const { leads, setLeads } = useLeadsStore();
  const repository = useLeadRepository();
  const pipelineRepo = usePipelineRepository();
  const [stages, setStages] = React.useState<PipelineStage[]>([]);

  React.useEffect(() => {
    async function loadStages() {
      try {
        if (initialData?.pipelineId) {
          const data = await pipelineRepo.getStages(initialData.pipelineId);
          setStages(data);
        } else {
          const pipelines = await pipelineRepo.getAll();
          if (pipelines.length > 0 && pipelines[0].stages) {
            setStages(pipelines[0].stages);
          }
        }
      } catch (err) {
        console.error('Error loading stages:', err);
      }
    }
    loadStages();
  }, [initialData?.pipelineId, pipelineRepo]);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(LeadSchema),
    defaultValues: {
      name: initialData?.name || '',
      company: initialData?.company || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      address: initialData?.address || '',
      website: initialData?.website || '',
      instagramHandle: initialData?.instagramHandle || '',
      instagramScopedId: initialData?.instagramScopedId || '',
      jobTitle: initialData?.jobTitle || '',
      linkedinUrl: initialData?.linkedinUrl || '',
      estimatedValue: initialData?.estimatedValue || undefined,
      nextFollowUp: initialData?.nextFollowUp || '',
      status: initialData?.status || 'Nuevo',
      source: initialData?.source || '',
      notes: initialData?.notes || '',
      pipelineId: initialData?.pipelineId || undefined,
      stageId: initialData?.stageId || undefined,
    },
  });

  // Diagnóstico de errores (solo en desarrollo)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development' && Object.keys(form.formState.errors).length > 0) {
      console.log('Errores de validación:', form.formState.errors);
    }
  }, [form.formState.errors]);

  async function onSubmit(values: LeadFormValues) {
    try {
      if (initialData) {
        const updatedLead = await repository.update({ id: initialData.id, ...values });
        if (updatedLead) {
          setLeads(leads.map(l => l.id === initialData.id ? updatedLead : l));
        }
        toast.success('Lead actualizado correctamente');
      } else {
        const newLead = await repository.create(values);
        if (newLead) {
          setLeads([newLead, ...leads]);
        }
        toast.success('Lead creado correctamente');
      }
      router.push('/leads');
      router.refresh();
    } catch (error: any) {
      toast.error(initialData ? 'Error al actualizar el lead' : 'Error al crear el lead', {
        description: error.message,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Juan Pérez" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Empresa</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Inc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="juan@acme.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input placeholder="+34 600 000 000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {stages.length === 0 ? (
                      <>
                        <SelectItem value="Nuevo">Nuevo</SelectItem>
                        <SelectItem value="Contactado">Contactado</SelectItem>
                        <SelectItem value="Interesado">Interesado</SelectItem>
                        <SelectItem value="Propuesta">Propuesta</SelectItem>
                        <SelectItem value="Ganado">Ganado</SelectItem>
                        <SelectItem value="Perdido">Perdido</SelectItem>
                      </>
                    ) : (
                      stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.name}>
                          {stage.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origen</FormLabel>
                <FormControl>
                  <Input placeholder="LinkedIn, Referido, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sitio Web</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://acme.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="instagramHandle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instagram</FormLabel>
                <FormControl>
                  <Input placeholder="@usuario o https://instagram.com/..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="instagramScopedId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instagram ID (numérico)</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: 17841405822304715" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="jobTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cargo</FormLabel>
                <FormControl>
                  <Input placeholder="CEO, Marketing Manager, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="linkedinUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>LinkedIn</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://linkedin.com/in/..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="estimatedValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor estimado ($)</FormLabel>
                <FormControl>
                  <Input type="number" min="0" step="0.01" placeholder="Ej: 50000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nextFollowUp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Próximo seguimiento</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección</FormLabel>
              <FormControl>
                <Textarea placeholder="Calle, ciudad, país..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea placeholder="Detalles adicionales..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando...' : initialData ? 'Actualizar Lead' : 'Guardar Lead'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
