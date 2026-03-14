import { afterAll, describe, expect, it } from "vitest";
import { createMigratedTestDb } from "./helpers/testDb.js";

describe("runMigrations", () => {
  let testDb: Awaited<ReturnType<typeof createMigratedTestDb>>;

  afterAll(async () => {
    await testDb.client.close();
  });

  it("applies the baseline database migration", async () => {
    testDb = await createMigratedTestDb();

    const result = await testDb.client.query(
      "select to_regclass('public.coffees') as table_name"
    );

    const tableName = (result.rows[0] as { table_name?: string } | undefined)
      ?.table_name;

    expect(tableName).toBe("coffees");
  });
});
