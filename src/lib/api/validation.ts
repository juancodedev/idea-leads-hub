import type { ZodError } from 'zod';

/**
 * Field-keyed validation messages for API clients:
 * `{ "rating": "Expected number" }`.
 *
 * The first message per field wins, so a field with several problems shows the
 * most specific one Zod reported first.
 */
export function fieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in fields)) fields[key] = issue.message;
  }

  return fields;
}
