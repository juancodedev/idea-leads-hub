import { createClient } from "@/infrastructure/database/client";
import { SupabaseActivityRepository } from "./infrastructure/repositories/SupabaseActivityRepository";
import { CreateActivity } from "./application/use-cases/CreateActivity";
import { CompleteActivity } from "./application/use-cases/CompleteActivity";

export const activitiesModule = () => {
  const supabase = createClient();
  const repository = new SupabaseActivityRepository(supabase);

  return {
    createActivity: new CreateActivity(repository),
    completeActivity: new CompleteActivity(repository),
    // ... otros casos de uso se añadirán aquí
  };
};

export * from "./domain/entities/Activity";
export * from "./domain/enums/ActivityType";
