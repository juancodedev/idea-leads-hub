/**
 * Tests for ActivityTypeIcon component — including INSTAGRAM_MESSAGE.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ActivityTypeIcon } from "../ActivityTypeIcon";
import { ActivityType } from "../../../domain/enums/ActivityType";

describe("ActivityTypeIcon", () => {
  it("should render an icon for INSTAGRAM_MESSAGE", () => {
    const { container } = render(
      <ActivityTypeIcon type={ActivityType.INSTAGRAM_MESSAGE} />
    );
    // Should render an SVG icon (lucide-react icons are SVGs)
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("should render an icon for CALL as before", () => {
    const { container } = render(<ActivityTypeIcon type={ActivityType.CALL} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("should accept className prop", () => {
    const { container } = render(
      <ActivityTypeIcon type={ActivityType.INSTAGRAM_MESSAGE} className="h-5 w-5" />
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
