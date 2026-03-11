import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FeedPage from "@/app/page";
import { fetchCoffees } from "@/lib/api";
import { getCompareIds, setRoastPreferences, setRoasterEnabled } from "@/lib/storage";
import { TEST_COFFEES } from "@/tests/fixtures/coffees";

vi.mock("@/lib/api", () => ({
  fetchCoffees: vi.fn(),
}));

describe("Feed page integration", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?mock=1");
    vi.mocked(fetchCoffees).mockResolvedValue(TEST_COFFEES);
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
    vi.mocked(fetchCoffees).mockRejectedValueOnce(new Error("boom"));

    render(<FeedPage />);

    expect(await screen.findByText(/Unable to load coffees right now/i)).toBeInTheDocument();
    expect(screen.getByText("Origin")).toBeInTheDocument();
  });
});
