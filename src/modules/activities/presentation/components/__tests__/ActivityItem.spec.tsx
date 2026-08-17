/**
 * Spec for the presentation ActivityItem (task 6.1).
 *
 * Asserted contract:
 * - When `onStatusChange` is provided, a status selector renders the three
 *   ActivityStatus options and reports changes as (id, status).
 * - The selector is additive: it does NOT render when `onStatusChange` is
 *   omitted (lead workspace timeline keeps its current UI).
 * - The timeline checkbox (complete toggle) moves through `moveStatus` — it
 *   never calls `repository.complete` anymore (BR-4 re-point).
 * - When `onStatusChange` IS provided, the checkbox delegates to it so the
 *   /activities page routes every transition through the server action.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ActivityItem } from "../ActivityItem";
import { Activity } from "../../../domain/entities/Activity";
import { ActivityType } from "../../../domain/enums/ActivityType";
import { ActivityStatus } from "../../../domain/enums/ActivityStatus";
import { renderWithProviders, createMockRepositories } from "@/lib/test-utils";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockGetById = jest.fn();
const mockMoveStatus = jest.fn();
const mockComplete = jest.fn();

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

function renderItem(
  activity: Activity,
  onStatusChange?: (id: string, status: ActivityStatus) => void
) {
  const repos = createMockRepositories();
  repos.activity = {
    ...repos.activity,
    getById: mockGetById,
    moveStatus: mockMoveStatus,
    complete: mockComplete,
  };
  return renderWithProviders(
    <ActivityItem activity={activity} onStatusChange={onStatusChange} />,
    { repos }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetById.mockResolvedValue({ id: "act-1" });
  mockMoveStatus.mockResolvedValue({ id: "act-1", status: ActivityStatus.COMPLETED });
  mockComplete.mockResolvedValue({ id: "act-1" });
});

describe("ActivityItem status selector (onStatusChange)", () => {
  it("renders a selector with the three statuses when onStatusChange is provided", () => {
    renderItem(createActivity(), jest.fn());

    const select = screen.getByLabelText("Estado");
    expect(select).toHaveValue(ActivityStatus.PENDING);
    expect(screen.getByRole("option", { name: "Pendiente" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "En Progreso" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Completada" })).toBeInTheDocument();
  });

  it("reports a selector change as onStatusChange(id, status)", () => {
    const onStatusChange = jest.fn();
    renderItem(createActivity(), onStatusChange);

    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: ActivityStatus.IN_PROGRESS },
    });

    expect(onStatusChange).toHaveBeenCalledWith("act-1", ActivityStatus.IN_PROGRESS);
  });

  it("does not render the selector when onStatusChange is omitted (additive)", () => {
    renderItem(createActivity());

    expect(screen.queryByLabelText("Estado")).not.toBeInTheDocument();
  });
});

describe("ActivityItem timeline toggle (BR-4)", () => {
  it("completes via moveStatus(id, COMPLETED) and never calls repository.complete", async () => {
    renderItem(createActivity());

    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() =>
      expect(mockMoveStatus).toHaveBeenCalledWith("act-1", ActivityStatus.COMPLETED)
    );
    expect(mockGetById).toHaveBeenCalledWith("act-1");
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("delegates the checkbox to onStatusChange when provided (server-action path)", () => {
    const onStatusChange = jest.fn();
    renderItem(createActivity(), onStatusChange);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onStatusChange).toHaveBeenCalledWith("act-1", ActivityStatus.COMPLETED);
    expect(mockMoveStatus).not.toHaveBeenCalled();
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
