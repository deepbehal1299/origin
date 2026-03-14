import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema.js";
import { createMigratedTestDb } from "./helpers/testDb.js";

describe("app status metadata", () => {
  let db: Awaited<ReturnType<typeof createMigratedTestDb>>["db"];
  let client: Awaited<ReturnType<typeof createMigratedTestDb>>["client"];
  let getAppStatus: typeof import("../db/status.js").getAppStatus;
  let recordScrapeRun: typeof import("../db/status.js").recordScrapeRun;

  beforeAll(async () => {
    const migrated = await createMigratedTestDb();
    db = migrated.db;
    client = migrated.client;

    vi.doMock("../db/client.js", () => ({
      db,
      pool: {
        query: async () => ({ rows: [{ ok: 1 }] }),
        end: async () => undefined,
      },
    }));

    ({ getAppStatus, recordScrapeRun } = await import("../db/status.js"));
  });

  beforeEach(() => {
    return db.delete(schema.appStatus);
  });

  afterAll(async () => {
    await client.close();
    vi.doUnmock("../db/client.js");
  });

  it("returns empty metadata before any successful scrape", async () => {
    await expect(getAppStatus()).resolves.toEqual({
      lastSuccessfulScrapeAt: null,
      lastRunFinishedAt: null,
      lastRunStatus: "never",
      roastersProcessed: 0,
      roastersFailed: 0,
    });
  });

  it("records successful scrapes and preserves last successful timestamp on partial failure", async () => {
    await recordScrapeRun({
      completedAt: "2026-03-12T06:00:00.000Z",
      status: "success",
      roastersProcessed: 6,
      roastersFailed: 0,
    });

    await recordScrapeRun({
      completedAt: "2026-03-13T06:00:00.000Z",
      status: "partial",
      roastersProcessed: 6,
      roastersFailed: 1,
    });

    await expect(getAppStatus()).resolves.toEqual({
      lastSuccessfulScrapeAt: "2026-03-12T06:00:00.000Z",
      lastRunFinishedAt: "2026-03-13T06:00:00.000Z",
      lastRunStatus: "partial",
      roastersProcessed: 6,
      roastersFailed: 1,
    });
  });
});
