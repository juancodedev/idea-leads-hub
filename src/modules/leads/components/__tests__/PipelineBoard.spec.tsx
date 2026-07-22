/**
 * Tests for PipelineBoard — LeadPopup wiring via onClick chain.
 *
 * Tests that:
 * - PipelineCard onClick fires when card wrapper is clicked
 * - PipelineColumn passes onCardClick through to PipelineCard
 * - PipelineBoard shows popup when card is clicked
 * - PipelineBoard hides popup when closed
 * - PipelineBoard updates store when LeadPopup calls onLeadUpdated
 * - PipelineBoard DnD still functions (drag handlers not broken by popup state)
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PipelineBoard } from "../PipelineBoard";
import { Lead } from "@/core/domain/Lead";
import { PipelineStage } from "@/core/domain/Pipeline";
import { useLeadsStore } from "../../store/useLeadsStore";

// ---------- Mock next/navigation ----------
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// ---------- Capture DndContext handlers ----------
const dndHandlers: Record<string, any> = {};

jest.mock("@dnd-kit/core", () => {
  const ReactFromMock = require("react");
  return {
    DndContext: (props: any) => {
      if (props.onDragStart) dndHandlers.onDragStart = props.onDragStart;
      if (props.onDragOver) dndHandlers.onDragOver = props.onDragOver;
      if (props.onDragEnd) dndHandlers.onDragEnd = props.onDragEnd;
      return ReactFromMock.createElement(
        ReactFromMock.Fragment,
        null,
        props.children
      );
    },
    DragOverlay: (props: any) =>
      ReactFromMock.createElement(ReactFromMock.Fragment, null, props.children),
    useDroppable: () => ({
      setNodeRef: jest.fn(),
      isOver: false,
      active: null,
    }),
    useSensor: (sensor: any, options?: any) => ({ sensor, options }),
    useSensors: (...sensors: any[]) => sensors,
    PointerSensor: class {
      static activators: any[] = [];
    },
    KeyboardSensor: class {},
    closestCorners: () => null,
    defaultDropAnimationSideEffects: () => ({}),
  };
});

jest.mock("@dnd-kit/sortable", () => {
  const ReactFromMock = require("react");
  return {
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: jest.fn(),
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
      transition: "0.25s",
      isDragging: false,
    }),
    SortableContext: ({ children }: any) =>
      ReactFromMock.createElement(ReactFromMock.Fragment, null, children),
    verticalListSortingStrategy: {},
    arrayMove: <T,>(arr: T[], from: number, to: number): T[] => {
      const result = [...arr];
      const [removed] = result.splice(from, 1);
      result.splice(to, 0, removed);
      return result;
    },
  };
});

jest.mock("@dnd-kit/utilities", () => ({
  CSS: { Translate: { toString: () => "translate(0px, 0px)" } },
}));

// ---------- Mock SupabaseLeadRepository ----------
jest.mock("@/infrastructure/repositories/SupabaseLeadRepository", () => ({
  SupabaseLeadRepository: jest.fn().mockImplementation(() => ({
    update: jest.fn(),
  })),
}));

// ---------- Mock database client ----------
jest.mock("@/infrastructure/database/client", () => ({
  createClient: jest.fn(() => ({})),
}));

// ---------- Mock sonner toast ----------
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------- Mock LeadPopup to verify wiring ----------
const mockOnLeadUpdated = jest.fn();
jest.mock("../LeadPopup", () => ({
  LeadPopup: jest.fn((props: any) => {
    // Store the onLeadUpdated callback so tests can trigger it
    if (props.onLeadUpdated) {
      mockOnLeadUpdated.mockImplementation(props.onLeadUpdated);
    }
    return props.open ? (
      <div data-testid="lead-popup">
        <span data-testid="popup-lead-id">{props.lead.id}</span>
        <span>{props.lead.name}</span>
        <button
          data-testid="popup-close"
          onClick={() => props.onOpenChange(false)}
        >
          Close
        </button>
        <button
          data-testid="popup-save"
          onClick={() =>
            props.onLeadUpdated?.({
              ...props.lead,
              company: "Updated Corp",
            })
          }
        >
          Save
        </button>
      </div>
    ) : null;
  }),
}));

// ---------- Factory ----------
const createLead = (overrides: Partial<Lead> = {}): Lead => ({
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
  ...overrides,
});

const createStage = (overrides: Partial<PipelineStage> = {}): PipelineStage => ({
  id: "stage-1",
  name: "Nuevo",
  pipelineId: "pipeline-1",
  userId: "user-1",
  position: 0,
  color: "#6b7280",
  isClosed: false,
  isWon: false,
  createdAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

// ---------- Suite ----------
describe("PipelineBoard — LeadPopup wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(dndHandlers).forEach((k) => delete dndHandlers[k]);
    useLeadsStore.setState({ leads: [], isLoading: false });
  });

  it("should open LeadPopup when a PipelineCard is clicked", () => {
    const lead = createLead();
    const stages = [createStage()];

    useLeadsStore.setState({ leads: [lead], isLoading: false });
    render(<PipelineBoard initialLeads={[lead]} stages={stages} />);

    // Click the card (find by lead name)
    const card = screen.getByText("Juan Pérez").closest("[data-testid]") || screen.getByText("Juan Pérez");
    // The card is wrapped in a div with the sortable ref. Use the lead name text
    fireEvent.click(screen.getByText("Juan Pérez"));

    // Popup should be visible with the lead's ID
    expect(screen.getByTestId("lead-popup")).toBeInTheDocument();
    expect(screen.getByTestId("popup-lead-id")).toHaveTextContent("lead-1");
  });

  it("should close popup when onOpenChange(false) is called", () => {
    const lead = createLead();
    const stages = [createStage()];

    useLeadsStore.setState({ leads: [lead], isLoading: false });
    render(<PipelineBoard initialLeads={[lead]} stages={stages} />);

    // Open popup by clicking the card
    fireEvent.click(screen.getByText("Juan Pérez"));
    expect(screen.getByTestId("lead-popup")).toBeInTheDocument();

    // Close popup
    fireEvent.click(screen.getByTestId("popup-close"));

    // Popup should be gone
    expect(screen.queryByTestId("lead-popup")).not.toBeInTheDocument();
  });

  it("should update store and close popup when LeadPopup saves", () => {
    const lead = createLead();
    const stages = [createStage()];

    useLeadsStore.setState({ leads: [lead], isLoading: false });
    render(<PipelineBoard initialLeads={[lead]} stages={stages} />);

    // Open popup
    fireEvent.click(screen.getByText("Juan Pérez"));
    expect(screen.getByTestId("lead-popup")).toBeInTheDocument();

    // Click save in popup — this triggers onLeadUpdated with updated company
    fireEvent.click(screen.getByTestId("popup-save"));

    // Store should have updated company
    const state = useLeadsStore.getState();
    const updatedLead = state.leads.find((l) => l.id === "lead-1");
    expect(updatedLead?.company).toBe("Updated Corp");

    // Popup should be closed after save
    expect(screen.queryByTestId("lead-popup")).not.toBeInTheDocument();
  });

  it("should not open popup when no card is clicked (initial render has no popup)", () => {
    const lead = createLead();
    const stages = [createStage()];

    useLeadsStore.setState({ leads: [lead], isLoading: false });
    render(<PipelineBoard initialLeads={[lead]} stages={stages} />);

    // No popup on initial render
    expect(screen.queryByTestId("lead-popup")).not.toBeInTheDocument();
  });

  it("should show popup for the correct lead when multiple cards exist", () => {
    const lead1 = createLead({ id: "lead-1", name: "Alice", company: "Alpha Inc" });
    const lead2 = createLead({ id: "lead-2", name: "Bob", company: "Beta LLC", stageId: "stage-2" });
    const stages = [createStage(), createStage({ id: "stage-2", name: "Contactado", position: 1 })];

    useLeadsStore.setState({ leads: [lead1, lead2], isLoading: false });
    render(<PipelineBoard initialLeads={[lead1, lead2]} stages={stages} />);

    // Click Bob's card
    fireEvent.click(screen.getByText("Bob"));

    // Popup should show Bob's info
    expect(screen.getByTestId("lead-popup")).toBeInTheDocument();
    expect(screen.getByTestId("popup-lead-id")).toHaveTextContent("lead-2");
  });

  it("should still fire DnD drag handlers after popup interaction", () => {
    const lead = createLead();
    const stages = [createStage()];

    useLeadsStore.setState({ leads: [lead], isLoading: false });
    render(<PipelineBoard initialLeads={[lead]} stages={stages} />);

    // Open then close popup
    fireEvent.click(screen.getByText("Juan Pérez"));
    expect(screen.getByTestId("lead-popup")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("popup-close"));
    expect(screen.queryByTestId("lead-popup")).not.toBeInTheDocument();

    // DnD handlers should still be registered
    expect(typeof dndHandlers.onDragStart).toBe("function");
    expect(typeof dndHandlers.onDragOver).toBe("function");
    expect(typeof dndHandlers.onDragEnd).toBe("function");
  });
});
