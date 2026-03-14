# Origin — Low-Level Design (LLD)

This document is the low-level specification for the Origin Coffee Aggregator PWA. It is derived from [origin_prd.md](.cursor/plans/origin_prd.md), [origin_arch_plan.md](.cursor/plans/origin_arch_plan.md), and [origin_build_and_delivery_plan](.cursor/plans/origin_build_and_delivery_plan_43c26765.plan.md). Implementers should use this LLD together with the API contract doc ([origin_contract.md](.cursor/plans/origin_contract.md)) for backend–frontend alignment.

---

## 1. Database

### 1.1 Overview

- **ORM:** Drizzle ORM. Schema and migrations are explicit; DB is PostgreSQL for beta/prod readiness.
- **Tables:** `coffees` and `app_status` (required). `roasters` is optional for v1; if omitted, roaster list comes from config + frontend persistence for "enabled".

### 1.2 Schema: `coffees`

| Column        | Type           | Constraints / Notes                                      |
| ------------- | -------------- | --------------------------------------------------------- |
| id            | TEXT (UUID)    | PRIMARY KEY, generated on insert (e.g. `crypto.randomUUID()`) |
| name          | TEXT           | NOT NULL                                                  |
| roaster       | TEXT           | NOT NULL — roaster display name from config               |
| roaster_id    | TEXT           | NOT NULL — stable id/slug for filtering (e.g. config key) |
| roast_level   | TEXT           | NULLABLE — one of: Light, Light-Medium, Medium, Medium-Dark, Dark |
| tasting_notes | TEXT           | NULLABLE — comma-separated or as provided by source       |
| description   | TEXT           | NULLABLE — origin/process/varietal combined               |
| price         | REAL           | NOT NULL — numeric price (cheapest variant for Shopify)   |
| weight        | TEXT           | NULLABLE — e.g. "200g", "500g"                            |
| image_url     | TEXT           | NULLABLE                                                  |
| product_url   | TEXT           | NOT NULL — full URL to roaster product page               |
| available     | INTEGER (bool) | NOT NULL, DEFAULT 1                                       |
| created_at    | TEXT (ISO8601) | NOT NULL — set on insert                                  |
| updated_at    | TEXT (ISO8601) | NOT NULL — set on insert and update                       |

**Unique constraint:** `(roaster_id, product_url)` — used for upsert; prevents duplicate coffees per roaster.

**Indexes:**

- `coffees_available_idx` on `(available)` for filtering `available = 1`.
- `coffees_roaster_id_idx` on `(roaster_id)` for filtering by roaster.
- Unique index on `(roaster_id, product_url)` to enforce upsert key.

### 1.3 Schema: `app_status`

| Column                     | Type           | Constraints / Notes                                                |
| -------------------------- | -------------- | ------------------------------------------------------------------ |
| id                         | TEXT           | PRIMARY KEY; singleton value `global`                              |
| last_successful_scrape_at  | TEXT (ISO8601) | NULLABLE — latest scrape run with zero roaster failures            |
| last_run_finished_at       | TEXT (ISO8601) | NULLABLE — latest completed run, even if partial or failed         |
| last_run_status            | TEXT           | NOT NULL — one of `never`, `success`, `partial`, `failed`          |
| roasters_processed         | INTEGER        | NOT NULL — count of configured roasters in the latest run          |
| roasters_failed            | INTEGER        | NOT NULL — count of roasters that failed in the latest run         |
| updated_at                 | TEXT (ISO8601) | NOT NULL — updated whenever the metadata row is written            |

### 1.4 Drizzle-style definition (reference)

```ts
// backend/src/db/schema.ts
import { pgTable, text, real, boolean, integer } from "drizzle-orm/pg-core";

export const coffees = pgTable(
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
    available: boolean("available").notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    { name: "coffees_available_idx", on: [table.available] },
    { name: "coffees_roaster_id_idx", on: [table.roasterId] },
    { name: "coffees_roaster_product_unique", on: [table.roasterId, table.productUrl], unique: true },
  ]
);

export const appStatus = pgTable("app_status", {
  id: text("id").primaryKey(),
  lastSuccessfulScrapeAt: text("last_successful_scrape_at"),
  lastRunFinishedAt: text("last_run_finished_at"),
  lastRunStatus: text("last_run_status").notNull(),
  roastersProcessed: integer("roasters_processed").notNull().default(0),
  roastersFailed: integer("roasters_failed").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
```

### 1.5 Migrations and scrape behavior

- **Migration workflow:** Use Drizzle SQL migrations checked into `backend/drizzle/`, generated from schema changes and applied via `npm run -w backend db:migrate`.
- **Initial migration:** Create `coffees` table and indexes.
- **Metadata migration:** Create `app_status` singleton table for global freshness and scrape-run summaries.
- **On each scrape run:** Upsert by `(roaster_id, product_url)`. If row exists, update all mutable fields and `updated_at`; if not, insert with new `id` and `created_at`. For each roaster, products that appear in the current scrape result remain or are inserted/updated; products that were previously present for that roaster but are **missing from the current scrape result** must be marked `available = false` (or otherwise excluded from GET /coffees) so they no longer appear in the API—per TC-JOB-03. Do not truncate the entire table so history can be preserved if desired.
- **After each scrape run:** Update `app_status`. Only set `last_successful_scrape_at` when all configured roasters succeed; partial or failed runs update `last_run_finished_at`, `last_run_status`, and failure counts without advancing the global freshness timestamp.

---

## 2. Scrapers

### 2.1 Shared behavior

- **Entrypoint:** A single "scrape all" job reads `backend/config/roasters.json`, runs the appropriate scraper per roaster (Shopify or HTML), then runs DB upsert for that roaster's results.
- **Output:** Each scraper returns an array of normalized Coffee-shaped objects (same fields as DB schema, with `id` optional for insert; backend generates `id` on insert). `roast_level` must be one of the exact enum strings (Light, Light-Medium, Medium, Medium-Dark, Dark) or `null`—no other values (per contract and TC-SHOP-05, TC-HTML-04).
- **Resilience:** One roaster or product failure must not abort the whole run. Use try/catch per roaster and per product where appropriate; log errors and continue.
- **Politeness:** For HTML scraper, add a small delay between product-page requests (e.g. 500–1000 ms) to avoid hammering roaster sites.

### 2.2 Shopify scraper

**Input:** A roaster config entry with `type: "shopify"` and `url` (base site URL, e.g. `https://subko.com`).

**Steps:**

1. **Fetch product list**
   - `GET {baseUrl}/products.json`
   - If response has `products` array and no next page, use it. If the platform uses pagination (e.g. `?page=2`), follow `link` header or repeat with `page` until no more results.
2. **For each product**
   - **Variant selection:** If multiple variants, choose the **cheapest** by price. If tie, prefer smallest pack (e.g. 200g over 500g) or first variant consistently.
   - **Field mapping:**
     - `name` ← product title
     - `price` ← selected variant's price (numeric)
     - `weight` ← variant title or option (e.g. "200g") if available; else from product body/title or null
     - `product_url` ← `{baseUrl}/products/{product.handle}`
     - `image_url` ← first product image URL or variant image URL
     - `roast_level` ← from tags, product_type, or title (keyword match: "Light", "Dark", "Medium", "Light-Medium", "Medium-Dark"); else null
     - `tasting_notes` ← from tags or body_html (parse or store as single string)
     - `description` ← product body or combined origin/process/varietal if structured; else null
     - `roaster` ← config `name`; `roaster_id` ← config id or slug (e.g. `subko`)
     - `available` ← true for products returned by API
   - Append to result list.
3. **Output:** List of Coffee-shaped objects; no DB write inside scraper. Caller (daily job) performs upsert.

**Error handling and retries:**

- **Timeouts:** Set request timeout (e.g. 15s) for `fetch`.
- **Retries:** On network failure or 5xx, retry up to 2 times with backoff (e.g. 2s, 4s). After max retries, log and skip that roaster for this run.
- **4xx:** Do not retry; log and skip.

### 2.3 HTML scraper (Playwright)

**Input:** A roaster config entry with `type: "html"` and `url`. Optional: `collectionPath` (e.g. `/collections/coffee`) or `productSelector` for listing page (can be added to config later).

**Steps:**

1. **Launch browser:** Playwright, headless, one browser instance per run (reuse for all HTML roasters in the same job).
2. **Open listing page:** Navigate to `{url}` or `{url}{collectionPath}`. Wait for content (e.g. `page.waitForSelector(productSelector or 'a[href*="/products/"]')`).
3. **Collect product links:** Extract all product page links from the listing (e.g. `href` from anchors that point to product pages). Deduplicate.
4. **For each product URL:**
   - Navigate to product page.
   - **Timeouts:** Set page default timeout (e.g. 15s). On timeout, log and continue to next product.
   - **Extract:** Name, price, image, description; optionally roast level and tasting notes from text or structure. Normalize to Coffee shape:
     - `name`, `price` (parse to number), `image_url`, `product_url` (current page URL), `description`, `roast_level`, `tasting_notes`, `roaster`, `roaster_id`, `available: true`, `weight` if present.
   - Append to result list.
   - **Delay:** Wait 500–1000 ms before next product to be polite.
5. **Output:** List of Coffee-shaped objects. Caller performs upsert.
6. **Teardown:** Close browser.

**Error handling and retries:**

- **Per product:** try/catch around extraction; on failure log product URL and continue.
- **Per roaster:** try/catch around full roaster run; on unhandled failure log and continue to next roaster.
- **Retries:** Optional: retry failed product page once after 2s delay.

**Config extension (optional):** In `roasters.json`, allow `collectionPath`, `productSelector`, or `productLinkSelector` per HTML roaster for robustness when site structure differs.

---

## 3. API

### 3.1 GET /coffees

- **Method:** GET  
- **Path:** `/coffees`  
- **Query params:** None in v1.
- **Behavior:** Return all coffees where `available = true`. No filtering by roaster in v1 (frontend filters client-side using enabled roasters from Settings).
- **Response:**
  - **Status:** 200
  - **Body:** JSON array of Coffee objects. Shape is defined in [origin_contract.md](.cursor/plans/origin_contract.md); fields align with DB: `id`, `name`, `roaster`, `roaster_id`, `roast_level`, `tasting_notes`, `description`, `price`, `weight`, `image_url`, `product_url`, `available`.
- **CORS:** Allow frontend origin. In development: `http://localhost:3000`. In production: the PWA origin (e.g. `https://origin.example.com`). Allow `GET` and appropriate headers (e.g. `Content-Type`).
- **Auth:** None in v1.

### 3.2 GET /meta

- **Method:** GET
- **Path:** `/meta`
- **Behavior:** Return the singleton freshness/status object from `app_status`. Before any successful scrape, return null freshness fields with `lastRunStatus = "never"`.
- **Response:** JSON object with `lastSuccessfulScrapeAt`, `lastRunFinishedAt`, `lastRunStatus`, `roastersProcessed`, and `roastersFailed`.

---

## 4. Jobs

### 4.1 Daily scrape job

- **Schedule:** Cron expression `0 6 * * *` (06:00 every day). Timezone: `Asia/Kolkata` (IST). Use `node-cron` with `TZ=Asia/Kolkata` or equivalent.
- **Entrypoint:** From the same Node process that serves the API (in-process cron). On tick:
  1. Read `backend/config/roasters.json`.
  2. For each roaster: if `type === "shopify"` run Shopify scraper; if `type === "html"` run HTML scraper.
  3. For each roaster's result set, upsert into `coffees` by `(roaster_id, product_url)`; then mark any existing coffees for that roaster that are not in the result set as `available = false` so GET /coffees does not return them (per test case TC-JOB-03).
  4. Persist scrape-run metadata into `app_status`.
- **Process behavior:** The process stays up to serve the API. The cron runs inside this process; no separate worker process in v1.

---

## 5. Config

### 5.1 Roasters config

- **Path:** `backend/config/roasters.json`
- **Structure:**

```json
[
  {
    "id": "subko",
    "name": "Subko",
    "url": "https://subko.com",
    "type": "shopify"
  },
  {
    "id": "savorworks",
    "name": "Savorworks",
    "url": "https://savorworks.in",
    "type": "html",
    "collectionPath": "/collections/coffee"
  }
]
```

- **Fields:** `id` (string, stable key for `roaster_id`), `name` (display name), `url` (string), `type` (`"shopify"` | `"html"`). Optional for HTML: `collectionPath`, `productSelector`, etc.
- **Initial roasters (by name):** Subko, Savorworks, Bloom Coffee Roasters, Rossette Coffee Lab, Marcs Coffee, Grey Soul Coffee. Populate `id` and `url` and `type` per roaster.

### 5.2 Backend environment variables

| Variable       | Required | Description                                  |
| -------------- | -------- | -------------------------------------------- |
| DATABASE_URL   | Yes      | PostgreSQL connection string                 |
| DATABASE_SSL   | No       | `true` to force SSL when the provider requires it |
| PORT           | No       | HTTP server port; default e.g. 4000          |
| NODE_ENV       | No       | `development` \| `production`                |

Config file path can be overridden via env (e.g. `ROASTERS_CONFIG`) if desired; default `backend/config/roasters.json` relative to app root.

---

## 6. Frontend

### 6.1 Route structure

- `/` — Feed (default)
- `/compare` — Compare (up to 5 coffees)
- `/settings` — Settings (roasters toggles, roast preferences)

No server-side session or auth. All user-specific state is in localStorage.

### 6.2 localStorage usage

Keys and value shapes (must match [origin_contract.md](.cursor/plans/origin_contract.md)):

| Key                     | Value shape                                                                 | Purpose                                      |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| `origin_compare`        | Array of coffee `id` (string) only; max length 5. Resolve full coffees from API data when rendering. | Compare list; Feed adds here; Compare reads  |
| `origin_roasters`       | Record<string, boolean> — roaster name → enabled                            | Settings toggles; Feed filters by enabled    |
| `origin_roast_preferences` | Array of roast level strings (Light, Light-Medium, Medium, Medium-Dark, Dark) | Preferred roast levels; Feed uses for default filter or sort |
| `origin_saved`           | Array of coffee `id` (string) — client-only bookmarks                        | Save action on cards; no backend sync in v1  |

- **Persistence:** Write on user action (add/remove compare, toggle roaster, change roast preferences, save/unsave coffee). Read on Feed, Compare, and Settings load.
- **Compare:** Store ids only so Compare page resolves from current API data and avoids stale prices/fields (per contract §7.1). Max 5 items.

### 6.3 Data flow

- **Feed:** On load, fetch `GET /coffees` and `GET /meta` (via `NEXT_PUBLIC_API_URL`). In live mode, retry the combined load up to 2 additional times before showing the fallback state. Filter client-side by enabled roasters (`origin_roasters`) and by selected roast filter. Default roast filter from `origin_roast_preferences` if set. "Add to Compare" updates `origin_compare` (max 5, ids only). "Save" updates `origin_saved` (bookmark for later). "Buy" opens `product_url` in new tab. Show global “Last updated” from `lastSuccessfulScrapeAt` when available.
- **Compare:** Read `origin_compare`; resolve coffees from fetched list; render table; "Remove" updates `origin_compare`. "Buy" opens `product_url` in new tab. Reuse the same live-mode retry and freshness metadata strategy as Feed.
- **Settings:** Roaster toggles read/write `origin_roasters`; roast preferences read/write `origin_roast_preferences`. No server round-trip.

---

## 7. Key files (reference)

| Area    | File                                 | Purpose                              |
| ------- | ------------------------------------ | ------------------------------------ |
| Backend | `backend/config/roasters.json`       | Roaster list and types               |
| Backend | `backend/src/db/schema.ts`           | Drizzle schema for coffees           |
| Backend | `backend/src/scrapers/shopify.ts`     | Shopify products.json scraper        |
| Backend | `backend/src/scrapers/html.ts`        | Playwright HTML scraper              |
| Backend | `backend/src/jobs/dailyScrape.ts`     | Cron-invoked job; runs scrapers, DB  |
| Backend | `backend/src/api/routes/coffees.ts`   | GET /coffees                         |
| Frontend| `frontend/app/page.tsx`              | Feed                                 |
| Frontend| `frontend/app/compare/page.tsx`      | Compare                              |
| Frontend| `frontend/app/settings/page.tsx`     | Settings                             |
| Frontend| `frontend/app/layout.tsx`            | Tab nav + layout                     |
| Frontend| `frontend/public/manifest.json`      | PWA manifest                         |
| Frontend| `frontend/lib/storage.ts`            | localStorage helpers (compare, etc.) |

---

*LLD version: 1.0. Created from PRD, architecture plan, and build-and-delivery plan. For API request/response types and exact Coffee shape, see [origin_contract.md](.cursor/plans/origin_contract.md).*

---

## 8. LLD Review (vs Contract, Test Cases, PRD, Arch Plan)

This section records alignment checks against [origin_contract.md](.cursor/plans/origin_contract.md), [test-cases.md](../docs/test-cases.md), [origin_prd.md](.cursor/plans/origin_prd.md), and [origin_arch_plan.md](.cursor/plans/origin_arch_plan.md).

| Area | Contract / Test / PRD | LLD alignment |
|------|------------------------|---------------|
| **Coffee type** | Contract: `id`, `name`, `roaster`, `roaster_id`, `roast_level`, `tasting_notes`, `description`, `price`, `weight`, `image_url`, `product_url`, `available` | Schema and API include all fields; §3.1 lists `roaster_id` in response. |
| **Roast enum** | Contract: exact strings; TC-SHOP-05, TC-HTML-04 require normalization to enum or `null`. | §2.2 and §2.3 specify normalization to enum values or null. |
| **origin_compare** | Contract §7.1: store **ids only** (`string[]`), max 5; resolve from API. | §6.2 specifies ids only. |
| **origin_saved** | Contract §7.4, PRD Save, TC-FEED-07: `origin_saved`, `string[]`. | §6.2 and §6.3 include `origin_saved` and Save. |
| **GET /coffees** | Contract: 200, array, only available; TC-API-01–05. | §3.1 matches. |
| **Daily job / removed** | TC-JOB-03: products missing from scrape must not appear in API. | §4.1 and §1.4 describe marking missing as unavailable. |
| **CORS / env** | Contract §5–6. | §3.1 and §5.2 align. |
| **Roaster list** | PRD + Contract: six roasters; stable ids. | §5.1 lists six; config uses `id`. |

Reviewed: LLD updated to align with contract, test cases, PRD, and arch plan.
