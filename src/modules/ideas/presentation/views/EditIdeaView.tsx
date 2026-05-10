"use client";

import { useState } from "react";
import { IdeaForm } from "../forms/IdeaForm";
import { IdeaSchemaType } from "../../infrastructure/schemas/IdeaSchema";
import { updateIdeaAction } from "../../infrastructure/actions/ideaActions";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/components/card";
import { Idea } from "../../domain/entities/Idea";
import { RelatedLeadCard } from "../components/RelatedLeadCard";

interface EditIdeaViewProps {
  idea: Idea;
}

export function EditIdeaView({ idea }: EditIdeaViewProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: IdeaSchemaType) => {
    setIsLoading(true);
    const result = await updateIdeaAction(idea.id, data);
    
    if (result?.error) {
      toast.error("Error al actualizar la idea", {
        description: result.error,
      });
      setIsLoading(false);
    } else {
      toast.success("Idea actualizada correctamente");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Editar Idea</h1>
        <p className="text-muted-foreground">Actualiza los detalles de tu idea.</p>
      </div>

      {idea.leadId && (
        <RelatedLeadCard leadId={idea.leadId} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Detalles de la Idea</CardTitle>
          <CardDescription>
            Modifica la información necesaria para seguir validando tu idea.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IdeaForm 
            initialValues={{
              title: idea.title,
              description: idea.description,
              priority: idea.priority,
              status: idea.status,
              leadId: idea.leadId,
              tagIds: idea.tags?.map(t => t.id) || [],
            }} 
            onSubmit={handleSubmit} 
            isLoading={isLoading} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
