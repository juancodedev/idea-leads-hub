"use client";

import { Input } from "@/ui/components/input";
import { Button } from "@/ui/components/button";
import { Search, Plus, LayoutGrid, List } from "lucide-react";
import Link from "next/link";

interface IdeaFiltersProps {
  viewMode: "board" | "list";
  setViewMode: (mode: "board" | "list") => void;
  onSearch: (term: string) => void;
  children?: React.ReactNode;
}

export function IdeaFilters({ viewMode, setViewMode, onSearch, children }: IdeaFiltersProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {children || (
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar ideas..." 
            className="pl-10"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-lg border bg-background p-1">
          <Button 
            variant={viewMode === "board" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8 px-3"
            onClick={() => setViewMode("board")}
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            Tablero
          </Button>
          <Button 
            variant={viewMode === "list" ? "secondary" : "ghost"} 
            size="sm" 
            className="h-8 px-3"
            onClick={() => setViewMode("list")}
          >
            <List className="mr-2 h-4 w-4" />
            Lista
          </Button>
        </div>

        <Button asChild>
          <Link href="/ideas/new">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Idea
          </Link>
        </Button>
      </div>
    </div>
  );
}
