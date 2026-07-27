import { z } from "zod";
import { IdeaPriority, IdeaStatus } from "../../domain/enums/IdeaEnums";

export const ideaSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres").max(255),
  description: z.string().max(2000).optional(),
  priority: z.nativeEnum(IdeaPriority).default(IdeaPriority.MEDIUM),
  status: z.nativeEnum(IdeaStatus).default(IdeaStatus.BACKLOG),
  leadIds: z.array(z.string().uuid()).default([]),
  tagIds: z.array(z.string().uuid()).default([]),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    path: z.string(),
    size: z.number(),
    type: z.string(),
  })).default([]),
});

export type IdeaSchemaType = z.infer<typeof ideaSchema>;
