import { describe, expect, it } from "vitest";
import {
  addCompareId,
  getCompareIds,
  getRoastPreferences,
  getRoasterSettings,
  setCompareIds,
  setRoastPreferences,
} from "@/lib/storage";

describe("storage helpers", () => {
  it("limits compare list to 5", () => {
    setCompareIds(["a", "b", "c", "d", "e"]);
    const result = addCompareId("f");
    expect(result.added).toBe(false);
    expect(result.reason).toBe("limit");
    expect(getCompareIds()).toHaveLength(5);
  });

  it("returns all roasters as enabled by default", () => {
    const roasterSettings = getRoasterSettings();
    Object.values(roasterSettings).forEach((value) => expect(value).toBe(true));
  });

  it("stores roast preferences with dedupe and valid values only", () => {
    setRoastPreferences(["Light", "Light", "Medium", "Dark"]);
    expect(getRoastPreferences()).toEqual(["Light", "Medium", "Dark"]);
  });
});
