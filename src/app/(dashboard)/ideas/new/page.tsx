import { IdeaForm } from '@/modules/ideas/components/IdeaForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/card';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';

export const runtime = 'edge';

export default function NewIdeaPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Nueva Idea</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Detalles de la Idea</CardTitle>
            <CardDescription>
              Registra tu idea para empezar el proceso de validación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IdeaForm />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
