import { db } from "./client.js";
import { coffees } from "./schema.js";
import { eq, and, notInArray } from "drizzle-orm";
import type { ScrapedCoffee } from "../types.js";
import crypto from "node:crypto";

/**
 * Upsert scraped coffees for a single roaster, then mark any
 * previously-known coffees for that roaster that are NOT in the
 * current scrape as unavailable (per LLD §1.4, TC-JOB-03).
 */
export async function upsertRoasterCoffees(
  roasterId: string,
  scraped: ScrapedCoffee[]
): Promise<void> {
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
