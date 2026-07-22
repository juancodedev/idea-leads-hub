/**
 * Tests for IdeaCard — useSortable integration.
 *
 * Tests that:
 * - useSortable is called with correct id and data.type === 'Idea'
 * - Idea title renders when not dragging
 * - Placeholder (border-dashed) renders during drag
 * - Overlay styling (data-state="overlay") when isOverlay prop is true
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { IdeaCard } from "../IdeaCard";
import { Idea } from "../../../domain/entities/Idea";
import { IdeaStatus, IdeaPriority } from "../../../domain/enums/IdeaEnums";

const mockUseSortable = jest.fn();

jest.mock("@dnd-kit/sortable", () => ({
  useSortable: (...args: any[]) => mockUseSortable(...args),
}));

jest.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => "translate(0px, 0px)",
    },
  },
}));

const baseIdea: Idea = {
  id: "idea-1",
  title: "Test Idea Title",
  description: "A test description for the idea card",
  priority: IdeaPriority.HIGH,
  status: IdeaStatus.BACKLOG,
  createdBy: "user-1",
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
};

const sortableDefaults = {
  attributes: {},
  listeners: {},
  setNodeRef: jest.fn(),
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
  transition: "0.25s",
  isDragging: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSortable.mockReturnValue(sortableDefaults);
});

describe("IdeaCard", () => {
  it("should call useSortable with idea id and data.type 'Idea'", () => {
    render(<IdeaCard idea={baseIdea} />);

    expect(mockUseSortable).toHaveBeenCalledWith({
      id: "idea-1",
      data: {
        type: "Idea",
        idea: baseIdea,
      },
    });
  });

  it("should render the idea title and description when not dragging", () => {
    render(<IdeaCard idea={baseIdea} />);

    expect(screen.getByText("Test Idea Title")).toBeInTheDocument();
    expect(
      screen.getByText("A test description for the idea card")
    ).toBeInTheDocument();
  });

  it("should render a dashed-border placeholder when isDragging and not isOverlay", () => {
    mockUseSortable.mockReturnValue({
      ...sortableDefaults,
      isDragging: true,
    });

    const { container } = render(<IdeaCard idea={baseIdea} />);

    // Card content should NOT be visible
    expect(screen.queryByText("Test Idea Title")).not.toBeInTheDocument();

    // Placeholder div with dashed border should be rendered
    const placeholder = container.querySelector(".border-dashed");
    expect(placeholder).toBeInTheDocument();
  });

  it("should render with overlay data-state when isOverlay prop is true", () => {
    render(<IdeaCard idea={baseIdea} isOverlay />);

    // Card content should still render
    expect(screen.getByText("Test Idea Title")).toBeInTheDocument();

    // The wrapper div should have data-state="overlay"
    const wrapper = screen.getByTestId("idea-card-wrapper");
    expect(wrapper).toHaveAttribute("data-state", "overlay");
  });

  it("should render with idle data-state when not dragging and not overlay", () => {
    render(<IdeaCard idea={baseIdea} />);

    const wrapper = screen.getByTestId("idea-card-wrapper");
    expect(wrapper).toHaveAttribute("data-state", "idle");
  });

  it("should render with dragging data-state when isDragging and not overlay", () => {
    mockUseSortable.mockReturnValue({
      ...sortableDefaults,
      isDragging: true,
    });

    const { container } = render(<IdeaCard idea={baseIdea} />);

    // When dragging and not overlay, the placeholder div should have data-state="dragging"
    const placeholder = container.querySelector('[data-state="dragging"]');
    expect(placeholder).toBeInTheDocument();
  });
});
