import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import cors from "cors";
import type { Server } from "node:http";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";

let server: Server;
let testDb: ReturnType<typeof drizzle>;
const TEST_PORT = 14321;

function setupTestApp() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE coffees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      roaster TEXT NOT NULL,
      roaster_id TEXT NOT NULL,
      roast_level TEXT,
      tasting_notes TEXT,
      description TEXT,
      price REAL NOT NULL,
      weight TEXT,
      image_url TEXT,
      product_url TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  testDb = drizzle(sqlite, { schema });

  const app = express();
  app.use(cors({ origin: "http://localhost:3000", methods: ["GET"] }));

  app.get("/coffees", (_req, res) => {
    const rows = testDb
      .select()
      .from(schema.coffees)
      .where(eq(schema.coffees.available, true))
      .all();

    const response = rows.map((row) => ({
      id: row.id,
      name: row.name,
      roaster: row.roaster,
      roaster_id: row.roasterId,
      roast_level: row.roastLevel ?? null,
      tasting_notes: row.tastingNotes ?? null,
      description: row.description ?? null,
      price: row.price,
      weight: row.weight ?? null,
      image_url: row.imageUrl ?? null,
      product_url: row.productUrl,
      available: !!row.available,
    }));

    res.json(response);
  });

  return app;
}

function seedCoffee(
  overrides: Partial<Record<string, unknown>> = {},
  available = true
) {
  const now = new Date().toISOString();
  testDb
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
    })
    .run();
}

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      const app = setupTestApp();
      server = app.listen(TEST_PORT, resolve);
    })
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server?.close(() => resolve());
    })
);

describe("GET /coffees API", () => {
  it("TC-API-01: returns 200 and a JSON array", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/coffees`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("TC-API-05: returns empty array when no coffees exist", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/coffees`);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("TC-API-02: response shape matches Coffee type", async () => {
    seedCoffee();
    const res = await fetch(`http://localhost:${TEST_PORT}/coffees`);
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
    seedCoffee({ name: "Available Coffee" }, true);
    seedCoffee({ name: "Unavailable Coffee" }, false);

    const res = await fetch(`http://localhost:${TEST_PORT}/coffees`);
    const body = await res.json();

    const names = body.map((c: { name: string }) => c.name);
    expect(names).not.toContain("Unavailable Coffee");
  });

  it("TC-API-04: CORS allows frontend origin", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/coffees`, {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000"
    );
  });

  it("nullable fields are null, not omitted", async () => {
    seedCoffee({
      roastLevel: null,
      tastingNotes: null,
      description: null,
      weight: null,
      imageUrl: null,
    });

    const res = await fetch(`http://localhost:${TEST_PORT}/coffees`);
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
});
