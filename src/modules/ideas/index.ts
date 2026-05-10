import { createClient } from "@/infrastructure/database/client";
import { SupabaseIdeaRepository } from "./infrastructure/repositories/SupabaseIdeaRepository";
import { CreateIdea } from "./application/use-cases/CreateIdea";
import { UpdateIdea } from "./application/use-cases/UpdateIdea";
import { GetIdeas } from "./application/use-cases/GetIdeas";
import { MoveIdeaStatus } from "./application/use-cases/MoveIdeaStatus";
import { DeleteIdea } from "./application/use-cases/DeleteIdea";

// Factory to simplify injection
export const ideaModule = () => {
  const supabase = createClient();
  const repository = new SupabaseIdeaRepository(supabase);

  return {
    createIdea: new CreateIdea(repository),
    updateIdea: new UpdateIdea(repository),
    getIdeas: new GetIdeas(repository),
    moveIdeaStatus: new MoveIdeaStatus(repository),
    deleteIdea: new DeleteIdea(repository),
  };
};

export * from "./domain/entities/Idea";
export * from "./domain/enums/IdeaEnums";
export * from "./infrastructure/schemas/IdeaSchema";
