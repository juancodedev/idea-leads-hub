import { z } from 'zod';

export const IdeaSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  description: z.string().min(10, 'Describe mejor tu idea'),
  status: z.enum(['Borrador', 'Investigando', 'En Progreso', 'Validada', 'Descartada']),
  priority: z.number().min(1).max(5),
  potentialRevenue: z.number().optional(),
});

export type IdeaFormValues = z.infer<typeof IdeaSchema>;
