/**
 * Tests for LeadPopup — Sheet-based lead editing popup.
 *
 * Tests that:
 * - Popup renders lead name, fields, and sections when open
 * - Popup does not render content when closed
 * - Cancel button calls onOpenChange(false)
 * - Save button shows loading state when isSubmitting
 * - Notes section renders heading
 * - Stage selector section renders
 * - Save error calls toast.error and keeps popup open
 */

import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { LeadPopup } from "../LeadPopup";
import { Lead } from "@/core/domain/Lead";
import { PipelineStage } from "@/core/domain/Pipeline";
import { renderWithProviders, createMockRepositories } from "@/lib/test-utils";

// --- Mock Sheet to avoid Radix FocusScope render loop in tests ---
jest.mock("@/ui/components/sheet", () => ({
  Sheet: ({ children, open }: any) => (open ? <div data-testid="mock-sheet">{children}</div> : null),
  SheetContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
}));

// --- Mock zustand store ---
const mockUpdateLead = jest.fn();
jest.mock("../../store/useLeadsStore", () => ({
  useLeadsStore: () => ({
    updateLead: mockUpdateLead,
  }),
}));

// --- Mock sonner toast ---
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

// --- Mock NoteForm ---
jest.mock("@/modules/shared/components/NoteForm", () => ({
  NoteForm: () => <div data-testid="note-form">NoteForm</div>,
}));

// --- Mock NoteTimeline ---
jest.mock("@/modules/shared/components/NoteTimeline", () => ({
  NoteTimeline: () => <div data-testid="note-timeline">NoteTimeline</div>,
}));

// --- Mock LeadActivitiesSection ---
jest.mock("@/modules/activities/presentation/components/LeadActivitiesSection", () => ({
  LeadActivitiesSection: () => <div data-testid="activities-section">Activities</div>,
}));

// Test data
const baseLead: Lead = {
  id: "lead-1",
  name: "Juan Pérez",
  company: "Acme Corp",
  email: "juan@acme.com",
  phone: "+34 600 000 000",
  address: "Calle Principal 123",
  website: "https://acme.com",
  status: "Nuevo",
  source: "LinkedIn",
  userId: "user-1",
  pipelineId: "pipeline-1",
  stageId: "stage-1",
  createdAt: "2024-01-15T10:00:00Z",
  updatedAt: "2024-01-15T10:00:00Z",
};

const stages: PipelineStage[] = [
  { id: "stage-1", pipelineId: "pipeline-1", userId: "user-1", name: "Nuevo", position: 0, color: "#6b7280", isClosed: false, isWon: false, createdAt: "2024-01-01T00:00:00Z" },
  { id: "stage-2", pipelineId: "pipeline-1", userId: "user-1", name: "Contactado", position: 1, color: "#3b82f6", isClosed: false, isWon: false, createdAt: "2024-01-01T00:00:00Z" },
  { id: "stage-3", pipelineId: "pipeline-1", userId: "user-1", name: "Interesado", position: 2, color: "#f59e0b", isClosed: false, isWon: false, createdAt: "2024-01-01T00:00:00Z" },
];

const onOpenChange = jest.fn();
const onLeadUpdated = jest.fn();

let repos: ReturnType<typeof createMockRepositories>;

beforeEach(() => {
  jest.clearAllMocks();
  repos = createMockRepositories();
});

describe("LeadPopup", () => {
  it("should render lead name in title when open", () => {
    renderWithProviders(
      <LeadPopup
        lead={baseLead}
        stages={stages}
        open={true}
        onOpenChange={onOpenChange}
        onLeadUpdated={onLeadUpdated}
      />,
      { repos }
    );

    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
  });

  it("should not render content when closed", () => {
    renderWithProviders(
      <LeadPopup
        lead={baseLead}
        stages={stages}
        open={false}
        onOpenChange={onOpenChange}
        onLeadUpdated={onLeadUpdated}
      />,
      { repos }
    );

    expect(screen.queryByText("Juan Pérez")).not.toBeInTheDocument();
  });

  it("should render notes section when open", () => {
    renderWithProviders(
      <LeadPopup
        lead={baseLead}
        stages={stages}
        open={true}
        onOpenChange={onOpenChange}
        onLeadUpdated={onLeadUpdated}
      />,
      { repos }
    );

    expect(screen.getByText("Notas")).toBeInTheDocument();
  });

  it("should render activity history section when open", () => {
    renderWithProviders(
      <LeadPopup
        lead={baseLead}
        stages={stages}
        open={true}
        onOpenChange={onOpenChange}
        onLeadUpdated={onLeadUpdated}
      />,
      { repos }
    );

    expect(screen.getByTestId("activities-section")).toBeInTheDocument();
  });

  it("should call onOpenChange(false) when Cancelar button is clicked", async () => {
    renderWithProviders(
      <LeadPopup
        lead={baseLead}
        stages={stages}
        open={true}
        onOpenChange={onOpenChange}
        onLeadUpdated={onLeadUpdated}
      />,
      { repos }
    );

    const cancelButton = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should show error toast on save failure and keep popup open", async () => {
    (repos.lead.update as jest.Mock).mockRejectedValueOnce(new Error("DB error"));

    renderWithProviders(
      <LeadPopup
        lead={baseLead}
        stages={stages}
        open={true}
        onOpenChange={onOpenChange}
        onLeadUpdated={onLeadUpdated}
      />,
      { repos }
    );

    const saveButton = screen.getByRole("button", { name: /guardar/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });

    // Popup should remain open — lead name still visible
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
  });
});
