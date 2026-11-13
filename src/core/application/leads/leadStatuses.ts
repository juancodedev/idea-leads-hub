import { ZodError } from 'zod';
import type { Pipeline, PipelineStage } from '@/core/domain/Pipeline';

/** One valid lead status, as the integration consumes it. */
export interface LeadStatusOption {
  /** What goes in `lead.status`. */
  value: string;
  /** Human readable label, for the client to show. */
  label: string;
  /** True when reaching this status means "stop writing to this lead". */
  doNotContact: boolean;
}

/**
 * Flattens every pipeline's stages into the status catalog.
 *
 * Stages are the source of truth for valid statuses, so the catalog follows the
 * user's own configuration instead of a hardcoded list. The same name in two
 * pipelines collapses into one entry, flagged when any of them is.
 */
export function buildStatusCatalog(pipelines: Pipeline[]): LeadStatusOption[] {
  const byValue = new Map<string, LeadStatusOption>();

  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages ?? []) {
      const existing = byValue.get(stage.name);
      if (existing) {
        existing.doNotContact = existing.doNotContact || Boolean(stage.isDoNotContact);
        continue;
      }

      byValue.set(stage.name, {
        value: stage.name,
        label: stage.name,
        doNotContact: Boolean(stage.isDoNotContact),
      });
    }
  }

  return [...byValue.values()];
}

/** The pipeline reads the status check needs. */
export interface StatusCatalogSource {
  getAll(): Promise<Pipeline[]>;
  getStages(pipelineId: string): Promise<PipelineStage[]>;
}

/**
 * Rejects a `status` that is not a stage name, so every endpoint that writes
 * `status` enforces the same rule.
 *
 * With a pipeline, only that pipeline's stages are valid; without one, the
 * whole catalog (what `GET /api/leads/statuses` publishes) is. A user with no
 * stages at all has no catalog to enforce, so anything is accepted.
 *
 * Throws a ZodError on `status`, which the API answers as 400 with
 * `fields.status`.
 */
export async function assertKnownStatus(
  status: string,
  source: StatusCatalogSource,
  pipelineId?: string | null
): Promise<void> {
  const validNames = pipelineId
    ? (await source.getStages(pipelineId)).map((stage) => stage.name)
    : buildStatusCatalog(await source.getAll()).map((option) => option.value);

  if (validNames.length === 0 || validNames.includes(status)) return;

  throw new ZodError([
    {
      code: 'invalid_enum_value',
      path: ['status'],
      message: `Estado inválido. Los valores válidos son: ${validNames.join(', ')}`,
      received: status,
      options: validNames,
    },
  ]);
}
