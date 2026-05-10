import { Badge } from "@/ui/components/badge";
import { IdeaPriority } from "../../domain/enums/IdeaEnums";
import { cn } from "@/lib/utils";

interface IdeaPriorityBadgeProps {
  priority: IdeaPriority;
  className?: string;
}

const priorityConfig = {
  [IdeaPriority.LOW]: { label: "Baja", className: "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300" },
  [IdeaPriority.MEDIUM]: { label: "Media", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300" },
  [IdeaPriority.HIGH]: { label: "Alta", className: "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300" },
  [IdeaPriority.CRITICAL]: { label: "Crítica", className: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-300" },
};

export function IdeaPriorityBadge({ priority, className }: IdeaPriorityBadgeProps) {
  const config = priorityConfig[priority];
  
  return (
    <Badge variant="outline" className={cn("border-none", config.className, className)}>
      {config.label}
    </Badge>
  );
}
