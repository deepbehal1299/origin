import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FeedPage from "@/app/page";
import { fetchAppStatus, fetchCoffees } from "@/lib/api";
import { getCompareIds, setRoastPreferences, setRoasterEnabled } from "@/lib/storage";
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

describe("Feed page integration", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?mock=1");
    vi.mocked(fetchCoffees).mockResolvedValue(TEST_COFFEES);
    vi.mocked(fetchAppStatus).mockResolvedValue(DEFAULT_STATUS);
  });

  it("uses mock mode when mock query param is present", async () => {
    render(<FeedPage />);

    await screen.findByText("A");
    expect(vi.mocked(fetchCoffees)).toHaveBeenCalled();
    expect(vi.mocked(fetchCoffees).mock.calls[0]?.[0]?.mode).toBe("mock");
  });

  it("filters by selected roaster", async () => {
    const user = userEvent.setup();
    render(<FeedPage />);

    await screen.findByText("A");
    await user.selectOptions(screen.getByLabelText("Roaster"), "Subko");

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
  });

  it("respects disabled roasters from settings storage", async () => {
    setRoasterEnabled("Savorworks", false);

    render(<FeedPage />);

    await screen.findByText("A");
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
  });

  it("applies saved roast preferences on initial load", async () => {
    setRoastPreferences(["Light"]);

    render(<FeedPage />);

    await screen.findByText("A");
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
    expect(screen.queryByText("C")).not.toBeInTheDocument();
  });

  it("prevents adding more than 5 coffees to compare", async () => {
    const user = userEvent.setup();
    render(<FeedPage />);

    await screen.findByText("A");
    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getAllByRole("button", { name: "Compare" })[0]);
    }

    await user.click(screen.getByRole("button", { name: "Compare" }));

    expect(screen.getByText("You can compare up to 5 coffees.")).toBeInTheDocument();
    expect(getCompareIds()).toHaveLength(5);
  });

  it("shows an error state when the API request fails", async () => {
    window.history.replaceState({}, "", "/");
    vi.mocked(fetchCoffees).mockRejectedValue(new Error("boom"));

    render(<FeedPage />);

    expect(
      await screen.findByText(/Sorry, we couldn't refresh the coffee list right now/i)
    ).toBeInTheDocument();
    expect(vi.mocked(fetchCoffees)).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByText("Origin")).toBeInTheDocument();
  });

  it("renders last updated metadata when live mode is active", async () => {
    window.history.replaceState({}, "", "/");

    render(<FeedPage />);

    expect(await screen.findByText(/Last updated/i)).toBeInTheDocument();
  });

  it("retries twice before succeeding in live mode", async () => {
    window.history.replaceState({}, "", "/");
    vi.mocked(fetchCoffees)
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockResolvedValueOnce(TEST_COFFEES);

    render(<FeedPage />);

    expect(await screen.findByText("A")).toBeInTheDocument();
    expect(vi.mocked(fetchCoffees)).toHaveBeenCalledTimes(3);
  });

  it("shows backend-empty state when no coffees are returned", async () => {
    vi.mocked(fetchCoffees).mockResolvedValueOnce([]);

    render(<FeedPage />);

    expect(
      await screen.findByText(/No coffees are available right now\. Check back in a few hours\./i)
    ).toBeInTheDocument();
  });

  it("shows filtered-empty state when current filters hide all coffees", async () => {
    setRoasterEnabled("Subko", false);
    setRoasterEnabled("Savorworks", false);
    setRoasterEnabled("Bloom Coffee Roasters", false);
    setRoasterEnabled("Rossette Coffee Lab", false);
    setRoasterEnabled("Marcs Coffee", false);
    setRoasterEnabled("Grey Soul Coffee", false);

    render(<FeedPage />);

    expect(
      await screen.findByText(/No coffees match your current filters or enabled roasters\./i)
    ).toBeInTheDocument();
  });
});
