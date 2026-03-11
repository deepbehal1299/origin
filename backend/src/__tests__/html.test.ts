import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoasterConfig } from "../types.js";

const HTML_CONFIG: RoasterConfig = {
  id: "html-roaster",
  name: "HTML Roaster",
  url: "https://example.com",
  type: "html",
  collectionPath: "/coffee",
  productLinkPattern: "/product/",
};

interface MockProductData {
  name: string | null;
  priceText: string | null;
  desc: string | null;
  image: string | null;
  bodyText: string;
}

function createPlaywrightMock(options: {
  collectionUrl: string;
  rawLinks: string[];
  productDataByUrl: Record<string, MockProductData>;
  failingUrls?: string[];
}) {
  let currentUrl = "";
  const failingUrls = new Set(options.failingUrls ?? []);

  const page = {
    setDefaultTimeout: vi.fn(),
    goto: vi.fn(async (url: string) => {
      currentUrl = url;
      if (failingUrls.has(url)) {
        throw new Error(`Failed to load ${url}`);
      }
    }),
    waitForTimeout: vi.fn(async () => {}),
    evaluate: vi.fn(async () => {
      if (currentUrl === options.collectionUrl) {
        return options.rawLinks;
      }

      const product = options.productDataByUrl[currentUrl];
      if (!product) {
        throw new Error(`No mocked product data for ${currentUrl}`);
      }

      return product;
    }),
  };

  const context = {
    newPage: vi.fn(async () => page),
  };

  const browser = {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => {}),
  };

  return {
    chromium: {
      launch: vi.fn(async () => browser),
    },
    page,
    browser,
  };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("playwright");
});

describe("scrapeHtml", () => {
  it("TC-HTML-01: extracts Coffee-shaped fields from stub HTML", async () => {
    const collectionUrl = "https://example.com/coffee";
    const productUrl = "https://example.com/product/estate-a";
    const mock = createPlaywrightMock({
      collectionUrl,
      rawLinks: [productUrl, "https://example.com/about"],
      productDataByUrl: {
        [productUrl]: {
          name: "Estate A",
          priceText: "₹550.00",
          desc: "Tasting Notes: Citrus, Honey\nA washed coffee.",
          image: "https://cdn.example.com/estate-a.jpg",
          bodyText: "Estate A",
        },
      },
    });

    vi.doMock("playwright", () => mock);
    const { scrapeHtml } = await import("../scrapers/html.js");

    const results = await scrapeHtml(HTML_CONFIG);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      name: "Estate A",
      roaster: "HTML Roaster",
      roaster_id: "html-roaster",
      roast_level: null,
      tasting_notes: "Citrus, Honey",
      description: "Tasting Notes: Citrus, Honey\nA washed coffee.",
      price: 550,
      weight: null,
      image_url: "https://cdn.example.com/estate-a.jpg",
      product_url: productUrl,
      available: true,
    });
  });

  it("TC-HTML-02: one failing product does not stop the run", async () => {
    const collectionUrl = "https://example.com/coffee";
    const goodUrl = "https://example.com/product/good";
    const badUrl = "https://example.com/product/bad";
    const mock = createPlaywrightMock({
      collectionUrl,
      rawLinks: [goodUrl, badUrl],
      productDataByUrl: {
        [goodUrl]: {
          name: "Good Coffee",
          priceText: "₹499.00",
          desc: "Balanced cup",
          image: null,
          bodyText: "Good Coffee",
        },
      },
      failingUrls: [badUrl],
    });

    vi.doMock("playwright", () => mock);
    const { scrapeHtml } = await import("../scrapers/html.js");

    const results = await scrapeHtml(HTML_CONFIG);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Good Coffee");
    expect(mock.page.goto).toHaveBeenCalledWith(badUrl, { waitUntil: "domcontentloaded" });
  });

  it("TC-HTML-03: timeout/failure on one page does not hang the run", async () => {
    const collectionUrl = "https://example.com/coffee";
    const goodUrl = "https://example.com/product/good";
    const timeoutUrl = "https://example.com/product/timeout";
    const mock = createPlaywrightMock({
      collectionUrl,
      rawLinks: [timeoutUrl, goodUrl],
      productDataByUrl: {
        [goodUrl]: {
          name: "Recovered Coffee",
          priceText: "₹650.00",
          desc: "Sweet and clean",
          image: null,
          bodyText: "Recovered Coffee",
        },
      },
      failingUrls: [timeoutUrl],
    });

    vi.doMock("playwright", () => mock);
    const { scrapeHtml } = await import("../scrapers/html.js");

    const results = await scrapeHtml(HTML_CONFIG);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Recovered Coffee");
    expect(mock.browser.close).toHaveBeenCalledTimes(1);
  });

  it("TC-HTML-04: normalizes roast level to supported enum values", async () => {
    const collectionUrl = "https://example.com/coffee";
    const productUrl = "https://example.com/product/our-coffees/medium-dark-roast/estate-b";
    const mock = createPlaywrightMock({
      collectionUrl,
      rawLinks: [productUrl],
      productDataByUrl: {
        [productUrl]: {
          name: "Estate B",
          priceText: "₹700.00",
          desc: "A syrupy cup.",
          image: null,
          bodyText: "Estate B",
        },
      },
    });

    vi.doMock("playwright", () => mock);
    const { scrapeHtml } = await import("../scrapers/html.js");

    const results = await scrapeHtml(HTML_CONFIG);

    expect(results).toHaveLength(1);
    expect(["Light", "Light-Medium", "Medium", "Medium-Dark", "Dark", null]).toContain(
      results[0].roast_level
    );
    expect(results[0].roast_level).toBe("Medium-Dark");
  });
});
