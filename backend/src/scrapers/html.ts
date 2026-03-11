import type { RoasterConfig, ScrapedCoffee } from "../types.js";
import { normalizeRoastLevel } from "./normalize.js";

let pw: typeof import("playwright") | null = null;

async function getPlaywright() {
  if (!pw) {
    pw = await import("playwright");
  }
  return pw;
}

const PAGE_TIMEOUT = 15_000;
const DELAY_BETWEEN_PRODUCTS = 750;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parsePrice(text: string): number {
  const cleaned = text.replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractWeightFromText(text: string): string | null {
  const match = text.match(/(\d+\s*(?:g|gm|gms|kg))/i);
  return match ? match[1].replace(/\s/g, "") : null;
}

export async function scrapeHtml(config: RoasterConfig): Promise<ScrapedCoffee[]> {
  const { chromium } = await getPlaywright();
  const browser = await chromium.launch({ headless: true });
  const results: ScrapedCoffee[] = [];

  try {
    const context = await browser.newContext({
      userAgent: "OriginCoffeeAggregator/1.0",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT);

    const collectionUrl = config.collectionPath
      ? `${config.url}${config.collectionPath}`
      : config.url;

    console.log(`[html] Navigating to ${collectionUrl}`);
    await page.goto(collectionUrl, { waitUntil: "domcontentloaded" });

    await page.waitForTimeout(2000);

    const productLinks = await page.evaluate((baseUrl: string) => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      const links = new Set<string>();

      for (const a of anchors) {
        const href = a.getAttribute("href") ?? "";
        if (href.includes("/products/") || href.includes("/product/")) {
          const full = href.startsWith("http") ? href : new URL(href, baseUrl).href;
          links.add(full);
        }
      }

      return Array.from(links);
    }, config.url);

    console.log(`[html] ${config.name}: found ${productLinks.length} product links`);

    for (const link of productLinks) {
      try {
        console.log(`[html] Scraping ${link}`);
        await page.goto(link, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);

        const productData = await page.evaluate(() => {
          const getText = (selectors: string[]): string | null => {
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el?.textContent?.trim()) return el.textContent.trim();
            }
            return null;
          };

          const getImage = (): string | null => {
            const selectors = [
              'meta[property="og:image"]',
              ".product-image img",
              ".product__image img",
              ".product-single__photo img",
              ".product-featured-media img",
              "img.product-image",
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              const src = el?.getAttribute("content") ?? el?.getAttribute("src");
              if (src) return src.startsWith("//") ? `https:${src}` : src;
            }
            return null;
          };

          const name = getText([
            "h1.product-title",
            "h1.product__title",
            "h1.product-single__title",
            'meta[property="og:title"]',
            "h1",
          ]);

          const priceText = getText([
            ".product-price",
            ".product__price",
            ".price__current",
            ".price",
            '[data-product-price]',
            ".product-single__price",
          ]);

          const desc = getText([
            ".product-description",
            ".product__description",
            ".product-single__description",
            '[data-product-description]',
            'meta[property="og:description"]',
          ]);

          const bodyText = document.body?.innerText ?? "";

          return { name, priceText, desc, image: getImage(), bodyText };
        });

        if (!productData.name || !productData.priceText) {
          console.warn(`[html] Skipping ${link}: missing name or price`);
          continue;
        }

        const price = parsePrice(productData.priceText);
        if (price <= 0) continue;

        const bodyText = productData.bodyText ?? "";
        const roastLevel = normalizeRoastLevel(bodyText);
        const weight = extractWeightFromText(productData.name ?? "") ??
          extractWeightFromText(bodyText);

        let tastingNotes: string | null = null;
        const noteMatch = bodyText.match(
          /(?:tasting\s*notes?|flavou?r\s*(?:notes?|profile)?)\s*[:\-–—]?\s*(.+?)(?:\n|$)/i
        );
        if (noteMatch?.[1]) tastingNotes = noteMatch[1].trim();

        results.push({
          name: productData.name,
          roaster: config.name,
          roaster_id: config.id,
          roast_level: roastLevel,
          tasting_notes: tastingNotes,
          description: productData.desc,
          price,
          weight,
          image_url: productData.image,
          product_url: link,
        });
      } catch (err) {
        console.error(`[html] Error scraping ${link} for ${config.name}:`, err);
      }

      await sleep(DELAY_BETWEEN_PRODUCTS);
    }
  } catch (err) {
    console.error(`[html] Error scraping roaster ${config.name}:`, err);
  } finally {
    await browser.close();
  }

  console.log(`[html] ${config.name}: scraped ${results.length} coffees`);
  return results;
}
