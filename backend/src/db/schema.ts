import { sqliteTable, text, real, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const coffees = sqliteTable(
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
    available: integer("available", { mode: "boolean" }).notNull().default(true),
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
