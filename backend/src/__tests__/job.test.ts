import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RoasterConfig } from "../types.js";

describe("Daily Job configuration", () => {
  it("TC-JOB-01: roasters.json has all configured roasters", () => {
    const configPath = resolve("config", "roasters.json");
    const raw = readFileSync(configPath, "utf-8");
    const roasters: RoasterConfig[] = JSON.parse(raw);

    expect(roasters.length).toBeGreaterThanOrEqual(1);
    for (const r of roasters) {
      expect(r.id).toBeTruthy();
      expect(r.name).toBeTruthy();
      expect(r.url).toMatch(/^https?:\/\//);
      expect(["shopify", "html"]).toContain(r.type);
    }
  });

  it("TC-JOB-01: config includes all 6 expected roasters", () => {
    const configPath = resolve("config", "roasters.json");
    const roasters: RoasterConfig[] = JSON.parse(
      readFileSync(configPath, "utf-8")
    );

    const ids = roasters.map((r) => r.id);
    expect(ids).toContain("subko");
    expect(ids).toContain("savorworks");
    expect(ids).toContain("bloom-coffee-roasters");
    expect(ids).toContain("rossette-coffee-lab");
    expect(ids).toContain("marcs-coffee");
    expect(ids).toContain("grey-soul-coffee");
  });

  it("TC-JOB-04: cron expression matches 06:00 IST", async () => {
    const indexSource = readFileSync(resolve("src", "index.ts"), "utf-8");

    expect(indexSource).toContain('"0 6 * * *"');
    expect(indexSource).toContain("Asia/Kolkata");
  });
});
