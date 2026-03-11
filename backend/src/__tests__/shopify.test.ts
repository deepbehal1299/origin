import { describe, it, expect, vi, beforeAll } from "vitest";
import type { RoasterConfig } from "../types.js";

const MOCK_CONFIG: RoasterConfig = {
  id: "test-roaster",
  name: "Test Roaster",
  url: "https://test-roaster.example.com",
  type: "shopify",
};

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Test Coffee - Light Roast",
    handle: "test-coffee",
    body_html: "<p>Tasting Notes: Citrus, Honey, Chocolate</p>",
    vendor: "Test Roaster",
    product_type: "Single Origin",
    tags: ["coffee", "arabica"],
    variants: [
      { id: 1, title: "250g", price: "500.00", available: true },
      { id: 2, title: "1kg", price: "1800.00", available: true },
    ],
    images: [{ src: "https://cdn.example.com/coffee.jpg" }],
    ...overrides,
  };
}

function makeResponse(products: unknown[], status = 200) {
  return new Response(JSON.stringify({ products }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("scrapeShopify", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse([makeProduct()]))
    );
  });

  it("TC-SHOP-01: output matches ScrapedCoffee shape", async () => {
    const { scrapeShopify } = await import("../scrapers/shopify.js");
    const results = await scrapeShopify(MOCK_CONFIG);

    expect(results.length).toBe(1);
    const coffee = results[0];

    expect(coffee).toHaveProperty("name");
    expect(coffee).toHaveProperty("roaster", "Test Roaster");
    expect(coffee).toHaveProperty("roaster_id", "test-roaster");
    expect(coffee).toHaveProperty("roast_level");
    expect(coffee).toHaveProperty("tasting_notes");
    expect(coffee).toHaveProperty("description");
    expect(coffee).toHaveProperty("price");
    expect(coffee).toHaveProperty("weight");
    expect(coffee).toHaveProperty("image_url");
    expect(coffee).toHaveProperty("product_url");
    expect(typeof coffee.price).toBe("number");
  });

  it("TC-SHOP-02: selects cheapest variant", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse([
          makeProduct({
            variants: [
              { id: 1, title: "1kg", price: "1800.00", available: true },
              { id: 2, title: "250g", price: "500.00", available: true },
              { id: 3, title: "500g", price: "900.00", available: true },
            ],
          }),
        ])
      )
    );

    const { scrapeShopify } = await import("../scrapers/shopify.js");
    const results = await scrapeShopify(MOCK_CONFIG);
    expect(results[0].price).toBe(500);
    expect(results[0].weight).toBe("250g");
  });

  it("TC-SHOP-03: product_url has correct format", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse([makeProduct({ handle: "my-coffee-blend" })])
      )
    );

    const { scrapeShopify } = await import("../scrapers/shopify.js");
    const results = await scrapeShopify(MOCK_CONFIG);
    expect(results[0].product_url).toBe(
      "https://test-roaster.example.com/products/my-coffee-blend"
    );
  });

  it("TC-SHOP-04: handles pagination", async () => {
    const page1Products = Array.from({ length: 250 }, (_, i) =>
      makeProduct({ id: i, handle: `coffee-${i}`, title: `Coffee ${i} Filter Roast` })
    );
    const page2Products = [
      makeProduct({ id: 300, handle: "coffee-300", title: "Coffee 300 Espresso Roast" }),
    ];

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(makeResponse(page1Products));
        if (callCount === 2) return Promise.resolve(makeResponse(page2Products));
        return Promise.resolve(makeResponse([]));
      })
    );

    const { scrapeShopify } = await import("../scrapers/shopify.js");
    const results = await scrapeShopify(MOCK_CONFIG);
    expect(results.length).toBe(251);
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it("TC-SHOP-05: normalizes roast levels to enum values", async () => {
    const products = [
      makeProduct({ handle: "c1", title: "Coffee One - Light Roast", tags: ["coffee"] }),
      makeProduct({ handle: "c2", title: "Coffee Two - medium dark blend", tags: ["coffee"] }),
      makeProduct({ handle: "c3", title: "Coffee Three", tags: ["coffee"], product_type: "Espresso" }),
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(products)));

    const { scrapeShopify } = await import("../scrapers/shopify.js");
    const results = await scrapeShopify(MOCK_CONFIG);

    const validRoasts = ["Light", "Light-Medium", "Medium", "Medium-Dark", "Dark", null];
    for (const r of results) {
      expect(validRoasts).toContain(r.roast_level);
    }

    expect(results.find((r) => r.name.includes("One"))?.roast_level).toBe("Light");
    expect(results.find((r) => r.name.includes("Two"))?.roast_level).toBe("Medium-Dark");
  });

  it("skips non-coffee products", async () => {
    const products = [
      makeProduct({ handle: "coffee-1", title: "Great Filter Coffee", tags: ["coffee"] }),
      makeProduct({
        handle: "tote-bag",
        title: "The Tote Bag",
        tags: ["merch"],
        product_type: "",
      }),
      makeProduct({
        handle: "event",
        title: "Coffee Tasting Event",
        tags: ["events", "experiences"],
      }),
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse(products)));

    const { scrapeShopify } = await import("../scrapers/shopify.js");
    const results = await scrapeShopify(MOCK_CONFIG);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Great Filter Coffee");
  });

  it("skips products with zero price", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse([
          makeProduct({
            handle: "free-thing",
            title: "Free Coffee Sample",
            tags: ["coffee"],
            variants: [{ id: 1, title: "Sample", price: "0.00", available: true }],
          }),
        ])
      )
    );

    const { scrapeShopify } = await import("../scrapers/shopify.js");
    const results = await scrapeShopify(MOCK_CONFIG);
    expect(results.length).toBe(0);
  });

  it("extracts tasting notes from body_html", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeResponse([
          makeProduct({
            body_html: "<p>Tasting Notes: Citrus, Honey, Dark Chocolate</p>",
            tags: ["coffee"],
          }),
        ])
      )
    );

    const { scrapeShopify } = await import("../scrapers/shopify.js");
    const results = await scrapeShopify(MOCK_CONFIG);
    expect(results[0].tasting_notes).toContain("Citrus");
  });
});
