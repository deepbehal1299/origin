import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CoffeeCard } from "@/components/CoffeeCard";
import { TEST_COFFEES } from "@/tests/fixtures/coffees";

describe("CoffeeCard", () => {
  it("renders key coffee data and triggers actions", async () => {
    const user = userEvent.setup();
    const onToggleSave = vi.fn();
    const onAddCompare = vi.fn();
    const coffee = TEST_COFFEES[0];

    render(
      <CoffeeCard
        coffee={coffee}
        isSaved={false}
        isCompared={false}
        onToggleSave={onToggleSave}
        onAddCompare={onAddCompare}
      />
    );

    expect(screen.getByText(coffee.name)).toBeInTheDocument();
    expect(screen.getByText(coffee.roaster)).toBeInTheDocument();
    expect(screen.getByText(`INR ${coffee.price}`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onToggleSave).toHaveBeenCalledWith(coffee.id);

    await user.click(screen.getByRole("button", { name: "Compare" }));
    expect(onAddCompare).toHaveBeenCalledWith(coffee.id);

    expect(screen.getByRole("link", { name: "Buy" })).toHaveAttribute("href", coffee.product_url);
  });
});
