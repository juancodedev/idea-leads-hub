import { NewIdeaView } from "@/modules/ideas/presentation/views/NewIdeaView";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { Skeleton } from "@/ui/components/skeleton";
import { Suspense } from "react";

// Fallback skeleton loader that perfectly mimics the structure of NewIdeaView and its form
function NewIdeaLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-80" />
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-28 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex justify-end pt-2">
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewIdeaPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<NewIdeaLoading />}>
        <NewIdeaView />
      </Suspense>
    </DashboardLayout>
  );
}

