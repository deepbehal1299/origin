import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ComparePage from "@/app/compare/page";
import { fetchAppStatus, fetchCoffees } from "@/lib/api";
import { getCompareIds, setCompareIds } from "@/lib/storage";
import { AppStatus } from "@/lib/types";
import { TEST_COFFEES } from "@/tests/fixtures/coffees";

vi.mock("@/lib/api", () => ({
  fetchCoffees: vi.fn(),
  fetchAppStatus: vi.fn(),
}));

const DEFAULT_STATUS: AppStatus = {
  lastSuccessfulScrapeAt: "2026-03-12T06:00:00.000Z",
  lastRunFinishedAt: "2026-03-12T06:00:00.000Z",
  lastRunStatus: "success",
  roastersProcessed: 6,
  roastersFailed: 0,
};

describe("Compare page integration", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/compare?mock=1");
    setCompareIds(["c1", "c2"]);
    vi.mocked(fetchCoffees).mockResolvedValue(TEST_COFFEES);
    vi.mocked(fetchAppStatus).mockResolvedValue(DEFAULT_STATUS);
  });

  it("renders compare rows from localStorage ids", async () => {
    render(<ComparePage />);

    await screen.findByText("A");
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Buy" })).toHaveLength(2);
  });

  it("removes coffee from compare and updates storage", async () => {
    const user = userEvent.setup();
    render(<ComparePage />);

    await screen.findByText("A");
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    expect(getCompareIds()).toEqual(["c2"]);
  });

  it("shows last updated metadata in live mode", async () => {
    window.history.replaceState({}, "", "/compare");

    render(<ComparePage />);

    expect(await screen.findByText(/Last updated/i)).toBeInTheDocument();
  });

  it("shows a retry state when compare data cannot be refreshed", async () => {
    vi.mocked(fetchCoffees).mockRejectedValue(new Error("boom"));

    render(<ComparePage />);

    expect(
      await screen.findByText(/Sorry, we couldn't refresh compare right now/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
