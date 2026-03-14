import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import type { ScrapedCoffee } from "../types.js";
import { createMigratedTestDb } from "./helpers/testDb.js";

function makeCoffee(overrides: Partial<ScrapedCoffee> = {}): ScrapedCoffee {
  return {
    name: "Test Coffee",
    roaster: "Test Roaster",
    roaster_id: "test-roaster",
    roast_level: "Light",
    tasting_notes: "Citrus, Honey",
    description: "A fine coffee",
    price: 500,
    weight: "250g",
    image_url: "https://example.com/img.jpg",
    product_url: "https://example.com/products/test-coffee",
    available: true,
    ...overrides,
  };
}

describe("upsertRoasterCoffees", () => {
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"];
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"];
  let upsertRoasterCoffees: typeof import("../db/upsert.js").upsertRoasterCoffees;

  beforeAll(async () => {
    const migrated = await createMigratedTestDb();
    db = migrated.db;
    client = migrated.client;
    vi.doMock("../db/client.js", () => ({
      db,
      pool: {
        query: async () => ({ rows: [{ ok: 1 }] }),
        end: async () => undefined,
      },
    }));
    ({ upsertRoasterCoffees } = await import("../db/upsert.js"));
  });

  beforeEach(() => {
    return db.delete(schema.coffees);
  });

  afterAll(async () => {
    await client.close();
    vi.doUnmock("../db/client.js");
  });

  it("TC-JOB-02: inserts new coffees", async () => {
    const coffee = makeCoffee();
    await upsertRoasterCoffees("test-roaster", [coffee]);

    const rows = await db.select().from(schema.coffees);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Test Coffee");
    expect(rows[0].price).toBe(500);
    expect(rows[0].available).toBe(true);
  });

  it("TC-JOB-02: updates existing coffee by (roaster_id, product_url)", async () => {
    const coffee = makeCoffee();
    await upsertRoasterCoffees("test-roaster", [coffee]);

    const updated = makeCoffee({ name: "Updated Coffee", price: 600 });
    await upsertRoasterCoffees("test-roaster", [updated]);

    const rows = await db.select().from(schema.coffees);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Updated Coffee");
    expect(rows[0].price).toBe(600);
  });

  it("TC-JOB-03: marks missing products as unavailable", async () => {
    const c1 = makeCoffee({ product_url: "https://example.com/products/c1" });
    const c2 = makeCoffee({ product_url: "https://example.com/products/c2" });
    await upsertRoasterCoffees("test-roaster", [c1, c2]);

    const onlyC1 = makeCoffee({ product_url: "https://example.com/products/c1" });
    await upsertRoasterCoffees("test-roaster", [onlyC1]);

    const rows = await db.select().from(schema.coffees);
    expect(rows.length).toBe(2);

    const available = rows.filter((r) => r.available === true);
    const unavailable = rows.filter((r) => r.available === false);
    expect(available.length).toBe(1);
    expect(available[0].productUrl).toBe("https://example.com/products/c1");
    expect(unavailable.length).toBe(1);
    expect(unavailable[0].productUrl).toBe("https://example.com/products/c2");
  });

  it("does not affect other roasters", async () => {
    const c1 = makeCoffee({
      roaster_id: "roaster-a",
      roaster: "Roaster A",
      product_url: "https://a.com/products/c1",
    });
    const c2 = makeCoffee({
      roaster_id: "roaster-b",
      roaster: "Roaster B",
      product_url: "https://b.com/products/c2",
    });

    await upsertRoasterCoffees("roaster-a", [c1]);
    await upsertRoasterCoffees("roaster-b", [c2]);

    await upsertRoasterCoffees("roaster-a", []);

    const rows = await db.select().from(schema.coffees);
    const roasterA = rows.filter((r) => r.roasterId === "roaster-a");
    const roasterB = rows.filter((r) => r.roasterId === "roaster-b");

    expect(roasterA[0].available).toBe(false);
    expect(roasterB[0].available).toBe(true);
  });

  it("re-marks previously unavailable coffee as available when re-scraped", async () => {
    const coffee = makeCoffee();
    await upsertRoasterCoffees("test-roaster", [coffee]);
    await upsertRoasterCoffees("test-roaster", []);

    let rows = await db.select().from(schema.coffees);
    expect(rows[0].available).toBe(false);

    await upsertRoasterCoffees("test-roaster", [coffee]);
    rows = await db.select().from(schema.coffees);
    expect(rows[0].available).toBe(true);
  });
});
