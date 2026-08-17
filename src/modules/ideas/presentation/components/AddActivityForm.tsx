"use client";

import { useState } from "react";
import { ActivityType } from "../../../activities/domain/enums/ActivityType";
import { ActivityStatus } from "../../../activities/domain/enums/ActivityStatus";
import { Button } from "@/ui/components/button";
import { Textarea } from "@/ui/components/textarea";
import { FileUploader } from "./FileUploader";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import { Activity, ActivityAttachment } from "../../../activities/domain/entities/Activity";
import { createActivityAction, updateActivityAction } from "../../../activities/infrastructure/actions/activityActions";

interface AddActivityFormProps {
  ideaId: string;
  activity?: Activity;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddActivityForm({ ideaId, activity, onSuccess, onCancel }: AddActivityFormProps) {
  const [isExpanding, setIsExpanding] = useState(!!activity);
  const [isLoading, setIsLoading] = useState(false);
  const [description, setDescription] = useState(activity?.description || "");
  const [type, setType] = useState<ActivityType>(activity?.type || ActivityType.NOTE);
  const [attachments, setAttachments] = useState<ActivityAttachment[]>(activity?.attachments || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsLoading(true);
    
    let result;
    if (activity) {
      result = await updateActivityAction({
        id: activity.id,
        description,
        type,
        attachments,
      });
    } else {
      result = await createActivityAction({
        ideaId,
        title: type === ActivityType.NOTE ? "Nota" : 
               type === ActivityType.INVESTIGATION ? "Investigación" : 
               type === ActivityType.ACTION ? "Acción" : "Actividad",
        description,
        type,
        attachments,
        // Activities logged from an idea are completed work by definition
        // (status migration: normalized from the legacy completed=true).
        status: ActivityStatus.COMPLETED,
      });
    }

    if (result.success) {
      toast.success(activity ? "Actividad actualizada" : "Actividad registrada");
      if (!activity) {
        setDescription("");
        setAttachments([]);
        setIsExpanding(false);
      }
      onSuccess?.();
    } else {
      toast.error(activity ? "Error al actualizar" : "Error al registrar", {
        description: result.error,
      });
    }
    setIsLoading(false);
  };

  if (!isExpanding) {
    return (
      <div 
        onClick={() => setIsExpanding(true)}
        className="flex cursor-pointer items-center gap-2 rounded-lg border bg-muted/30 p-3 text-muted-foreground transition-all hover:bg-muted/50"
      >
        <MessageSquare className="h-5 w-5" />
        <span>Añadir un comentario o registro de actividad...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4 shadow-sm animate-in fade-in zoom-in duration-200">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ActivityType)}
          className="flex h-9 w-fit rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value={ActivityType.NOTE}>Nota / Comentario</option>
          <option value={ActivityType.INVESTIGATION}>Investigación</option>
          <option value={ActivityType.ACTION}>Acción realizada</option>
          <option value={ActivityType.CALL}>Llamada</option>
          <option value={ActivityType.EMAIL}>Correo</option>
          <option value={ActivityType.MEETING}>Reunión</option>
        </select>
      </div>

      <Textarea
        placeholder="¿Qué has realizado? Detalles de la investigación, notas del llamado, etc."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-[100px] resize-none"
        autoFocus
      />

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Adjuntos</label>
        <FileUploader 
          value={attachments} 
          onChange={setAttachments} 
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button 
          type="button" 
          variant="ghost" 
          size="sm"
          onClick={() => setIsExpanding(false)}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isLoading || !description.trim()}>
          {isLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Guardar Actividad
        </Button>
      </div>
    </form>
  );
}
