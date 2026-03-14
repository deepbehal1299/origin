export type RoastLevel =
  | "Light"
  | "Light-Medium"
  | "Medium"
  | "Medium-Dark"
  | "Dark";

export const ROAST_LEVELS: readonly RoastLevel[] = [
  "Light",
  "Light-Medium",
  "Medium",
  "Medium-Dark",
  "Dark",
] as const;

export interface Coffee {
  id: string;
  name: string;
  roaster: string;
  roaster_id: string;
  roast_level: RoastLevel | null;
  tasting_notes: string | null;
  description: string | null;
  price: number;
  weight: string | null;
  image_url: string | null;
  product_url: string;
  available: boolean;
}

export type GetCoffeesResponse = Coffee[];

export type ScrapeRunStatus = "never" | "success" | "partial" | "failed";

export interface AppStatus {
  lastSuccessfulScrapeAt: string | null;
  lastRunFinishedAt: string | null;
  lastRunStatus: ScrapeRunStatus;
  roastersProcessed: number;
  roastersFailed: number;
}

export type GetAppStatusResponse = AppStatus;

export interface RoasterConfig {
  id: string;
  name: string;
  url: string;
  type: "shopify" | "html";
  collectionPath?: string;
  productLinkPattern?: string;
}

/**
 * Shape returned by scrapers before DB insert (no id/timestamps).
 */
export interface ScrapedCoffee {
  name: string;
  roaster: string;
  roaster_id: string;
  roast_level: RoastLevel | null;
  tasting_notes: string | null;
  description: string | null;
  price: number;
  weight: string | null;
  image_url: string | null;
  product_url: string;
  available: boolean;
}
