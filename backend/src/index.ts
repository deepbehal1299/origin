import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { runMigrations } from "./db/migrate.js";
import { coffeesRouter } from "./api/routes/coffees.js";
import { runDailyScrape } from "./jobs/dailyScrape.js";
import { pool } from "./db/client.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);

const isManualScrape = process.argv.includes("--scrape");

async function start() {
  await runMigrations();

  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
      methods: ["GET"],
    })
  );
  app.use(express.json());

  app.use(coffeesRouter);

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("select 1");
      res.json({ status: "ok" });
    } catch (error) {
      console.error("[health] Database check failed:", error);
      res.status(503).json({ status: "error" });
    }
  });

  if (isManualScrape) {
    console.log("[main] Running manual scrape...");
    try {
      await runDailyScrape();
      console.log("[main] Manual scrape complete.");
      await pool.end();
      process.exit(0);
    } catch (err) {
      console.error("[main] Manual scrape failed:", err);
      await pool.end();
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    console.log(`[main] Origin backend listening on http://localhost:${PORT}`);
  });

  cron.schedule("0 6 * * *", () => {
    console.log("[cron] Triggering daily scrape at 06:00 IST...");
    runDailyScrape().catch((err) => {
      console.error("[cron] Daily scrape failed:", err);
    });
  }, {
    timezone: "Asia/Kolkata",
  });

  console.log("[main] Cron scheduled: daily scrape at 06:00 IST");
}

start().catch(async (error) => {
  console.error("[main] Startup failed:", error);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
