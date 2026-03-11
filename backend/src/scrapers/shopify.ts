import type { RoasterConfig, ScrapedCoffee } from "../types.js";
import { normalizeRoastLevel, stripHtml } from "./normalize.js";

interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  available: boolean;
  option1?: string;
  option2?: string;
  option3?: string;
}

interface ShopifyImage {
  src: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

const REQUEST_TIMEOUT = 15_000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF = [2_000, 4_000];

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        headers: { "User-Agent": "OriginCoffeeAggregator/1.0" },
      });

      if (res.status >= 400 && res.status < 500) {
        throw new Error(`HTTP ${res.status} for ${url} — not retrying`);
      }

      if (res.status >= 500) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }

      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES && !(err instanceof Error && err.message.includes("not retrying"))) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF[attempt]));
        continue;
      }
      break;
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

function pickCheapestVariant(variants: ShopifyVariant[]): ShopifyVariant | undefined {
  if (!variants.length) return undefined;
  return variants.reduce((cheapest, v) => {
    const price = parseFloat(v.price);
    const cheapestPrice = parseFloat(cheapest.price);
    if (isNaN(price)) return cheapest;
    if (isNaN(cheapestPrice)) return v;
    return price < cheapestPrice ? v : cheapest;
  });
}

function extractRoastLevel(product: ShopifyProduct): string | null {
  const sources = [
    ...(product.tags ?? []),
    product.product_type ?? "",
    product.title ?? "",
  ];
  for (const src of sources) {
    const level = normalizeRoastLevel(src);
    if (level) return level;
  }
  return null;
}

function extractTastingNotes(product: ShopifyProduct): string | null {
  const noteTag = (product.tags ?? []).find(
    (t) => t.toLowerCase().includes("note") || t.toLowerCase().includes("flavor")
  );
  if (noteTag) return noteTag;

  const body = stripHtml(product.body_html ?? "");
  const noteMatch = body.match(/(?:tasting\s*notes?|flavou?r\s*(?:notes?|profile)?)\s*[:\-–—]?\s*(.+?)(?:\.|$)/i);
  if (noteMatch?.[1]) return noteMatch[1].trim();

  return null;
}

function extractWeight(variant: ShopifyVariant): string | null {
  const title = variant.title ?? "";
  const match = title.match(/(\d+\s*(?:g|gm|gms|kg))/i);
  if (match) return match[1].replace(/\s/g, "");

  for (const opt of [variant.option1, variant.option2, variant.option3]) {
    if (opt) {
      const optMatch = opt.match(/(\d+\s*(?:g|gm|gms|kg))/i);
      if (optMatch) return optMatch[1].replace(/\s/g, "");
    }
  }

  return null;
}

export async function scrapeShopify(config: RoasterConfig): Promise<ScrapedCoffee[]> {
  const results: ScrapedCoffee[] = [];
  let page = 1;
  const seenHandles = new Set<string>();

  while (true) {
    const url = `${config.url}/products.json?page=${page}&limit=250`;
    console.log(`[shopify] Fetching ${url}`);

    const res = await fetchWithRetry(url);
    const data = (await res.json()) as ShopifyProductsResponse;

    if (!data.products?.length) break;

    for (const product of data.products) {
      if (seenHandles.has(product.handle)) continue;
      seenHandles.add(product.handle);

      try {
        const variant = pickCheapestVariant(product.variants);
        if (!variant) continue;

        const price = parseFloat(variant.price);
        if (isNaN(price) || price <= 0) continue;

        results.push({
          name: product.title,
          roaster: config.name,
          roaster_id: config.id,
          roast_level: extractRoastLevel(product) as ScrapedCoffee["roast_level"],
          tasting_notes: extractTastingNotes(product),
          description: stripHtml(product.body_html ?? ""),
          price,
          weight: extractWeight(variant),
          image_url: product.images?.[0]?.src ?? null,
          product_url: `${config.url}/products/${product.handle}`,
        });
      } catch (err) {
        console.error(`[shopify] Error processing product "${product.title}" for ${config.name}:`, err);
      }
    }

    if (data.products.length < 250) break;
    page++;
  }

  console.log(`[shopify] ${config.name}: scraped ${results.length} coffees`);
  return results;
}
