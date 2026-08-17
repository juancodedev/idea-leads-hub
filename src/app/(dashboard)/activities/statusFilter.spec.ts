/**
 * Spec for the /activities status → statusIn mapping (task 6.4).
 *
 * Contract (design Search contract table):
 *   no param           → [PENDING, IN_PROGRESS]   (default: status != COMPLETED)
 *   ?status=pending    → [PENDING]
 *   ?status=in_progress→ [IN_PROGRESS]
 *   ?status=completed  → [COMPLETED]
 *   ?status=all        → [PENDING, IN_PROGRESS, COMPLETED]
 *   Unknown values fall back to the default pending set (lenient).
 */

import { resolveStatusIn } from "./statusFilter";
import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";

describe("resolveStatusIn", () => {
  it("defaults to the pending set when the param is absent", () => {
    expect(resolveStatusIn(undefined)).toEqual([
      ActivityStatus.PENDING,
      ActivityStatus.IN_PROGRESS,
    ]);
    expect(resolveStatusIn("")).toEqual([
      ActivityStatus.PENDING,
      ActivityStatus.IN_PROGRESS,
    ]);
  });

  it("maps each documented param to its statusIn set", () => {
    expect(resolveStatusIn("pending")).toEqual([ActivityStatus.PENDING]);
    expect(resolveStatusIn("in_progress")).toEqual([ActivityStatus.IN_PROGRESS]);
    expect(resolveStatusIn("completed")).toEqual([ActivityStatus.COMPLETED]);
    expect(resolveStatusIn("all")).toEqual([
      ActivityStatus.PENDING,
      ActivityStatus.IN_PROGRESS,
      ActivityStatus.COMPLETED,
    ]);
  });

  it("falls back to the default pending set for unknown values", () => {
    expect(resolveStatusIn("weird")).toEqual([
      ActivityStatus.PENDING,
      ActivityStatus.IN_PROGRESS,
    ]);
  });
});