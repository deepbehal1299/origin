import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ComparePage from "@/app/compare/page";
import { fetchCoffees } from "@/lib/api";
import { getCompareIds, setCompareIds } from "@/lib/storage";
import { TEST_COFFEES } from "@/tests/fixtures/coffees";

vi.mock("@/lib/api", () => ({
  fetchCoffees: vi.fn(),
}));

describe("Compare page integration", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/compare?mock=1");
    setCompareIds(["c1", "c2"]);
    vi.mocked(fetchCoffees).mockResolvedValue(TEST_COFFEES);
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
});
