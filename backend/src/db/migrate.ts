import { sqlite } from "./client.js";

/**
 * Push-based migration: create tables if not exists.
 * For production, use drizzle-kit generate + migrate.
 */
export function runMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS coffees (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      roaster       TEXT NOT NULL,
      roaster_id    TEXT NOT NULL,
      roast_level   TEXT,
      tasting_notes TEXT,
      description   TEXT,
      price         REAL NOT NULL,
      weight        TEXT,
      image_url     TEXT,
      product_url   TEXT NOT NULL,
      available     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS coffees_roaster_product_unique
      ON coffees (roaster_id, product_url);

    CREATE INDEX IF NOT EXISTS coffees_available_idx
      ON coffees (available);

    CREATE INDEX IF NOT EXISTS coffees_roaster_id_idx
      ON coffees (roaster_id);
  `);
}
