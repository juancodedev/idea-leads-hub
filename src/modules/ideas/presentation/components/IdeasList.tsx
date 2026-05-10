"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/table";
import { Idea } from "../../domain/entities/Idea";
import { IdeaStatusBadge } from "./IdeaStatusBadge";
import { IdeaPriorityBadge } from "./IdeaPriorityBadge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { TagBadge } from "./TagBadge";

interface IdeasListProps {
  ideas: Idea[];
}

export function IdeasList({ ideas }: IdeasListProps) {
  const router = useRouter();

  if (ideas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <p>No se encontraron ideas.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Etiquetas</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Creada el</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ideas.map((idea) => (
            <TableRow 
              key={idea.id} 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/ideas/${idea.id}/edit`)}
            >
              <TableCell className="font-medium">{idea.title}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {idea.tags?.map((tag) => (
                    <TagBadge key={tag.id} tag={tag} className="px-1.5 py-0 text-[10px]" />
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <IdeaStatusBadge status={idea.status} />
              </TableCell>
              <TableCell>
                <IdeaPriorityBadge priority={idea.priority} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(idea.createdAt, "dd/MM/yyyy", { locale: es })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
