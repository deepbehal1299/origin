import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SettingsPage from "@/app/settings/page";
import { getRoastPreferences, getRoasterSettings } from "@/lib/storage";

function getRoasterCheckbox(roasterName: string): HTMLInputElement {
  const row = screen.getByText(roasterName).closest("li");
  if (!row) {
    throw new Error(`Could not find settings row for ${roasterName}`);
  }
  return within(row).getByRole("checkbox") as HTMLInputElement;
}

describe("Settings page integration", () => {
  it("renders all six configured roasters enabled by default", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("Subko")).toBeInTheDocument();
    expect(screen.getByText("Savorworks")).toBeInTheDocument();
    expect(screen.getByText("Bloom Coffee Roasters")).toBeInTheDocument();
    expect(screen.getByText("Rossette Coffee Lab")).toBeInTheDocument();
    expect(screen.getByText("Marcs Coffee")).toBeInTheDocument();
    expect(screen.getByText("Grey Soul Coffee")).toBeInTheDocument();

    expect(getRoasterCheckbox("Subko")).toBeChecked();
    expect(getRoasterCheckbox("Savorworks")).toBeChecked();
    expect(getRoasterCheckbox("Bloom Coffee Roasters")).toBeChecked();
    expect(getRoasterCheckbox("Rossette Coffee Lab")).toBeChecked();
    expect(getRoasterCheckbox("Marcs Coffee")).toBeChecked();
    expect(getRoasterCheckbox("Grey Soul Coffee")).toBeChecked();
  });

  it("persists roaster toggles to localStorage", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const savorworksCheckbox = getRoasterCheckbox("Savorworks");
    await user.click(savorworksCheckbox);

    expect(savorworksCheckbox).not.toBeChecked();
    expect(getRoasterSettings().Savorworks).toBe(false);
  });

  it("persists roast preferences to localStorage", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "Light" }));
    await user.click(screen.getByRole("button", { name: "Medium" }));

    expect(getRoastPreferences()).toEqual(["Light", "Medium"]);
  });
});
