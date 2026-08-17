/**
 * Spec for the /activities status → statusIn mapping (task 6.4, post-review
 * fix: NULL-status rows must survive the default view).
 *
 * Contract (design Search contract table, review-fix):
 *   no param / empty  → undefined    (statusIn omitted → repository NULL-
 *                                     tolerant OR branch
 *                                     `status.in.(PENDING,IN_PROGRESS),status.is.null`
 *                                     keeps legacy NULL-status rows visible)
 *   ?status=pending    → [PENDING]
 *   ?status=in_progress→ [IN_PROGRESS]
 *   ?status=completed  → [COMPLETED]
 *   ?status=all        → [PENDING, IN_PROGRESS, COMPLETED]
 *   Unknown values     → undefined (lenient: same repository default OR
 *                                     branch as an absent param)
 */

import { resolveStatusIn } from "./statusFilter";
import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";

describe("resolveStatusIn", () => {
  it("returns undefined when the param is absent or empty (repository OR branch keeps NULL-status rows)", () => {
    expect(resolveStatusIn(undefined)).toBeUndefined();
    expect(resolveStatusIn("")).toBeUndefined();
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

  it("returns undefined for unknown values (same default OR branch as an absent param)", () => {
    expect(resolveStatusIn("weird")).toBeUndefined();
  });
});