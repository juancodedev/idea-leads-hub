"use client";

import { useState, useEffect, useRef } from "react";
import { Idea } from "../../domain/entities/Idea";
import { IdeasBoard } from "../components/IdeasBoard";
import { IdeasList } from "../components/IdeasList";
import { IdeaFilters } from "../components/IdeaFilters";
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

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Banco de Ideas</h1>
        <p className="text-muted-foreground">
          Gestiona tus ideas de negocio, experimentos y validaciones.
        </p>
      </div>

      <IdeaFilters
        viewMode={viewMode}
        setViewMode={setViewMode}
        onSearch={setSearchTerm}
      />

      <div className="flex-1 overflow-hidden">
        {viewMode === "board" ? (
          <IdeasBoard initialIdeas={filteredIdeas} />
        ) : (
          <IdeasList ideas={filteredIdeas} />
        )}
      </div>
    </div>
  );
}
