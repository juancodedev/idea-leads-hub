/**
 * Spec for the /activities page wiring (task 6.4 review-fix).
 *
 * Asserted contract: the page passes `statusIn` through from resolveStatusIn,
 * so an ABSENT `?status=` param yields `statusIn: undefined` — the repository
 * default branch (`status.in.(PENDING,IN_PROGRESS),status.is.null`) then
 * keeps legacy NULL-status rows visible during the rollout window. Explicit
 * `?status=` params map to their statusIn set instead.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import ActivitiesPage from "./page";

// ---------- Mocks ----------

const mockSearch = jest.fn();

jest.mock("@/infrastructure/database/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        getUser: jest.fn(() =>
          Promise.resolve({ data: { user: { id: "user-1" } }, error: null })
        ),
      },
    })
  ),
}));

jest.mock(
  "@/modules/activities/infrastructure/repositories/SupabaseActivityRepository",
  () => ({
    SupabaseActivityRepository: jest.fn().mockImplementation(() => ({
      search: mockSearch,
    })),
  })
);

jest.mock("@/ui/layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("@/ui/components/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("./ActivitiesList", () => ({
  ActivitiesList: () => <div data-testid="activities-list" />,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch.mockResolvedValue({ data: [], total: 0 });
});

describe("ActivitiesPage status wiring (review-fix: NULL-status rows in default view)", () => {
  it("omits statusIn (undefined) when ?status= is absent so the repository NULL-tolerant OR branch runs", async () => {
    const page = await ActivitiesPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ statusIn: undefined })
    );
    expect(screen.getByTestId("activities-list")).toBeInTheDocument();
  });

  it("passes the explicit statusIn set when ?status=pending is present", async () => {
    const page = await ActivitiesPage({
      searchParams: Promise.resolve({ status: "pending" }),
    });

    render(page);

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        statusIn: ["PENDING"],
      })
    );
  });
});