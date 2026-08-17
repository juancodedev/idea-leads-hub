/**
 * Spec for the /activities list (task 6.3).
 *
 * Asserted contract (spec: "Inline list management (UI)"):
 * - The "Completadas" checkbox disappears in favor of a status filter
 *   select wired to the `status` URL param (pending|in_progress|completed|all;
 *   omitted = default pending set).
 * - Row status changes flow through onStatusChange → changeActivityStatus with
 *   an OPTIMISTIC update that reverts and toasts when the action errors.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ActivitiesList } from "./ActivitiesList";
import { Activity } from "@/modules/activities/domain/entities/Activity";
import { ActivityType } from "@/modules/activities/domain/enums/ActivityType";
import { ActivityStatus } from "@/modules/activities/domain/enums/ActivityStatus";
import { renderWithProviders } from "@/lib/test-utils";

const mockReplace = jest.fn();
let mockParams: URLSearchParams;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => mockParams,
}));

const mockChangeStatus = jest.fn();

jest.mock("./actions", () => ({
  changeActivityStatus: (...args: unknown[]) => mockChangeStatus(...args),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import { toast } from "sonner";

function createActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    title: "Llamar a Juan",
    description: "Seguimiento semanal",
    type: ActivityType.CALL,
    status: ActivityStatus.PENDING,
    completed: false,
    leadId: "lead-1",
    userId: "user-1",
    ideaId: null,
    dueDate: null,
    completedAt: undefined,
    readAt: null,
    attachments: [],
    createdAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-01T10:00:00Z"),
    ...overrides,
  };
}

function renderList(activities: Activity[], searchParams: Record<string, string> = {}) {
  mockParams = new URLSearchParams(searchParams);
  return renderWithProviders(
    <ActivitiesList activities={activities} searchParams={searchParams} />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = new URLSearchParams();
  mockChangeStatus.mockResolvedValue({ success: true, activity: undefined });
});

describe("ActivitiesList status filter (replaces Completadas)", () => {
  it("renders a status filter select without the legacy Completadas checkbox", () => {
    renderList([createActivity()]);

    const filter = screen.getByLabelText("Filtrar por estado");
    expect(filter).toHaveValue(""); // default = pending set
    expect(within(filter).getByRole("option", { name: "Pendientes y en progreso" })).toBeInTheDocument();
    expect(within(filter).getByRole("option", { name: "Pendiente" })).toBeInTheDocument();
    expect(within(filter).getByRole("option", { name: "En progreso" })).toBeInTheDocument();
    expect(within(filter).getByRole("option", { name: "Completadas" })).toBeInTheDocument();
    expect(within(filter).getByRole("option", { name: "Todas" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Completadas")).not.toBeInTheDocument();
  });

  it("writes the status URL param on filter change, preserving other params", () => {
    renderList([createActivity()], { q: "juan" });

    fireEvent.change(screen.getByLabelText("Filtrar por estado"), {
      target: { value: "in_progress" },
    });

    expect(mockReplace).toHaveBeenCalledWith("/activities?q=juan&status=in_progress", {
      scroll: false,
    });
  });

  it("preselects the filter from the status URL param", () => {
    renderList([createActivity()], { status: "completed" });

    expect(screen.getByLabelText("Filtrar por estado")).toHaveValue("completed");
  });
});

describe("ActivitiesList optimistic status change", () => {
  it("updates the row optimistically and calls changeActivityStatus(id, status)", async () => {
    const activity = createActivity();
    renderList([activity]);

    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: ActivityStatus.IN_PROGRESS },
    });

    // Optimistic: the row reflects the new status before the action settles.
    expect(screen.getByLabelText("Estado")).toHaveValue(ActivityStatus.IN_PROGRESS);

    await waitFor(() =>
      expect(mockChangeStatus).toHaveBeenCalledWith("act-1", ActivityStatus.IN_PROGRESS)
    );
  });

  it("reverts the row and toasts when the action reports an error", async () => {
    mockChangeStatus.mockResolvedValue({ error: "Actividad no encontrada" });
    renderList([createActivity()]);

    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: ActivityStatus.COMPLETED },
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Actividad no encontrada"));
    expect(screen.getByLabelText("Estado")).toHaveValue(ActivityStatus.PENDING);
  });

  it("reverts the row and toasts when the action throws", async () => {
    mockChangeStatus.mockRejectedValue(new Error("Network error"));
    renderList([createActivity()]);

    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: ActivityStatus.COMPLETED },
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/estado/i))
    );
    expect(screen.getByLabelText("Estado")).toHaveValue(ActivityStatus.PENDING);
  });
});