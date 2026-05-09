'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { IdeaSchema, IdeaFormValues } from '@/core/domain/schemas/IdeaSchema';
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
import { useRouter } from 'next/navigation';
import { createClient } from '@/infrastructure/database/client';
import { SupabaseIdeaRepository } from '@/infrastructure/repositories/SupabaseIdeaRepository';
import { toast } from 'sonner';

export function IdeaForm() {
  const router = useRouter();
  const supabase = createClient();
  const repository = new SupabaseIdeaRepository(supabase);

  const form = useForm<IdeaFormValues>({
    resolver: zodResolver(IdeaSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'Borrador',
      priority: 3,
      potentialRevenue: 0,
    },
  });

  async function onSubmit(values: IdeaFormValues) {
    try {
      await repository.create(values);
      toast.success('Idea guardada correctamente');
      router.push('/ideas');
      router.refresh();
    } catch (error: any) {
      toast.error('Error al guardar la idea', {
        description: error.message,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título de la Idea</FormLabel>
              <FormControl>
                <Input placeholder="Ej: SaaS de gestión para..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción / Notas</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Explica brevemente de qué trata la idea..." 
                  className="min-h-[120px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-6 md:grid-cols-3">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300"
                  >
                    <option value="Borrador">Borrador</option>
                    <option value="Investigando">Investigando</option>
                    <option value="Validando">Validando</option>
                    <option value="Ejecutando">Ejecutando</option>
                    <option value="Archivado">Archivado</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prioridad (1-5)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min={1} 
                    max={5} 
                    {...field} 
                    onChange={e => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="potentialRevenue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ingreso Potencial ($)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="0"
                    {...field} 
                    onChange={e => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end space-x-4 pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit">Guardar Idea</Button>
        </div>
      </form>
    </Form>
  );
}
