import { cn } from "@/lib/utils"
import { Button } from "@/ui/components/button"

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div role="status" className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center p-8">
      {Icon && (
        <span aria-hidden="true"><Icon className="h-12 w-12 text-muted-foreground/40 mb-4" /></span>
      )}
      <h3 className={cn(
        "text-lg font-semibold text-muted-foreground",
        !Icon && "mt-0"
      )}>
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button
          type="button"
          variant="default"
          size="sm"
          className="mt-4"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
