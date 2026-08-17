import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddActivityForm } from "../AddActivityForm";
import {
  createActivityAction,
  updateActivityAction,
} from "@/modules/activities/infrastructure/actions/activityActions";
import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";

jest.mock("@/modules/activities/infrastructure/actions/activityActions", () => ({
  createActivityAction: jest.fn(),
  updateActivityAction: jest.fn(),
}));

const mockCreate = createActivityAction as jest.Mock;
const mockUpdate = updateActivityAction as jest.Mock;

describe("AddActivityForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ success: true, activity: {} });
    mockUpdate.mockResolvedValue({ success: true, activity: {} });
  });

  it("saves new activities normalized to status COMPLETED (task 6.5)", async () => {
    render(<AddActivityForm ideaId="idea-1" />);

    fireEvent.click(screen.getByText(/Añadir un comentario o registro de actividad/));
    fireEvent.change(
      screen.getByPlaceholderText(/¿Qué has realizado/),
      { target: { value: "Revisé el pipeline de ventas" } }
    );
    fireEvent.click(screen.getByRole("button", { name: /Guardar Actividad/ }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          ideaId: "idea-1",
          status: ActivityStatus.COMPLETED,
        })
      );
    });

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg).not.toHaveProperty("completed");
  });

  it("sends edits through updateActivityAction without status normalization", async () => {
    const activity = {
      id: "a1",
      type: ActivityType.NOTE,
      description: "descripción previa",
      attachments: [],
    } as any;

    render(<AddActivityForm ideaId="idea-1" activity={activity} />);

    fireEvent.change(
      screen.getByPlaceholderText(/¿Qué has realizado/),
      { target: { value: "nueva descripción" } }
    );
    fireEvent.click(screen.getByRole("button", { name: /Guardar Actividad/ }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "a1", description: "nueva descripción" })
      );
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});