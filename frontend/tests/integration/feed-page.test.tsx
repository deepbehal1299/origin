import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FeedPage from "@/app/page";
import { fetchCoffees } from "@/lib/api";
import { getCompareIds } from "@/lib/storage";
import { TEST_COFFEES } from "@/tests/fixtures/coffees";

const mockUseSearchParams = vi.fn(() => new URLSearchParams("mock=1"));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
  usePathname: () => "/",
}));

vi.mock("@/lib/api", () => ({
  fetchCoffees: vi.fn(),
}));

describe("Feed page integration", () => {
  beforeEach(() => {
    vi.mocked(fetchCoffees).mockResolvedValue(TEST_COFFEES);
  });

  it("filters by selected roaster", async () => {
    const user = userEvent.setup();
    render(<FeedPage />);

    await screen.findByText("A");
    await user.selectOptions(screen.getByLabelText("Roaster"), "Subko");

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
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
});
