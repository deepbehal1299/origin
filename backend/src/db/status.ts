import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { appStatus } from "./schema.js";
import type { AppStatus, ScrapeRunStatus } from "../types.js";

const APP_STATUS_ID = "global";

function toAppStatus(row?: typeof appStatus.$inferSelect): AppStatus {
  return {
    lastSuccessfulScrapeAt: row?.lastSuccessfulScrapeAt ?? null,
    lastRunFinishedAt: row?.lastRunFinishedAt ?? null,
    lastRunStatus: (row?.lastRunStatus as ScrapeRunStatus | undefined) ?? "never",
    roastersProcessed: row?.roastersProcessed ?? 0,
    roastersFailed: row?.roastersFailed ?? 0,
  };
}

export async function getAppStatus(): Promise<AppStatus> {
  const [row] = await db
    .select()
    .from(appStatus)
    .where(eq(appStatus.id, APP_STATUS_ID))
    .limit(1);

  return toAppStatus(row);
}

export async function recordScrapeRun(result: {
  completedAt: string;
  status: Exclude<ScrapeRunStatus, "never">;
  roastersProcessed: number;
  roastersFailed: number;
}): Promise<AppStatus> {
  const existing = await getAppStatus();
  const lastSuccessfulScrapeAt =
    result.status === "success"
      ? result.completedAt
      : existing.lastSuccessfulScrapeAt;

  await db
    .insert(appStatus)
    .values({
      id: APP_STATUS_ID,
      lastSuccessfulScrapeAt,
      lastRunFinishedAt: result.completedAt,
      lastRunStatus: result.status,
      roastersProcessed: result.roastersProcessed,
      roastersFailed: result.roastersFailed,
      updatedAt: result.completedAt,
    })
    .onConflictDoUpdate({
      target: appStatus.id,
      set: {
        lastSuccessfulScrapeAt,
        lastRunFinishedAt: result.completedAt,
        lastRunStatus: result.status,
        roastersProcessed: result.roastersProcessed,
        roastersFailed: result.roastersFailed,
        updatedAt: result.completedAt,
      },
    });

  return {
    lastSuccessfulScrapeAt,
    lastRunFinishedAt: result.completedAt,
    lastRunStatus: result.status,
    roastersProcessed: result.roastersProcessed,
    roastersFailed: result.roastersFailed,
  };
}
