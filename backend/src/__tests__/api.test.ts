import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import cors from "cors";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import crypto from "node:crypto";

let server: Server;
let testDb: ReturnType<typeof drizzle>;
let sqlite: Database.Database;
let baseUrl = "";

function createTestDb() {
  const dbFile = new Database(":memory:");
  dbFile.exec(`
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
  return dbFile;
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
  async () => {
    sqlite = createTestDb();
    testDb = drizzle(sqlite, { schema });

    vi.doMock("../db/client.js", () => ({
      db: testDb,
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
  testDb.delete(schema.coffees).run();
});

afterAll(
  async () => {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
    sqlite.close();
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
    seedCoffee();
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
    seedCoffee({ name: "Available Coffee" }, true);
    seedCoffee({ name: "Unavailable Coffee" }, false);

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
    seedCoffee({
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
});
