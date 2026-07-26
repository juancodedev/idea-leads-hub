"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Idea } from "../../domain/entities/Idea";
import { IdeaStatus } from "../../domain/enums/IdeaEnums";
import { IdeasBoard } from "../components/IdeasBoard";
import { IdeasList } from "../components/IdeasList";
import { IdeaFilters } from "../components/IdeaFilters";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/input";
import { Lightbulb, Search, X } from "lucide-react";
import { useIdeasStore } from "../../store/useIdeasStore";
import { useRouter, useSearchParams } from "next/navigation";

interface IdeasViewProps {
  initialIdeas: Idea[];
  searchParams: Record<string, string>;
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  RESEARCHING: 'Investigando',
  PLANNED: 'Planeada',
  IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completada',
  ARCHIVED: 'Archivada',
};

export function IdeasView({ initialIdeas, searchParams }: IdeasViewProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [searchTerm, setSearchTerm] = useState(searchParams.q || "");
  const { ideas, setIdeas } = useIdeasStore();
  const isInitialized = useRef(false);

  const currentStatus = searchParams.status || '';
  const currentSort = searchParams.sort || '';

  useEffect(() => {
    if (!isInitialized.current) {
      setIdeas(initialIdeas);
      isInitialized.current = true;
    }
  }, [initialIdeas, setIdeas]);

  const updateParam = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.replace(`/ideas?${next.toString()}`, { scroll: false });
  }, [router, sp]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    updateParam('q', val || null);
  }, [updateParam]);

  // Filter ideas based on search term and status
  const filteredIdeas = (ideas.length > 0 ? ideas : initialIdeas).filter(idea => {
    const matchesSearch = !searchTerm ||
      idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (idea.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = !currentStatus || idea.status === currentStatus;
    const isNotArchived = !currentStatus && idea.status !== "ARCHIVED";
    return matchesSearch && (matchesStatus || (isNotArchived && !currentStatus));
  });

  const hasNoIdeas = ideas.length === 0 && initialIdeas.length === 0 && !searchTerm && !currentStatus;

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
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ideas..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-9 h-10 w-64"
                />
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(''); updateParam('q', null); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
              <select
                value={currentStatus}
                onChange={(e) => updateParam('status', e.target.value || null)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </IdeaFilters>

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
