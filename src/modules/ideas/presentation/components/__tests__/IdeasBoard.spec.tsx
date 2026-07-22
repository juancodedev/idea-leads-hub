/**
 * Tests for IdeasBoard — rendering, handleDragOver, handleDragEnd, error rollback.
 *
 * Tests that:
 * - All five columns render with correct idea counts
 * - handleDragOver updates store on cross-column drag and is no-op for same column
 * - handleDragEnd calls moveIdeaStatus.execute on cross-column drop
 * - handleDragEnd skips persistence on drop within same column
 * - Error rollback restores original state on API failure
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import { IdeasBoard } from "../IdeasBoard";
import { Idea } from "../../../domain/entities/Idea";
import { IdeaStatus, IdeaPriority } from "../../../domain/enums/IdeaEnums";
import { useIdeasStore } from "../../../store/useIdeasStore";

// Mock next/navigation to prevent useRouter invariant
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
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

jest.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
    transition: "0.25s",
    isDragging: false,
  }),
  SortableContext: ({ children }: any) =>
    React.createElement(React.Fragment, null, children),
  verticalListSortingStrategy: {},
  arrayMove: <T,>(arr: T[], from: number, to: number): T[] => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  },
}));

jest.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "translate(0px, 0px)" } },
}));

// Mock the idea module to prevent real Supabase calls
const mockMoveIdeaExecute = jest.fn();
jest.mock("../../../index", () => ({
  ideaModule: () => ({
    moveIdeaStatus: { execute: (...args: any[]) => mockMoveIdeaExecute(...args) },
    createIdea: { execute: jest.fn() },
    updateIdea: { execute: jest.fn() },
    getIdeas: { execute: jest.fn() },
    deleteIdea: { execute: jest.fn() },
  }),
}));

// ---------- Factory ----------
const createIdea = (overrides: Partial<Idea> = {}): Idea => ({
  id: "idea-1",
  title: "Default Idea",
  description: "A description",
  priority: IdeaPriority.MEDIUM,
  status: IdeaStatus.BACKLOG,
  createdBy: "user-1",
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  ...overrides,
});

// ---------- Helpers ----------
function buildDragStartEvent(ideaId: string) {
  return { active: { id: ideaId } };
}

function buildDragOverEvent(
  activeId: string,
  overId: string,
  overType: string = "Column",
  overStatus?: IdeaStatus
) {
  return {
    active: {
      id: activeId,
      data: { current: { type: "Idea" } },
    },
    over: {
      id: overId,
      data: {
        current:
          overType === "Column"
            ? { type: "Column", status: overStatus }
            : { type: "Idea" },
      },
    },
  };
}

function buildDragEndEvent(
  activeId: string,
  overId: string,
  overDataType: string,
  overStatus?: IdeaStatus
) {
  return {
    active: { id: activeId },
    over: {
      id: overId,
      data: {
        current:
          overDataType === "Column"
            ? { type: "Column", status: overStatus }
            : { type: "Idea", status: overStatus },
      },
    },
  };
}

// ---------- Suite ----------
describe("IdeasBoard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(dndHandlers).forEach((k) => delete dndHandlers[k]);
    useIdeasStore.setState({ ideas: [], isLoading: false, error: null });
  });

  it("should render all five columns with correct idea counts", () => {
    const ideas = [
      createIdea({ id: "i1", title: "Alpha", status: IdeaStatus.BACKLOG }),
      createIdea({ id: "i2", title: "Beta", status: IdeaStatus.BACKLOG }),
      createIdea({ id: "i3", title: "Gamma", status: IdeaStatus.IN_PROGRESS }),
    ];

    // IdeasBoard reads from the store, so pre-populate it
    useIdeasStore.setState({ ideas, isLoading: false, error: null });
    render(<IdeasBoard initialIdeas={ideas} />);

    // Column headings present (use getAllByText for column headers)
    const headers = screen.getAllByText((content, element) => {
      return element?.tagName === "H3" && ["Backlog", "Investigando", "Planificadas", "En Progreso", "Completadas"].includes(content);
    });
    expect(headers).toHaveLength(5);

    // Ideas in correct columns
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();

    // Check idea count badges: Backlog=2, En Progreso=1, rest=0
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  describe("handleDragOver", () => {
    it("should update store when dragging an Idea to a different column", () => {
      const idea = createIdea({
        id: "i1",
        title: "Draggable",
        status: IdeaStatus.BACKLOG,
      });

      useIdeasStore.setState({ ideas: [idea], isLoading: false, error: null });
      render(<IdeasBoard initialIdeas={[idea]} />);

      // Set activeIdea via drag start
      act(() => {
        dndHandlers.onDragStart(buildDragStartEvent("i1"));
      });

      // Drag over IN_PROGRESS column
      act(() => {
        dndHandlers.onDragOver(
          buildDragOverEvent("i1", IdeaStatus.IN_PROGRESS, "Column", IdeaStatus.IN_PROGRESS)
        );
      });

      // The idea should now have status IN_PROGRESS
      const state = useIdeasStore.getState();
      const movedIdea = state.ideas.find((i) => i.id === "i1");
      expect(movedIdea?.status).toBe(IdeaStatus.IN_PROGRESS);
    });

    it("should NOT update store when dragging to the same column", () => {
      const idea = createIdea({
        id: "i1",
        title: "Same Column",
        status: IdeaStatus.BACKLOG,
      });

      useIdeasStore.setState({ ideas: [idea], isLoading: false, error: null });
      render(<IdeasBoard initialIdeas={[idea]} />);

      act(() => {
        dndHandlers.onDragStart(buildDragStartEvent("i1"));
      });

      // Drag over BACKLOG column (same column)
      act(() => {
        dndHandlers.onDragOver(
          buildDragOverEvent("i1", IdeaStatus.BACKLOG, "Column", IdeaStatus.BACKLOG)
        );
      });

      // Status should remain BACKLOG
      const stateAfter = useIdeasStore.getState();
      const ideaAfter = stateAfter.ideas.find((i) => i.id === "i1");
      expect(ideaAfter?.status).toBe(IdeaStatus.BACKLOG);
    });
  });

  describe("handleDragEnd", () => {
    it("should call moveIdeaStatus.execute on cross-column drop", async () => {
      mockMoveIdeaExecute.mockResolvedValue({});

      const idea = createIdea({
        id: "i1",
        title: "Cross Drop",
        status: IdeaStatus.BACKLOG,
      });

      useIdeasStore.setState({ ideas: [idea], isLoading: false, error: null });
      render(<IdeasBoard initialIdeas={[idea]} />);

      act(() => {
        dndHandlers.onDragStart(buildDragStartEvent("i1"));
      });

      // First: drag over to set the visual state
      act(() => {
        dndHandlers.onDragOver(
          buildDragOverEvent("i1", IdeaStatus.IN_PROGRESS, "Column", IdeaStatus.IN_PROGRESS)
        );
      });

      // Then drop on the IN_PROGRESS column
      await act(async () => {
        await dndHandlers.onDragEnd(
          buildDragEndEvent("i1", IdeaStatus.IN_PROGRESS, "Column", IdeaStatus.IN_PROGRESS)
        );
      });

      expect(mockMoveIdeaExecute).toHaveBeenCalledWith("i1", IdeaStatus.IN_PROGRESS);
    });

    it("should call moveIdeaStatus.execute when dropping on a card in another column", async () => {
      mockMoveIdeaExecute.mockResolvedValue({});

      const idea1 = createIdea({
        id: "i1",
        title: "Moving Card",
        status: IdeaStatus.BACKLOG,
      });
      const idea2 = createIdea({
        id: "i2",
        title: "Target Card",
        status: IdeaStatus.IN_PROGRESS,
      });

      useIdeasStore.setState({ ideas: [idea1, idea2], isLoading: false, error: null });
      render(<IdeasBoard initialIdeas={[idea1, idea2]} />);

      act(() => {
        dndHandlers.onDragStart(buildDragStartEvent("i1"));
      });

      // Drop on a card that's in IN_PROGRESS
      await act(async () => {
        await dndHandlers.onDragEnd(
          buildDragEndEvent("i1", "i2", "Idea", IdeaStatus.IN_PROGRESS)
        );
      });

      expect(mockMoveIdeaExecute).toHaveBeenCalledWith("i1", IdeaStatus.IN_PROGRESS);
    });

    it("should NOT call moveIdeaStatus.execute when dropping on same status", async () => {
      const idea1 = createIdea({
        id: "i1",
        title: "No Move",
        status: IdeaStatus.BACKLOG,
      });
      const idea2 = createIdea({
        id: "i2",
        title: "Same Status Card",
        status: IdeaStatus.BACKLOG,
      });

      useIdeasStore.setState({ ideas: [idea1, idea2], isLoading: false, error: null });
      render(<IdeasBoard initialIdeas={[idea1, idea2]} />);

      act(() => {
        dndHandlers.onDragStart(buildDragStartEvent("i1"));
      });

      // Drop on a card with SAME status (BACKLOG)
      await act(async () => {
        await dndHandlers.onDragEnd(
          buildDragEndEvent("i1", "i2", "Idea", IdeaStatus.BACKLOG)
        );
      });

      expect(mockMoveIdeaExecute).not.toHaveBeenCalled();
    });

    it("should rollback to original status when moveIdeaStatus.execute throws", async () => {
      mockMoveIdeaExecute.mockRejectedValue(new Error("API Error"));

      const idea = createIdea({
        id: "i1",
        title: "Rollback",
        status: IdeaStatus.BACKLOG,
      });

      useIdeasStore.setState({ ideas: [idea], isLoading: false, error: null });
      render(<IdeasBoard initialIdeas={[idea]} />);

      act(() => {
        dndHandlers.onDragStart(buildDragStartEvent("i1"));
      });

      // Store the original idea state before optimistic update
      const originalIdea = { ...idea };

      // Move to IN_PROGRESS optimistically
      act(() => {
        dndHandlers.onDragOver(
          buildDragOverEvent("i1", IdeaStatus.IN_PROGRESS, "Column", IdeaStatus.IN_PROGRESS)
        );
      });

      // Verify optimistic update
      expect(
        useIdeasStore.getState().ideas.find((i) => i.id === "i1")?.status
      ).toBe(IdeaStatus.IN_PROGRESS);

      // Drop — this triggers the rollback on failure
      await act(async () => {
        await dndHandlers.onDragEnd(
          buildDragEndEvent("i1", IdeaStatus.IN_PROGRESS, "Column", IdeaStatus.IN_PROGRESS)
        );
      });

      // After failure, status should be restored to BACKLOG
      const state = useIdeasStore.getState();
      const rolledBack = state.ideas.find((i) => i.id === "i1");
      expect(rolledBack?.status).toBe(IdeaStatus.BACKLOG);
    });
  });
});
