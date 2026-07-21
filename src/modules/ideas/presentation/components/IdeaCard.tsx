import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/ui/components/card";
import { Idea } from "../../domain/entities/Idea";
import { IdeaStatusBadge } from "./IdeaStatusBadge";
import { IdeaPriorityBadge } from "./IdeaPriorityBadge";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TagBadge } from "./TagBadge";

interface IdeaCardProps {
  idea: Idea;
  onClick?: (id: string) => void;
}

export function IdeaCard({ idea, onClick }: IdeaCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow" 
      onClick={() => onClick?.(idea.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg font-bold leading-tight">
            {idea.title}
          </CardTitle>
          <IdeaPriorityBadge priority={idea.priority} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {idea.description || "Sin descripción"}
        </p>
        
        {idea.tags && idea.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {idea.tags.slice(0, 3).map((tag) => (
              <TagBadge key={tag.id} tag={tag} className="px-1.5 py-0 text-[10px]" />
            ))}
            {idea.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{idea.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0 flex justify-between items-center text-xs text-muted-foreground">
        <IdeaStatusBadge status={idea.status} />
        <div className="flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" />
          <span>{format(idea.createdAt, "dd MMM", { locale: es })}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
