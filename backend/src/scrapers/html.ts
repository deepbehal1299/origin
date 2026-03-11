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

    const linkPattern = config.productLinkPattern;
    const rawLinks = await page.evaluate((baseUrl: string) => {
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

    const productLinks = linkPattern
      ? rawLinks.filter((l) => l.includes(linkPattern))
      : rawLinks;

    console.log(`[html] ${config.name}: found ${productLinks.length} product links (filtered from ${rawLinks.length})`);

    for (const link of productLinks) {
      try {
        console.log(`[html] Scraping ${link}`);
        await page.goto(link, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);

        const productData = await page.evaluate(() => {
          const nameSelectors = [
            "h1.product-title", "h1.product__title", "h1.product-single__title",
            "h1.product_title", "h1.entry-title",
            'meta[property="og:title"]', "h1",
          ];
          const priceSelectors = [
            ".summary .price .woocommerce-Price-amount",
            ".summary .price ins .woocommerce-Price-amount",
            ".summary .price",
            ".product-price", ".product__price", ".price__current",
            "[data-product-price]", ".product-single__price",
          ];
          const descSelectors = [
            ".product-description", ".product__description",
            ".product-single__description",
            ".woocommerce-product-details__short-description",
            "[data-product-description]",
            'meta[property="og:description"]',
          ];
          const imgSelectors = [
            'meta[property="og:image"]', ".product-image img",
            ".product__image img", ".product-single__photo img",
            ".product-featured-media img", "img.product-image",
            ".woocommerce-product-gallery img",
          ];

          let name: string | null = null;
          for (let i = 0; i < nameSelectors.length; i++) {
            const el = document.querySelector(nameSelectors[i]);
            const t = el?.textContent?.trim();
            if (t) { name = t; break; }
          }

          let priceText: string | null = null;
          for (let i = 0; i < priceSelectors.length; i++) {
            const el = document.querySelector(priceSelectors[i]);
            const t = el?.textContent?.trim();
            if (t) { priceText = t; break; }
          }

          let desc: string | null = null;
          for (let i = 0; i < descSelectors.length; i++) {
            const el = document.querySelector(descSelectors[i]);
            const t = el?.textContent?.trim();
            if (t) { desc = t; break; }
          }

          let image: string | null = null;
          for (let i = 0; i < imgSelectors.length; i++) {
            const el = document.querySelector(imgSelectors[i]);
            const src = el?.getAttribute("content") ?? el?.getAttribute("src");
            if (src) { image = src.startsWith("//") ? "https:" + src : src; break; }
          }

          const bodyText = document.body?.innerText ?? "";
          return { name, priceText, desc, image, bodyText };
        });

        if (!productData.name || !productData.priceText) {
          console.warn(`[html] Skipping ${link}: missing name or price`);
          continue;
        }

        const price = parsePrice(productData.priceText);
        if (price <= 0) continue;

        const desc = productData.desc ?? "";
        const roastLevel = normalizeRoastLevel(productData.name) ??
          normalizeRoastLevel(link) ??
          normalizeRoastLevel(desc);
        const weight = extractWeightFromText(productData.name ?? "") ??
          extractWeightFromText(desc);

        let tastingNotes: string | null = null;
        const notePatterns = [
          /tasting\s*notes?\s*[:\-–—]?\s*(.+?)(?:\n|$)/i,
          /flavou?r\s*(?:notes?|profile)?\s*[:\-–—]?\s*(.+?)(?:\n|$)/i,
          /notes?\s+of\s+(.+?)(?:\.\s|$|\n)/i,
        ];
        for (const pat of notePatterns) {
          const m = desc.match(pat);
          if (m?.[1]) {
            const notes = m[1].trim();
            if (notes.length > 3 && notes.length < 200) {
              tastingNotes = notes;
              break;
            }
          }
        }

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
