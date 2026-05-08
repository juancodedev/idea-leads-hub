import { IdeaForm } from '@/modules/ideas/components/IdeaForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/components/ui/card';

export default function NewIdeaPage() {
  return (
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
  );
}
