import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import cors from "cors";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import * as schema from "../db/schema.js";
import crypto from "node:crypto";
import { createMigratedTestDb } from "./helpers/testDb.js";

let server: Server;
let testDb: Awaited<ReturnType<typeof createMigratedTestDb>>["db"];
let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"];
let baseUrl = "";

async function seedCoffee(
  overrides: Partial<Record<string, unknown>> = {},
  available = true
) {
  const now = new Date().toISOString();
  await testDb
    .insert(schema.coffees)
    .values({
      id: crypto.randomUUID(),
      name: "Test Coffee",
      roaster: "Test Roaster",
      roasterId: "test-roaster",
      roastLevel: "Light",
      tastingNotes: "Citrus",
      description: "Desc",
      price: 500,
      weight: "250g",
      imageUrl: "https://example.com/img.jpg",
      productUrl: `https://example.com/products/${crypto.randomUUID()}`,
      available,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
}

async function seedAppStatus(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  await testDb.insert(schema.appStatus).values({
    id: "global",
    lastSuccessfulScrapeAt: now,
    lastRunFinishedAt: now,
    lastRunStatus: "success",
    roastersProcessed: 6,
    roastersFailed: 0,
    updatedAt: now,
    ...overrides,
  });
}

beforeAll(
  async () => {
    const migrated = await createMigratedTestDb();
    testDb = migrated.db;
    client = migrated.client;

    vi.doMock("../db/client.js", () => ({
      db: testDb,
      pool: {
        query: async () => ({ rows: [{ ok: 1 }] }),
        end: async () => undefined,
      },
    }));

    const { coffeesRouter } = await import("../api/routes/coffees.js");
    const app = express();
    app.use(cors({ origin: "http://localhost:3000", methods: ["GET"] }));
    app.use(coffeesRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  }
);

beforeEach(() => {
  return Promise.all([
    testDb.delete(schema.coffees),
    testDb.delete(schema.appStatus),
  ]);
});

afterAll(
  async () => {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
    await client.close();
    vi.doUnmock("../db/client.js");
  }
);

describe("GET /coffees API", () => {
  it("TC-API-01: returns 200 and a JSON array", async () => {
    const res = await fetch(`${baseUrl}/coffees`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("TC-API-05: returns empty array when no coffees exist", async () => {
    const res = await fetch(`${baseUrl}/coffees`);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("TC-API-02: response shape matches Coffee type", async () => {
    await seedCoffee();
    const res = await fetch(`${baseUrl}/coffees`);
    const body = await res.json();

    expect(body.length).toBeGreaterThanOrEqual(1);
    const coffee = body[0];

    const requiredKeys = [
      "id", "name", "roaster", "roaster_id", "roast_level",
      "tasting_notes", "description", "price", "weight",
      "image_url", "product_url", "available",
    ];
    for (const key of requiredKeys) {
      expect(coffee).toHaveProperty(key);
    }

    expect(typeof coffee.price).toBe("number");
    expect(typeof coffee.available).toBe("boolean");
    expect(typeof coffee.id).toBe("string");
  });

  it("TC-API-03: returns only available coffees", async () => {
    await seedCoffee({ name: "Available Coffee" }, true);
    await seedCoffee({ name: "Unavailable Coffee" }, false);

    const res = await fetch(`${baseUrl}/coffees`);
    const body = await res.json();

    const names = body.map((c: { name: string }) => c.name);
    expect(names).not.toContain("Unavailable Coffee");
  });

  it("TC-API-04: CORS allows frontend origin", async () => {
    const res = await fetch(`${baseUrl}/coffees`, {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000"
    );
  });

  it("nullable fields are null, not omitted", async () => {
    await seedCoffee({
      roastLevel: null,
      tastingNotes: null,
      description: null,
      weight: null,
      imageUrl: null,
    });

    const res = await fetch(`${baseUrl}/coffees`);
    const body = await res.json();
    const coffee = body.find(
      (c: { roast_level: unknown }) => c.roast_level === null
    );

    expect(coffee).toBeDefined();
    expect(coffee.roast_level).toBeNull();
    expect(coffee.tasting_notes).toBeNull();
    expect(coffee.description).toBeNull();
    expect(coffee.weight).toBeNull();
    expect(coffee.image_url).toBeNull();
  });

  it("returns default metadata when no scrape has succeeded yet", async () => {
    const res = await fetch(`${baseUrl}/meta`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      lastSuccessfulScrapeAt: null,
      lastRunFinishedAt: null,
      lastRunStatus: "never",
      roastersProcessed: 0,
      roastersFailed: 0,
    });
  });

  it("returns stored freshness metadata", async () => {
    await seedAppStatus({
      lastSuccessfulScrapeAt: "2026-03-12T10:00:00.000Z",
      lastRunFinishedAt: "2026-03-12T10:05:00.000Z",
      roastersProcessed: 6,
      roastersFailed: 1,
      lastRunStatus: "partial",
    });

    const res = await fetch(`${baseUrl}/meta`);
    const body = await res.json();

    expect(body.lastSuccessfulScrapeAt).toBe("2026-03-12T10:00:00.000Z");
    expect(body.lastRunFinishedAt).toBe("2026-03-12T10:05:00.000Z");
    expect(body.lastRunStatus).toBe("partial");
    expect(body.roastersProcessed).toBe(6);
    expect(body.roastersFailed).toBe(1);
  });
});
