import { Router } from "express";
import { db } from "../../db/client.js";
import { coffees } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { getAppStatus } from "../../db/status.js";
import type { Coffee, GetAppStatusResponse } from "../../types.js";

export const coffeesRouter = Router();

coffeesRouter.get("/coffees", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(coffees)
      .where(eq(coffees.available, true));

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

coffeesRouter.get("/meta", async (_req, res) => {
  try {
    const status: GetAppStatusResponse = await getAppStatus();
    res.json(status);
  } catch (err) {
    console.error("[api] Error fetching app metadata:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
