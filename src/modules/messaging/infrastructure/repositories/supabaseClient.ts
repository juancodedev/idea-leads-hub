import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { DatabaseError } from "@/infrastructure/repositories/errors";

/**
 * The hand-maintained `Database` type predates supabase-js's generic schema
 * shape (no Views/Functions/Relationships), so typed `from()` resolves rows to
 * `never`. Messaging adapters query through the schema-less client and type
 * rows with the `Database` Row types in their mappers instead; nothing untyped
 * leaves this layer.
 */
export function schemaless(client: SupabaseClient<Database>): SupabaseClient {
  return client as unknown as SupabaseClient;
}

export function raise(context: string, error: { message: string }): never {
  throw new DatabaseError(`${context}: ${error.message}`);
}
