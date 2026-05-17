import { NewIdeaView } from "@/modules/ideas/presentation/views/NewIdeaView";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";

// export const runtime = "edge";

export default function NewIdeaPage() {
  return (
    <DashboardLayout>
      <NewIdeaView />
    </DashboardLayout>
  );
}
