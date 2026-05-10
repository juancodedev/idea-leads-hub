import { z } from "zod";
import { ActivityType } from "../../domain/enums/ActivityType";

export const activitySchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  description: z.string().optional(),
  type: z.nativeEnum(ActivityType).default(ActivityType.NOTE),
  dueDate: z.date().optional().nullable(),
  leadId: z.string().uuid("Lead inválido"),
});

export type ActivitySchemaType = z.infer<typeof activitySchema>;
