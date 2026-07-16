/**
 * Tests for ActivityItem component — including INSTAGRAM_MESSAGE type.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ActivityItem } from "../ActivityItem";
import { ActivityType } from "../../domain/enums/ActivityType";

describe("ActivityItem with INSTAGRAM_MESSAGE", () => {
  it("should render an activity with INSTAGRAM_MESSAGE type", () => {
    const activity = {
      id: "act-1",
      title: "Instagram DM",
      description: "Message from @john_doe",
      type: ActivityType.INSTAGRAM_MESSAGE,
      completed: false,
      leadId: "lead-1",
      userId: "user-1",
      ideaId: null,
      dueDate: null,
      completedAt: undefined,
      attachments: [],
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    };

    render(<ActivityItem activity={activity} onToggle={jest.fn()} />);

    expect(screen.getByText("Message from @john_doe")).toBeInTheDocument();
  });
});
