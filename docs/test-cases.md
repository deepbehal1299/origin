# Origin — Test Cases and Acceptance Criteria

This document defines test scenarios and acceptance criteria for the Origin Coffee Aggregator PWA. It is the checklist for implementers and reviewers. Test **code** should be written to satisfy these cases; this doc is the specification.

**Sources:** [origin_contract.md](.cursor/plans/origin_contract.md) (primary), [origin_lld.md](.cursor/plans/origin_lld.md), [origin_prd.md](.cursor/plans/origin_prd.md), [origin_arch_plan.md](.cursor/plans/origin_arch_plan.md), [origin_build_and_delivery_plan](.cursor/plans/origin_build_and_delivery_plan_43c26765.plan.md).

---

## 1. Backend — API

### TC-API-01: GET /coffees returns 200 and valid JSON array

| Item | Description |
|------|-------------|
| **Precondition** | Backend is running; database has zero or more coffees. |
| **Action** | `GET /coffees` (no query params). |
| **Expected** | HTTP 200; `Content-Type: application/json`; body is a JSON array. |
| **Acceptance** | Response parses as array; no thrown error; status is 200. |

---

### TC-API-02: GET /coffees response shape matches Coffee type

| Item | Description |
|------|-------------|
| **Precondition** | Database has at least one coffee row. |
| **Action** | `GET /coffees`. |
| **Expected** | Each element in the array has: `id`, `name`, `roaster`, `roaster_id`, `roast_level`, `tasting_notes`, `description`, `price`, `weight`, `image_url`, `product_url`, and `available`. Types align with the Coffee type in [origin_contract.md](.cursor/plans/origin_contract.md) §2.3. |
| **Acceptance** | All fields are present on every object; `price` is numeric not a string; nullable fields (`roast_level`, `tasting_notes`, `description`, `weight`, `image_url`) are explicitly `null` when absent, not omitted. |

---

### TC-API-03: GET /coffees returns only available coffees

| Item | Description |
|------|-------------|
| **Precondition** | Database has coffees with `available = true` and `available = false`. |
| **Action** | `GET /coffees`. |
| **Expected** | Response array contains only coffees where `available === true`. |
| **Acceptance** | No coffee with `available: false` appears in the response. |

---

### TC-API-04: CORS allows frontend origin

| Item | Description |
|------|-------------|
| **Precondition** | Backend is running; CORS configured for frontend origin (e.g. `http://localhost:3000` or production PWA origin). |
| **Action** | Request `GET /coffees` with `Origin: <frontend-origin>` (or preflight OPTIONS). |
| **Expected** | Response includes `Access-Control-Allow-Origin` permitting the frontend origin; no CORS error in browser. |
| **Acceptance** | Browser can call GET /coffees from the configured frontend origin without CORS blocking. |

---

### TC-API-05: GET /coffees with no coffees returns empty array

| Item | Description |
|------|-------------|
| **Precondition** | Database has no coffees (or all are `available = false`). |
| **Action** | `GET /coffees`. |
| **Expected** | HTTP 200; body is `[]`. |
| **Acceptance** | Empty array, not null or error. |

---

### TC-API-06: GET /meta returns default freshness metadata before first successful scrape

| Item | Description |
|------|-------------|
| **Precondition** | Backend is running; `app_status` has not been written yet. |
| **Action** | `GET /meta`. |
| **Expected** | HTTP 200 with an object containing `lastSuccessfulScrapeAt: null`, `lastRunFinishedAt: null`, `lastRunStatus: "never"`, `roastersProcessed: 0`, and `roastersFailed: 0`. |
| **Acceptance** | Frontend can safely render “Last updated” as absent instead of crashing on missing metadata. |

---

### TC-API-07: GET /meta returns persisted freshness metadata

| Item | Description |
|------|-------------|
| **Precondition** | Backend has persisted the latest scrape-run metadata in `app_status`. |
| **Action** | `GET /meta`. |
| **Expected** | HTTP 200 with the latest `lastSuccessfulScrapeAt`, `lastRunFinishedAt`, `lastRunStatus`, `roastersProcessed`, and `roastersFailed`. |
| **Acceptance** | Frontend can show the global “Last updated” label from `lastSuccessfulScrapeAt`. |

---

## 2. Backend — Shopify Scraper

### TC-SHOP-01: Normalized output matches Coffee shape from stub products.json

| Item | Description |
|------|-------------|
| **Precondition** | Stub/mock `products.json` (Shopify format) with known products. |
| **Action** | Run Shopify scraper (or normalizer) with stub. |
| **Expected** | Output is a list of objects with: `name`, `roaster`, `roaster_id`, `roast_level`, `tasting_notes`, `description`, `price`, `weight`, `image_url`, `product_url`, `available`. All required fields present; types correct. |
| **Acceptance** | Each output item conforms to the scraper output shape (all Coffee fields except `id`, which is assigned by the job on DB insert); `roaster_id` matches the config entry's stable id (e.g. `"subko"`). |

---

### TC-SHOP-02: Cheapest variant is selected for price and weight

| Item | Description |
|------|-------------|
| **Precondition** | Stub product has multiple variants (e.g. 200g @ ₹X, 500g @ ₹Y). |
| **Action** | Run Shopify scraper (or variant selection logic). |
| **Expected** | Selected variant is the one with lowest price; `price` and `weight` (if available) come from that variant. |
| **Acceptance** | Output coffee has price/weight from cheapest variant; behavior is consistent (e.g. first by price, then by variant order if tie). |

---

### TC-SHOP-03: product_url format is correct

| Item | Description |
|------|-------------|
| **Precondition** | Stub product with handle `my-coffee`; base URL `https://roaster.example.com`. |
| **Action** | Run Shopify scraper. |
| **Expected** | `product_url` is `https://roaster.example.com/products/my-coffee` (or equivalent per spec). |
| **Acceptance** | URL is valid, points to product page, and matches PRD (“Opens the coffee product page on the roaster's website”). |

---

### TC-SHOP-04: Pagination is handled

| Item | Description |
|------|-------------|
| **Precondition** | Mock Shopify endpoint returns `?page=1` and `?page=2` with different products. |
| **Action** | Run Shopify scraper with pagination support. |
| **Expected** | All products from all pages are included in the output (or in DB upsert). |
| **Acceptance** | No page is skipped; duplicate products across pages are deduplicated (e.g. by handle). |

---

### TC-SHOP-05: Roast level is normalized to supported enum values

| Item | Description |
|------|-------------|
| **Precondition** | Stub Shopify product data contains roast hints in inconsistent formats (e.g. `light roast`, `MEDIUM`, `medium dark`). |
| **Action** | Run Shopify scraper normalization. |
| **Expected** | `roast_level` is normalized to one of: `Light`, `Light-Medium`, `Medium`, `Medium-Dark`, `Dark`, or `null` if no confident mapping exists. |
| **Acceptance** | No unsupported roast strings are emitted by the scraper; frontend filters can rely on exact enum values. |

---

## 3. Backend — HTML Scraper (Playwright)

### TC-HTML-01: Extracted fields match Coffee shape from stub HTML

| Item | Description |
|------|-------------|
| **Precondition** | Stub HTML page(s) with product listing and/or product detail markup. |
| **Action** | Run HTML scraper (with mocked Playwright or stub HTML). |
| **Expected** | Output list of objects with: `name`, `roaster`, `roaster_id`, `roast_level`, `tasting_notes`, `description`, `price`, `image_url`, `product_url`, `available`. |
| **Acceptance** | Each item conforms to the scraper output shape (all Coffee fields except `id`, assigned on DB insert); `product_url` is the visited product page URL; `roaster_id` matches the config entry's stable id. |

---

### TC-HTML-02: One failing product does not stop the run

| Item | Description |
|------|-------------|
| **Precondition** | Stub scenario: one product page returns 404 or malformed HTML; others are valid. |
| **Action** | Run HTML scraper for the full list. |
| **Expected** | Scraper logs the failure, skips that product, and continues; remaining products are extracted and persisted. |
| **Acceptance** | No uncaught exception; at least the valid products appear in output/DB. |

---

### TC-HTML-03: Timeouts and retries behave as specified

| Item | Description |
|------|-------------|
| **Precondition** | LLD specifies max retries and timeouts for HTML scraper. |
| **Action** | Simulate slow or failing page (e.g. mock that hangs or returns 500). |
| **Expected** | After timeout or max retries, scraper gives up on that page and continues; no infinite hang. |
| **Acceptance** | Behavior matches LLD (e.g. log-and-continue); run completes in bounded time. |

---

### TC-HTML-04: Roast level is normalized to supported enum values

| Item | Description |
|------|-------------|
| **Precondition** | Stub HTML product pages contain roast text in inconsistent formats (e.g. `dark roast`, `light-medium`, `medium roast`). |
| **Action** | Run HTML scraper normalization. |
| **Expected** | `roast_level` is normalized to one of: `Light`, `Light-Medium`, `Medium`, `Medium-Dark`, `Dark`, or `null` if no confident mapping exists. |
| **Acceptance** | No unsupported roast strings are emitted by the scraper; frontend filters can rely on exact enum values. |

---

## 4. Backend — Daily Job (Cron)

### TC-JOB-01: Daily job runs all roasters from config

| Item | Description |
|------|-------------|
| **Precondition** | `roasters.json` has multiple roasters (Shopify and/or HTML). |
| **Action** | Trigger daily scrape job (e.g. manually or by advancing cron). |
| **Expected** | Each roaster in config is invoked (appropriate scraper per type); no roaster is skipped. |
| **Acceptance** | Can verify via logs or DB that each configured roaster was processed. |

---

### TC-JOB-02: Daily job upserts to DB by (roaster_id, product_url)

| Item | Description |
|------|-------------|
| **Precondition** | DB has existing coffees; job runs and returns same product (same `roaster_id` + `product_url`) with updated price/name. |
| **Action** | Run daily scrape. |
| **Expected** | No duplicate rows for same `(roaster_id, product_url)` pair; existing row is updated in place (upsert). |
| **Acceptance** | Count of coffees for that roaster does not double; `updated_at` is refreshed; updated fields (e.g. price) reflect latest scrape. |

---

### TC-JOB-03: Daily job reflects removed or unavailable coffees

| Item | Description |
|------|-------------|
| **Precondition** | DB contains a coffee from a previous scrape; the next scrape result for that roaster no longer includes that product or marks it unavailable. |
| **Action** | Run daily scrape. |
| **Expected** | Backend updates availability so the removed product is no longer returned by `GET /coffees` (either by marking `available = false` or replacing the dataset in a way that removes stale rows). |
| **Acceptance** | A coffee missing from the latest scrape does not continue to appear in API results after the job completes. |

---

### TC-JOB-04: Cron schedule is 06:00 IST

| Item | Description |
|------|-------------|
| **Precondition** | Backend started with TZ=Asia/Kolkata (or equivalent). |
| **Action** | Inspect cron configuration. |
| **Expected** | Cron expression is `0 6 * * *` (or equivalent for 06:00 IST). |
| **Acceptance** | Documentation and code agree; job runs once per day at 06:00 IST when process is up. |

---

### TC-JOB-05: Scrape metadata only advances the global freshness timestamp on full success

| Item | Description |
|------|-------------|
| **Precondition** | `app_status.lastSuccessfulScrapeAt` is already set from an earlier successful run. |
| **Action** | Run the scrape once with all roasters succeeding, then run again with one or more roasters failing. |
| **Expected** | On the successful run, `lastSuccessfulScrapeAt` is updated. On the partial/failed run, `lastRunFinishedAt` and `lastRunStatus` update, but `lastSuccessfulScrapeAt` remains unchanged. |
| **Acceptance** | Frontend “Last updated” reflects the latest fully successful catalog refresh rather than a partially degraded run. |

---

## 5. Frontend — Feed

### TC-FEED-01: Feed loads coffees from API

| Item | Description |
|------|-------------|
| **Precondition** | Backend running; GET /coffees returns a non-empty array. |
| **Action** | Open Feed page (`/`). |
| **Expected** | Coffees are fetched from `NEXT_PUBLIC_API_URL/coffees` and displayed (e.g. as cards). |
| **Acceptance** | No error state; at least one coffee card visible; data matches API response. |

---

### TC-FEED-02: Feed shows coffee card information

| Item | Description |
|------|-------------|
| **Precondition** | Feed has loaded coffees. |
| **Action** | View any coffee card. |
| **Expected** | Each card displays: coffee name, roaster name, roast level, tasting notes, price, coffee image. |
| **Acceptance** | All PRD-specified fields are present on the card (or clearly “—”/N/A when null). |

---

### TC-FEED-03: Filter by roast level

| Item | Description |
|------|-------------|
| **Precondition** | Feed has coffees with different roast levels (Light, Light-Medium, Medium, Medium-Dark, Dark). |
| **Action** | Select a roast level filter (e.g. “Medium”). |
| **Expected** | Only coffees with that roast level are shown. |
| **Acceptance** | Visible cards all have the selected roast level; count matches filtered set. |

---

### TC-FEED-04: Filter by roaster

| Item | Description |
|------|-------------|
| **Precondition** | Feed has coffees from multiple roasters. |
| **Action** | Select a roaster filter (e.g. “Subko”). |
| **Expected** | Only coffees from that roaster are shown. |
| **Acceptance** | Visible cards all have the selected roaster name. |

---

### TC-FEED-05: Add to Compare (max 5)

| Item | Description |
|------|-------------|
| **Precondition** | Compare list has 0–4 coffees in localStorage. |
| **Action** | Click “Compare” on a coffee card. |
| **Expected** | Coffee is added to compare list (localStorage `origin_compare`); user can add up to 5 total. |
| **Acceptance** | After 5 coffees, adding another is prevented (e.g. button disabled or message); list never exceeds 5. |

---

### TC-FEED-06: Buy opens product page in new tab

| Item | Description |
|------|-------------|
| **Precondition** | Coffee card has valid `product_url`. |
| **Action** | Click “Buy” on the card. |
| **Expected** | `product_url` opens in a new browser tab/window. |
| **Acceptance** | Same tab is not navigated away; target is the roaster’s product page. |

---

### TC-FEED-07: Save (bookmark) persists in localStorage

| Item | Description |
|------|-------------|
| **Precondition** | User is on Feed. |
| **Action** | Click “Save” on a coffee. |
| **Expected** | Coffee is bookmarked and persisted in localStorage under `origin_saved`; saved state is visible on the card (for example, icon or label change). |
| **Acceptance** | After refresh, the same coffee remains saved; `origin_saved` in localStorage contains coffee `id` strings only (`string[]`), not full objects (contract §7.4); clicking Save again removes the id from the array. |

---

### TC-FEED-08: Roast preferences default filter when set

| Item | Description |
|------|-------------|
| **Precondition** | User has set preferred roast levels in Settings (stored in `origin_roast_preferences`). |
| **Action** | Open Feed. |
| **Expected** | Roast filter is pre-filled from `origin_roast_preferences` on initial load, and the visible feed is filtered accordingly until the user changes the filter. |
| **Acceptance** | With preferences set, the initial feed only shows coffees matching the saved roast levels; after the user changes the filter manually, the new selection is respected for that session. |

---

### TC-FEED-09: Feed respects enabled roasters from Settings

| Item | Description |
|------|-------------|
| **Precondition** | Some roasters disabled in Settings (`origin_roasters`: name → false). |
| **Action** | Load Feed. |
| **Expected** | Coffees from disabled roasters are not shown (filtered out client-side or via API if supported). |
| **Acceptance** | Only coffees from enabled roasters appear in the feed. |

---

## 6. Frontend — Compare

### TC-CMP-01: Compare shows up to 5 coffees in table

| Item | Description |
|------|-------------|
| **Precondition** | localStorage `origin_compare` has 1–5 coffees. |
| **Action** | Open Compare page (`/compare`). |
| **Expected** | Table (or equivalent) shows one row per coffee with: Coffee Name, Brand, Roast Level, Tasting Notes, Description, Price, Buy. Coffee data is resolved from the current API response using the ids stored in `origin_compare`. |
| **Acceptance** | All comparison fields from PRD are present; layout is side-by-side or table; `origin_compare` in localStorage contains `id` strings only (`string[]`, max 5), not full objects (contract §7.1). |

---

### TC-CMP-02: Remove from compare

| Item | Description |
|------|-------------|
| **Precondition** | Compare list has 2+ coffees. |
| **Action** | Click “Remove from compare” (or similar) for one coffee. |
| **Expected** | That coffee is removed from the list; localStorage is updated; table updates immediately. |
| **Acceptance** | Coffee no longer in compare list after refresh. |

---

### TC-CMP-03: Empty state when no coffees

| Item | Description |
|------|-------------|
| **Precondition** | Compare list is empty (or not set). |
| **Action** | Open Compare page. |
| **Expected** | Empty state message shown, e.g. “Add coffees from the Feed to compare.” |
| **Acceptance** | No error; clear CTA to go to Feed. |

---

### TC-CMP-04: Buy from Compare opens product page in new tab

| Item | Description |
|------|-------------|
| **Precondition** | Compare table has at least one coffee. |
| **Action** | Click “Buy” for a row. |
| **Expected** | That coffee’s `product_url` opens in a new tab. |
| **Acceptance** | Same as TC-FEED-06 for Buy behavior. |

---

### TC-CMP-05: Cannot add more than 5 coffees to compare

| Item | Description |
|------|-------------|
| **Precondition** | Compare list already has 5 coffees. |
| **Action** | From Feed, try to add another coffee to compare. |
| **Expected** | App prevents adding a 6th coffee (e.g. disabled button or toast). |
| **Acceptance** | `origin_compare` never has more than 5 items. |

---

## 7. Frontend — Settings

### TC-SET-01: Roaster list shows initial six roasters

| Item | Description |
|------|-------------|
| **Precondition** | User opens Settings. |
| **Action** | View roaster management section. |
| **Expected** | List includes: Subko, Savorworks, Bloom Coffee Roasters, Rossette Coffee Lab, Marcs Coffee, Grey Soul Coffee. Each has an Enabled toggle. |
| **Acceptance** | All six roasters present; names match PRD/contract. |

---

### TC-SET-02: Roaster toggles persist in localStorage

| Item | Description |
|------|-------------|
| **Precondition** | User on Settings. |
| **Action** | Disable one roaster (toggle off); refresh page. |
| **Expected** | Toggle state is persisted (`origin_roasters`: roaster name → boolean); after refresh, same roaster is still disabled. |
| **Acceptance** | localStorage key and shape match [origin_contract.md](.cursor/plans/origin_contract.md); Feed respects this (TC-FEED-09). |

---

### TC-SET-03: Roast preferences persist in localStorage

| Item | Description |
|------|-------------|
| **Precondition** | User on Settings. |
| **Action** | Set preferred roast levels (e.g. Light, Medium); refresh. |
| **Expected** | Preferences stored in `origin_roast_preferences` (array of roast strings); after refresh, same selections are shown. |
| **Acceptance** | Feed uses these for default filter or ordering (TC-FEED-08). |

---

### TC-SET-04: Disabling a roaster removes its coffees from feed

| Item | Description |
|------|-------------|
| **Precondition** | Feed shows coffees from Roaster A. |
| **Action** | In Settings, disable Roaster A; return to Feed. |
| **Expected** | Coffees from Roaster A no longer appear in the feed. |
| **Acceptance** | PRD: “Disabling a roaster removes its coffees from the feed.” |

---

### TC-SET-05: All roasters enabled by default when origin_roasters is absent

| Item | Description |
|------|-------------|
| **Precondition** | `origin_roasters` key does not exist in localStorage (new user or cleared storage). |
| **Action** | Open Feed. |
| **Expected** | All six roasters are treated as enabled; coffees from every configured roaster are shown (subject to API returning them). |
| **Acceptance** | Feed is not empty due to missing settings; contract §7.2: if the key is absent in localStorage, all roasters are treated as enabled. Settings page also shows all six toggles in the on state. |

---

## 8. Integration

### TC-INT-01: Frontend calls GET /coffees and renders feed (happy path)

| Item | Description |
|------|-------------|
| **Precondition** | Backend and frontend running; backend has coffees. |
| **Action** | Open app at Feed; no mock. |
| **Expected** | Frontend fetches GET /coffees; feed renders with real data; no CORS or network errors. |
| **Acceptance** | End-to-end: API → JSON → React state → cards visible. |

---

### TC-INT-02: Compare list survives refresh

| Item | Description |
|------|-------------|
| **Precondition** | User has added 1–5 coffees to compare. |
| **Action** | Refresh the page (or close and reopen app). |
| **Expected** | Compare list is still in localStorage; Compare page still shows the same coffees. |
| **Acceptance** | No loss of compare state on refresh. |

---

### TC-INT-03: Navigation between Feed, Compare, Settings

| Item | Description |
|------|-------------|
| **Precondition** | App is open. |
| **Action** | Navigate: Feed → Compare → Settings → Feed (via bottom/top nav). |
| **Expected** | Routes change to `/`, `/compare`, `/settings`; no full page reload if SPA; mobile-friendly. |
| **Acceptance** | PRD: “Navigation between these sections should be simple and mobile-friendly.” |

---

### TC-FEED-10: Feed shows error state when API is unavailable

| Item | Description |
|------|-------------|
| **Precondition** | Backend is down or returns a 5xx; frontend is open. |
| **Action** | Open Feed page (or reload while API is unavailable). |
| **Expected** | Feed retries the live request up to 2 additional times, then shows a calm fallback state instead of crashing or showing a blank white screen; navigation to Compare and Settings still works. |
| **Acceptance** | Contract §4: "The UI should tolerate temporary API failure and show an error or retry state without breaking navigation." No unhandled exception thrown; tabs remain usable. |

---

### TC-FEED-11: Feed shows global last-updated metadata in live mode

| Item | Description |
|------|-------------|
| **Precondition** | Backend `/meta` returns a non-null `lastSuccessfulScrapeAt`. |
| **Action** | Open Feed page in live mode. |
| **Expected** | Feed renders a “Last updated …” label using the global metadata value. |
| **Acceptance** | Timestamp is visible when metadata exists and omitted cleanly when it does not. |

---

### TC-FEED-12: Feed distinguishes backend-empty and filtered-empty states

| Item | Description |
|------|-------------|
| **Precondition** | Scenario A: `/coffees` returns `[]`. Scenario B: `/coffees` returns data but filters or disabled roasters hide all visible items. |
| **Action** | Open Feed in each scenario. |
| **Expected** | Scenario A shows a catalog-empty message. Scenario B shows a filter/settings-specific empty message. |
| **Acceptance** | Users can tell the difference between “no coffees available right now” and “your current settings hide all coffees.” |

---

## 9. PWA

### TC-PWA-01: Manifest and installability

| Item | Description |
|------|-------------|
| **Precondition** | App served over HTTPS (or localhost). |
| **Action** | Open in browser; trigger “Add to Home Screen” (or install prompt). |
| **Expected** | manifest.json has name, short_name, start_url, display: standalone, icons. |
| **Acceptance** | PWA can be installed; launches in standalone display mode. |

---

### TC-PWA-02: App shell remains usable offline after initial load

| Item | Description |
|------|-------------|
| **Precondition** | User has loaded the app once while online; service worker caches the static app shell assets. |
| **Action** | Load app; go offline; reload or navigate. |
| **Expected** | Cached static assets still load so the app shell renders; if feed data is unavailable offline, the UI shows a clear empty or error state rather than a broken page. |
| **Acceptance** | App does not hard-fail on reload while offline after an initial online visit; installability and basic PWA shell behavior work in practice. |

---

## 10. Success Criteria (PRD alignment)

These map to the PRD “Success Criteria” and arch plan “Success Criteria Checklist”:

| ID | Criterion | Covered by |
|----|-----------|------------|
| S1 | Users can discover coffees from multiple roasters in a single feed | TC-FEED-01, TC-FEED-02, TC-INT-01 |
| S2 | Users can compare coffees without opening multiple browser tabs | TC-CMP-01, TC-CMP-02, TC-CMP-03, TC-INT-02 |
| S3 | Users can quickly navigate to the roaster website to purchase coffee | TC-FEED-06, TC-CMP-04 |
| S4 | Users can filter by roast level and roaster | TC-FEED-03, TC-FEED-04 |
| S5 | Users can add up to 5 coffees to compare | TC-FEED-05, TC-CMP-05 |
| S6 | Settings: enable/disable roasters; set roast preferences; persist and affect feed | TC-SET-01–TC-SET-05, TC-FEED-08, TC-FEED-09 |
| S7 | Backend: daily scrape at 06:00 IST; GET /coffees returns normalized data | TC-JOB-01–TC-JOB-04, TC-API-01–TC-API-05, TC-SHOP-05, TC-HTML-04 |
| S8 | Frontend gracefully handles API unavailability | TC-FEED-10 |

---

**Document version:** 1.1  
**Last updated:** Reviewed and tightened against origin_contract.md v1.0 and origin_lld.md v1.0.
