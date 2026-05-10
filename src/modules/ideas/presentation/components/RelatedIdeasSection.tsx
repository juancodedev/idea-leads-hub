"use client";

import { useEffect, useState } from "react";
import { Idea } from "../../domain/entities/Idea";
import { ideaModule } from "../../index";
import { IdeaCard } from "./IdeaCard";
import { Button } from "@/ui/components/button";
import { Plus, Lightbulb } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/ui/components/skeleton";

interface RelatedIdeasSectionProps {
  leadId: string;
}

export function RelatedIdeasSection({ leadId }: RelatedIdeasSectionProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const module = ideaModule();

  useEffect(() => {
    setIsLoading(true);
    module.getIdeas.execute({ leadId })
      .then(setIdeas)
      .finally(() => setIsLoading(false));
  }, [leadId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[150px]" />
          <Skeleton className="h-[150px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Ideas Relacionadas
        </h2>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/ideas/new?leadId=${leadId}`}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Idea
          </Link>
        </Button>
      </div>

      {ideas.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">
          <p className="text-sm">No hay ideas vinculadas a este lead.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  );
}
