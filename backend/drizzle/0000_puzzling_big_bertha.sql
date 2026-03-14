CREATE TABLE "coffees" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"roaster" text NOT NULL,
	"roaster_id" text NOT NULL,
	"roast_level" text,
	"tasting_notes" text,
	"description" text,
	"price" real NOT NULL,
	"weight" text,
	"image_url" text,
	"product_url" text NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "coffees_available_idx" ON "coffees" USING btree ("available");--> statement-breakpoint
CREATE INDEX "coffees_roaster_id_idx" ON "coffees" USING btree ("roaster_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coffees_roaster_product_unique" ON "coffees" USING btree ("roaster_id","product_url");