export const ROAST_LEVELS = [
  "Light",
  "Light-Medium",
  "Medium",
  "Medium-Dark",
  "Dark",
] as const;

export type RoastLevel = (typeof ROAST_LEVELS)[number];

export const ROASTER_NAMES = [
  "Subko",
  "Savorworks",
  "Bloom Coffee Roasters",
  "Rossette Coffee Lab",
  "Marcs Coffee",
  "Grey Soul Coffee",
] as const;

export type RoasterName = (typeof ROASTER_NAMES)[number];

export interface Coffee {
  id: string;
  name: string;
  roaster: RoasterName | string;
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

export type ScrapeRunStatus = "never" | "success" | "partial" | "failed";

export interface AppStatus {
  lastSuccessfulScrapeAt: string | null;
  lastRunFinishedAt: string | null;
  lastRunStatus: ScrapeRunStatus;
  roastersProcessed: number;
  roastersFailed: number;
}
