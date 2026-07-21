import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center p-8">
      {Icon && (
        <Icon className="h-12 w-12 text-muted-foreground/40 mb-4" />
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
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
