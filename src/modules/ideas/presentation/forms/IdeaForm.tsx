"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ideaSchema, IdeaSchemaType } from "../../infrastructure/schemas/IdeaSchema";
import { IdeaStatus, IdeaPriority } from "../../domain/enums/IdeaEnums";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/ui/components/form";
import { Input } from "@/ui/components/input";
import { Textarea } from "@/ui/components/textarea";
import { Button } from "@/ui/components/button";
import { Loader2 } from "lucide-react";
import { TagsInput } from "../components/TagsInput";
import { LeadSelector } from "../components/LeadSelector";
import { FileUploader } from "../components/FileUploader";
import { useRouter } from "next/navigation";

interface IdeaFormProps {
  initialValues?: Partial<IdeaSchemaType>;
  onSubmit: (data: IdeaSchemaType) => Promise<void>;
  isLoading?: boolean;
  onCancel?: () => void;
  mode?: "create" | "edit";
}

export function IdeaForm({ initialValues, onSubmit, isLoading, onCancel, mode = "create" }: IdeaFormProps) {
  const router = useRouter();
  const form = useForm<IdeaSchemaType>({
    resolver: zodResolver(ideaSchema),
    defaultValues: {
      title: initialValues?.title || "",
      description: initialValues?.description || "",
      priority: initialValues?.priority || IdeaPriority.MEDIUM,
      status: initialValues?.status || IdeaStatus.BACKLOG,
      leadId: initialValues?.leadId || null,
      tagIds: initialValues?.tagIds || [],
      attachments: initialValues?.attachments || [],
    },
  });

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Nueva App de CRM" {...field} />
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
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe tu idea detalladamente..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="leadId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lead Relacionado (Opcional)</FormLabel>
              <FormControl>
                <LeadSelector
                  selectedLeadId={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prioridad</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {Object.values(IdeaPriority).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
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
                <FormControl>
                  <select
                    {...field}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {Object.values(IdeaStatus).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="tagIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Etiquetas</FormLabel>
              <FormControl>
                <TagsInput value={field.value || []} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="attachments"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Archivos Adjuntos</FormLabel>
              <FormControl>
                <FileUploader 
                  value={field.value || []} 
                  onChange={field.onChange} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            className="flex-1" 
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="submit" className="flex-[2]" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Actualizar Idea" : "Crear Idea"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
