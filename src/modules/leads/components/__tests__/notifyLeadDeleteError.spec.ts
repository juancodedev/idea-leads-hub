/**
 * Lead deletion feedback: a refused deletion (lead with Instagram
 * conversations) is a warning with the reason, never a silent or generic error.
 */
import { toast } from "sonner";
import { notifyLeadDeleteError } from "../notifyLeadDeleteError";
import { ConflictError, DatabaseError } from "@/infrastructure/repositories/errors";
import { LEAD_HAS_CONVERSATIONS_MESSAGE } from "@/infrastructure/repositories/SupabaseLeadRepository";

jest.mock("sonner", () => ({
  toast: { warning: jest.fn(), error: jest.fn() },
}));

describe("notifyLeadDeleteError", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows a warning with the reason when the lead still has conversations", () => {
    notifyLeadDeleteError(new ConflictError(LEAD_HAS_CONVERSATIONS_MESSAGE));

    expect(toast.warning).toHaveBeenCalledWith(LEAD_HAS_CONVERSATIONS_MESSAGE);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps the generic error for any other failure", () => {
    notifyLeadDeleteError(new DatabaseError("permission denied"));

    expect(toast.error).toHaveBeenCalledWith("Error al eliminar el lead");
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
