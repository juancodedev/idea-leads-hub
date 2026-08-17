/**
 * Spec for the (dashboard)/activities server actions (task 6.2 absorbed).
 *
 * Asserted contract: toggleActivityCompletion moves through the STATUS
 * surface (moveStatus) — complete → COMPLETED (stamps completed_at on the
 * repo side), un-complete → PENDING (clears completed_at) — nothing touches
 * a raw `completed` write anymore.
 */

jest.mock("@/infrastructure/database/server", () => ({
  createClient: jest.fn(),
}));

// The dashboard actions re-export changeActivityStatus from the infra
// actions, which imports next/cache (revalidatePath) — mock it to keep the
// spec focused on toggleActivityCompletion.
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const mockMoveStatus = jest.fn();

jest.mock(
  "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository",
  () => ({
    SupabaseActivityRepository: jest.fn().mockImplementation(() => ({
      moveStatus: mockMoveStatus,
    })),
  })
);

import { toggleActivityCompletion } from "./actions";
import { createClient } from "@/infrastructure/database/server";
import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";

const mockGetUser = jest.fn();
const fakeSupabase = { auth: { getUser: mockGetUser } };

beforeEach(() => {
  jest.clearAllMocks();
  (createClient as jest.Mock).mockResolvedValue(fakeSupabase);
});

describe("toggleActivityCompletion", () => {
  it("should complete via moveStatus(id, COMPLETED) — un-complete moves to PENDING", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    await toggleActivityCompletion("act-1", true);
    expect(mockMoveStatus).toHaveBeenCalledWith("act-1", ActivityStatus.COMPLETED);

    await toggleActivityCompletion("act-1", false);
    expect(mockMoveStatus).toHaveBeenCalledWith("act-1", ActivityStatus.PENDING);
  });

  it("should reject unauthenticated toggles", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(toggleActivityCompletion("act-1", true)).rejects.toThrow(
      "No autorizado"
    );
    expect(mockMoveStatus).not.toHaveBeenCalled();
  });
});