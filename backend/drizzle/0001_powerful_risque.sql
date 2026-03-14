CREATE TABLE "app_status" (
	"id" text PRIMARY KEY NOT NULL,
	"last_successful_scrape_at" text,
	"last_run_finished_at" text,
	"last_run_status" text NOT NULL,
	"roasters_processed" integer DEFAULT 0 NOT NULL,
	"roasters_failed" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL
);
