"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { activitySchema, ActivitySchemaType } from "../../infrastructure/schemas/ActivitySchema";
import { ActivityType } from "../../domain/enums/ActivityType";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/components/form";
import { Input } from "@/ui/components/input";
import { Textarea } from "@/ui/components/textarea";
import { Button } from "@/ui/components/button";
import { Loader2 } from "lucide-react";

interface ActivityFormProps {
  leadId: string;
  onSubmit: (data: ActivitySchemaType) => Promise<void>;
  isLoading?: boolean;
  initialValues?: Partial<ActivitySchemaType>;
}

export function ActivityForm({ leadId, onSubmit, isLoading, initialValues }: ActivityFormProps) {
  const form = useForm<ActivitySchemaType>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: initialValues?.title || "",
      description: initialValues?.description || "",
      type: initialValues?.type || ActivityType.NOTE,
      dueDate: initialValues?.dueDate || null,
      leadId: leadId,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Actividad</FormLabel>
              <FormControl>
                <select 
                  {...field} 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {Object.values(ActivityType).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título / Resumen</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Llamar para seguimiento" {...field} />
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
              <FormLabel>Detalles</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Notas adicionales..." 
                  className="min-h-[80px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="dueDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de Vencimiento (Opcional)</FormLabel>
              <FormControl>
                <Input 
                  type="date" 
                  {...field} 
                  value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""}
                  onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialValues ? "Guardar Cambios" : "Registrar Actividad"}
        </Button>
      </form>
    </Form>
  );
}
