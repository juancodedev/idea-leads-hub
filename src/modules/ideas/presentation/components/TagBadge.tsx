import { Badge } from "@/ui/components/badge";
import { Tag } from "@/core/domain/Tag";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagBadgeProps {
  tag: Tag;
  onRemove?: (id: string) => void;
  className?: string;
}

export function TagBadge({ tag, onRemove, className }: TagBadgeProps) {
  return (
    <Badge 
      variant="secondary" 
      style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined, color: tag.color || undefined, borderColor: tag.color ? `${tag.color}40` : undefined }}
      className={cn("flex items-center gap-1 border", className)}
    >
      {tag.name}
      {onRemove && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRemove(tag.id);
          }}
          className="ml-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}
