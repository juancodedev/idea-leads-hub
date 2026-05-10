import { Badge } from "@/ui/components/badge";
import { IdeaStatus } from "../../domain/enums/IdeaEnums";

interface IdeaStatusBadgeProps {
  status: IdeaStatus;
}

const statusConfig = {
  [IdeaStatus.BACKLOG]: { label: "Backlog", variant: "secondary" as const },
  [IdeaStatus.RESEARCHING]: { label: "Investigando", variant: "outline" as const },
  [IdeaStatus.PLANNED]: { label: "Planificada", variant: "default" as const },
  [IdeaStatus.IN_PROGRESS]: { label: "En Progreso", variant: "default" as const },
  [IdeaStatus.COMPLETED]: { label: "Completada", variant: "default" as const },
  [IdeaStatus.ARCHIVED]: { label: "Archivada", variant: "destructive" as const },
};

export function IdeaStatusBadge({ status }: IdeaStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "outline" };
  
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
