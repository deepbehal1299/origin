import { Router } from "express";
import { db } from "../../db/client.js";
import { coffees } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type { Coffee } from "../../types.js";

export const coffeesRouter = Router();

coffeesRouter.get("/coffees", (_req, res) => {
  try {
    const rows = db
      .select()
      .from(coffees)
      .where(eq(coffees.available, true))
      .all();

    const response: Coffee[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      roaster: row.roaster,
      roaster_id: row.roasterId,
      roast_level: row.roastLevel as Coffee["roast_level"],
      tasting_notes: row.tastingNotes,
      description: row.description,
      price: row.price,
      weight: row.weight,
      image_url: row.imageUrl,
      product_url: row.productUrl,
      available: row.available,
    }));

    res.json(response);
  } catch (err) {
    console.error("[api] Error fetching coffees:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
