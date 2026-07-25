"use client";

import { useState, useEffect, useRef } from "react";
import { Idea } from "../../domain/entities/Idea";
import { IdeasBoard } from "../components/IdeasBoard";
import { IdeasList } from "../components/IdeasList";
import { IdeaFilters } from "../components/IdeaFilters";
import { EmptyState } from "@/ui/components/EmptyState";
import { Lightbulb } from "lucide-react";
import { useIdeasStore } from "../../store/useIdeasStore";

interface IdeasViewProps {
  initialIdeas: Idea[];
}

export function IdeasView({ initialIdeas }: IdeasViewProps) {
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [searchTerm, setSearchTerm] = useState("");
  const { ideas, setIdeas } = useIdeasStore();
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current) {
      setIdeas(initialIdeas);
      isInitialized.current = true;
    }
  }, [initialIdeas, setIdeas]);

  // Filter ideas based on search term and exclude archived unless specified
  const filteredIdeas = (ideas.length > 0 ? ideas : initialIdeas).filter(idea => {
    const matchesSearch = idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (idea.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const isNotArchived = idea.status !== "ARCHIVED";
    return matchesSearch && isNotArchived;
  });

  const hasNoIdeas = ideas.length === 0 && initialIdeas.length === 0 && !searchTerm;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Banco de Ideas</h1>
        <p className="text-muted-foreground">
          Gestiona tus ideas de negocio, experimentos y validaciones.
        </p>
      </div>

      {hasNoIdeas ? (
        <EmptyState
          icon={Lightbulb}
          title="No hay ideas registradas aún"
          description="Las ideas de negocio que crees aparecerán aquí."
        />
      ) : (
        <>
          <IdeaFilters
            viewMode={viewMode}
            setViewMode={setViewMode}
            onSearch={setSearchTerm}
          />

          <div className="flex-1 overflow-hidden">
            {filteredIdeas.length === 0 ? (
              <EmptyState
                icon={Lightbulb}
                title="Sin resultados"
                description="No se encontraron ideas que coincidan con tu búsqueda."
              />
            ) : (
              viewMode === "board" ? (
                <IdeasBoard initialIdeas={filteredIdeas} />
              ) : (
                <IdeasList ideas={filteredIdeas} />
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
