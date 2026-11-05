import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";

/**
 * Test double for the Supabase query builder. Every `from(table)` returns a
 * chainable builder that records each method call; awaiting a builder (or an
 * `rpc` call) resolves to the next queued response, in order.
 */
export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface RecordedQuery {
  table: string;
  calls: RecordedCall[];
}

export interface RecordedRpc {
  fn: string;
  args: unknown;
}

export interface MockResponse {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

const BUILDER_METHODS = [
  "select",
  "insert",
  "upsert",
  "update",
  "delete",
  "eq",
  "neq",
  "in",
  "is",
  "lt",
  "lte",
  "gt",
  "gte",
  "or",
  "order",
  "limit",
  "maybeSingle",
  "single",
] as const;

export function createSupabaseQueryMock() {
  const responses: MockResponse[] = [];
  const queries: RecordedQuery[] = [];
  const rpcs: RecordedRpc[] = [];

  const nextResponse = () => {
    const response = responses.shift() ?? {};
    return { data: response.data ?? null, error: response.error ?? null };
  };

  const builder = (table: string) => {
    const query: RecordedQuery = { table, calls: [] };
    queries.push(query);
    const chain: Record<string, unknown> = {};
    for (const method of BUILDER_METHODS) {
      chain[method] = (...args: unknown[]) => {
        query.calls.push({ method, args });
        return chain;
      };
    }
    chain.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve(nextResponse()).then(resolve, reject);
    return chain;
  };

  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args: unknown) => {
      rpcs.push({ fn, args });
      return Promise.resolve(nextResponse());
    },
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    queries,
    rpcs,
    /** Queues responses for the next awaited queries/rpcs, in order. */
    respond(...next: MockResponse[]) {
      responses.push(...next);
    },
    /** Calls of the n-th query, as [method, ...args] tuples. */
    callsOf(index: number): unknown[][] {
      return queries[index].calls.map((c) => [c.method, ...c.args]);
    },
  };
}
