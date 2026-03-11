import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RoasterConfig } from "../types.js";
import { scrapeShopify } from "../scrapers/shopify.js";
import { scrapeHtml } from "../scrapers/html.js";
import { upsertRoasterCoffees } from "../db/upsert.js";

function loadRoasters(): RoasterConfig[] {
  const configPath = process.env.ROASTERS_CONFIG ?? resolve("config", "roasters.json");
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as RoasterConfig[];
}

export async function runDailyScrape(): Promise<void> {
  const roasters = loadRoasters();
  console.log(`[job] Starting scrape for ${roasters.length} roasters...`);
  const startTime = Date.now();

  for (const roaster of roasters) {
    try {
      console.log(`[job] Scraping ${roaster.name} (${roaster.type})...`);
      let coffees;

      if (roaster.type === "shopify") {
        coffees = await scrapeShopify(roaster);
      } else if (roaster.type === "html") {
        coffees = await scrapeHtml(roaster);
      } else {
        console.warn(`[job] Unknown scraper type "${roaster.type}" for ${roaster.name}, skipping`);
        continue;
      }

      await upsertRoasterCoffees(roaster.id, coffees);
      console.log(`[job] ${roaster.name}: upserted ${coffees.length} coffees`);
    } catch (err) {
      console.error(`[job] Failed to scrape ${roaster.name}:`, err);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[job] Scrape complete in ${elapsed}s`);
}
