import React from "react";
import { render, screen } from "@testing-library/react";
import { CommandDialog } from "../command";

describe("CommandDialog", () => {
  it("should render an sr-only DialogTitle with 'Command Menu' text for a11y", () => {
    render(
      <CommandDialog open={true} onOpenChange={() => {}}>
        <div>Test content</div>
      </CommandDialog>
    );

    expect(screen.getByText("Command Menu")).toBeInTheDocument();
  });
});
