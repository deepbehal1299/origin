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

const NON_COFFEE_TAGS = [
  "events", "experiences", "cacao", "chocolate", "equipment",
  "merch", "social", "gift_wrap", "taufah", "valentine",
  "sienna", "tote", "photobook",
];

const NON_COFFEE_TYPES = [
  "giftit", "gift cards",
];

const COFFEE_INDICATORS = [
  "arabica", "robusta", "coffee", "espresso", "filter",
  "roast", "blend", "single origin", "pourover", "pour over",
];

const NON_COFFEE_TITLE_KEYWORDS = [
  "filter paper", "hario", "aeropress", "kalita", "kettle",
  "grinder", "doser", "tote", "gift box", "souvenir",
  "t-shirt", "photobook", "jar", "glass", "dripper",
  "scale", "server",
];

function isCoffeeProduct(product: ShopifyProduct): boolean {
  const tagsLower = (product.tags ?? []).map((t) => t.toLowerCase());
  const typeLower = (product.product_type ?? "").toLowerCase();
  const titleLower = (product.title ?? "").toLowerCase();

  if (NON_COFFEE_TYPES.some((t) => typeLower === t)) return false;

  if (NON_COFFEE_TITLE_KEYWORDS.some((kw) => titleLower.includes(kw))) return false;

  if (NON_COFFEE_TAGS.some((t) => tagsLower.some((tag) => tag.includes(t)))) {
    const hasCoffeeTag = tagsLower.some((tag) =>
      COFFEE_INDICATORS.some((c) => tag.includes(c))
    );
    if (!hasCoffeeTag) return false;
  }

  const allText = [...tagsLower, typeLower, titleLower].join(" ");
  return COFFEE_INDICATORS.some((c) => allText.includes(c));
}

function extractRoastFromBody(body: string): string | null {
  const cleaned = stripHtml(body);
  const explicit = cleaned.match(/roast\s*(?:level|profile)?\s*[:\-–—]\s*(.+?)(?:\n|$)/i);
  if (explicit?.[1]) {
    const level = normalizeRoastLevel(explicit[1]);
    if (level) return level;
  }
  return null;
}

function extractRoastLevel(product: ShopifyProduct): string | null {
  const fromTitle = normalizeRoastLevel(product.title ?? "");
  if (fromTitle) return fromTitle;

  const fromBody = extractRoastFromBody(product.body_html ?? "");
  if (fromBody) return fromBody;

  const fromType = normalizeRoastLevel(product.product_type ?? "");
  if (fromType) return fromType;

  return null;
}

function extractTastingNotes(product: ShopifyProduct): string | null {
  const noteTag = (product.tags ?? []).find(
    (t) => t.toLowerCase().includes("note") || t.toLowerCase().includes("flavor")
  );
  if (noteTag) return noteTag;

  const body = stripHtml(product.body_html ?? "");

  const patterns = [
    /tasting\s*notes?\s*[:\-–—]?\s*(.+?)(?:\.\s|$|\n)/i,
    /flavou?r\s*(?:notes?|profile)?\s*[:\-–—]?\s*(.+?)(?:\.\s|$|\n)/i,
    /notes?\s+of\s+(.+?)(?:\.\s|$|\n)/i,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match?.[1]) {
      const notes = match[1].trim().replace(/\s+/g, " ");
      if (notes.length > 3 && notes.length < 200) return notes;
    }
  }

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

      if (!isCoffeeProduct(product)) continue;

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
