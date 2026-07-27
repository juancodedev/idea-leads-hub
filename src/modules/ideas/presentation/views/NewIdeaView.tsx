"use client";

import { useState } from "react";
import { IdeaForm } from "../forms/IdeaForm";
import { IdeaSchemaType } from "../../infrastructure/schemas/IdeaSchema";
import { createIdeaAction } from "../../infrastructure/actions/ideaActions";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/components/card";
import { useSearchParams } from "next/navigation";

export function NewIdeaView() {
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId");

  const handleSubmit = async (data: IdeaSchemaType) => {
    setIsLoading(true);
    const result = await createIdeaAction(data);
    
    if (result?.error) {
      toast.error("Error al crear la idea", {
        description: result.error,
      });
      setIsLoading(false);
    } else {
      toast.success("Idea creada correctamente");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Idea</h1>
        <p className="text-muted-foreground">Registra tu próxima gran idea de negocio.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalles de la Idea</CardTitle>
          <CardDescription>
            Completa la información básica para empezar a trabajar en esta idea.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IdeaForm 
            onSubmit={handleSubmit} 
            isLoading={isLoading} 
            initialValues={{ leadIds: leadId ? [leadId] : [] }} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
