import type { Pipeline } from '@/core/domain/Pipeline';

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