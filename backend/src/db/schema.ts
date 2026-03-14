import { pgTable, text, real, boolean, integer, uniqueIndex, index } from "drizzle-orm/pg-core";

export const coffees = pgTable(
  "coffees",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    roaster: text("roaster").notNull(),
    roasterId: text("roaster_id").notNull(),
    roastLevel: text("roast_level"),
    tastingNotes: text("tasting_notes"),
    description: text("description"),
    price: real("price").notNull(),
    weight: text("weight"),
    imageUrl: text("image_url"),
    productUrl: text("product_url").notNull(),
    available: boolean("available").notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    availableIdx: index("coffees_available_idx").on(table.available),
    roasterIdIdx: index("coffees_roaster_id_idx").on(table.roasterId),
    roasterProductUnique: uniqueIndex("coffees_roaster_product_unique").on(
      table.roasterId,
      table.productUrl
    ),
  })
);

export const appStatus = pgTable("app_status", {
  id: text("id").primaryKey(),
  lastSuccessfulScrapeAt: text("last_successful_scrape_at"),
  lastRunFinishedAt: text("last_run_finished_at"),
  lastRunStatus: text("last_run_status").notNull(),
  roastersProcessed: integer("roasters_processed").notNull().default(0),
  roastersFailed: integer("roasters_failed").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
