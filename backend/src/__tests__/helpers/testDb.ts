import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../db/schema.js";

function getMigrationFiles(): string[] {
  return readdirSync(resolve(process.cwd(), "drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

async function applyMigrationFiles(client: PGlite): Promise<void> {
  for (const file of getMigrationFiles()) {
    const sql = readFileSync(resolve(process.cwd(), "drizzle", file), "utf-8");
    await client.exec(sql);
  }
}

export function createUnmigratedTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  return { client, db };
}

export async function createMigratedTestDb() {
  const { client, db } = createUnmigratedTestDb();
  await applyMigrationFiles(client);
  return { client, db };
}
