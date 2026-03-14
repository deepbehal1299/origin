import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../drizzle"
);

let migrationPromise: Promise<void> | null = null;

export async function runMigrations() {
  if (!migrationPromise) {
    migrationPromise = migrate(db, { migrationsFolder });
  }

  await migrationPromise;
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  runMigrations()
    .then(async () => {
      console.log("[db] Migrations complete.");
      await pool.end();
    })
    .catch(async (error) => {
      console.error("[db] Migration failed:", error);
      await pool.end();
      process.exit(1);
    });
}
