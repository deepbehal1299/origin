import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and } from "drizzle-orm";
import * as schema from "../db/schema.js";
import type { ScrapedCoffee } from "../types.js";
import crypto from "node:crypto";

function createTestDb() {
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
    CREATE UNIQUE INDEX coffees_roaster_product_unique ON coffees(roaster_id, product_url);
  `);
  return drizzle(sqlite, { schema });
}

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
    ...overrides,
  };
}

async function upsertRoasterCoffees(
  db: ReturnType<typeof createTestDb>,
  roasterId: string,
  scraped: ScrapedCoffee[]
) {
  const { coffees } = schema;
  const now = new Date().toISOString();
  const scrapedUrls: string[] = [];

  for (const coffee of scraped) {
    scrapedUrls.push(coffee.product_url);

    const existing = db
      .select({ id: coffees.id })
      .from(coffees)
      .where(
        and(
          eq(coffees.roasterId, roasterId),
          eq(coffees.productUrl, coffee.product_url)
        )
      )
      .get();

    if (existing) {
      db.update(coffees)
        .set({
          name: coffee.name,
          roaster: coffee.roaster,
          roastLevel: coffee.roast_level,
          tastingNotes: coffee.tasting_notes,
          description: coffee.description,
          price: coffee.price,
          weight: coffee.weight,
          imageUrl: coffee.image_url,
          available: true,
          updatedAt: now,
        })
        .where(eq(coffees.id, existing.id))
        .run();
    } else {
      db.insert(coffees)
        .values({
          id: crypto.randomUUID(),
          name: coffee.name,
          roaster: coffee.roaster,
          roasterId: coffee.roaster_id,
          roastLevel: coffee.roast_level,
          tastingNotes: coffee.tasting_notes,
          description: coffee.description,
          price: coffee.price,
          weight: coffee.weight,
          imageUrl: coffee.image_url,
          productUrl: coffee.product_url,
          available: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }

  if (scrapedUrls.length > 0) {
    const { notInArray } = await import("drizzle-orm");
    db.update(coffees)
      .set({ available: false, updatedAt: now })
      .where(
        and(
          eq(coffees.roasterId, roasterId),
          notInArray(coffees.productUrl, scrapedUrls)
        )
      )
      .run();
  } else {
    db.update(coffees)
      .set({ available: false, updatedAt: now })
      .where(eq(coffees.roasterId, roasterId))
      .run();
  }
}

describe("upsertRoasterCoffees", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it("TC-JOB-02: inserts new coffees", async () => {
    const coffee = makeCoffee();
    await upsertRoasterCoffees(db, "test-roaster", [coffee]);

    const rows = db.select().from(schema.coffees).all();
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Test Coffee");
    expect(rows[0].price).toBe(500);
    expect(rows[0].available).toBe(true);
  });

  it("TC-JOB-02: updates existing coffee by (roaster_id, product_url)", async () => {
    const coffee = makeCoffee();
    await upsertRoasterCoffees(db, "test-roaster", [coffee]);

    const updated = makeCoffee({ name: "Updated Coffee", price: 600 });
    await upsertRoasterCoffees(db, "test-roaster", [updated]);

    const rows = db.select().from(schema.coffees).all();
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Updated Coffee");
    expect(rows[0].price).toBe(600);
  });

  it("TC-JOB-03: marks missing products as unavailable", async () => {
    const c1 = makeCoffee({ product_url: "https://example.com/products/c1" });
    const c2 = makeCoffee({ product_url: "https://example.com/products/c2" });
    await upsertRoasterCoffees(db, "test-roaster", [c1, c2]);

    const onlyC1 = makeCoffee({ product_url: "https://example.com/products/c1" });
    await upsertRoasterCoffees(db, "test-roaster", [onlyC1]);

    const rows = db.select().from(schema.coffees).all();
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

    await upsertRoasterCoffees(db, "roaster-a", [c1]);
    await upsertRoasterCoffees(db, "roaster-b", [c2]);

    await upsertRoasterCoffees(db, "roaster-a", []);

    const rows = db.select().from(schema.coffees).all();
    const roasterA = rows.filter((r) => r.roasterId === "roaster-a");
    const roasterB = rows.filter((r) => r.roasterId === "roaster-b");

    expect(roasterA[0].available).toBe(false);
    expect(roasterB[0].available).toBe(true);
  });

  it("re-marks previously unavailable coffee as available when re-scraped", async () => {
    const coffee = makeCoffee();
    await upsertRoasterCoffees(db, "test-roaster", [coffee]);
    await upsertRoasterCoffees(db, "test-roaster", []);

    let rows = db.select().from(schema.coffees).all();
    expect(rows[0].available).toBe(false);

    await upsertRoasterCoffees(db, "test-roaster", [coffee]);
    rows = db.select().from(schema.coffees).all();
    expect(rows[0].available).toBe(true);
  });
});
