import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";
import { runMigrations } from "./db/migrate.js";
import { coffeesRouter } from "./api/routes/coffees.js";
import { runDailyScrape } from "./jobs/dailyScrape.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);

runMigrations();

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    methods: ["GET"],
  })
);
app.use(express.json());

app.use(coffeesRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const isManualScrape = process.argv.includes("--scrape");

if (isManualScrape) {
  console.log("[main] Running manual scrape...");
  runDailyScrape()
    .then(() => {
      console.log("[main] Manual scrape complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[main] Manual scrape failed:", err);
      process.exit(1);
    });
} else {
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
