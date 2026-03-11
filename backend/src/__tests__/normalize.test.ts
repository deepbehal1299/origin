import { describe, it, expect } from "vitest";
import { normalizeRoastLevel, stripHtml } from "../scrapers/normalize.js";

describe("normalizeRoastLevel", () => {
  it("returns exact match for canonical values", () => {
    expect(normalizeRoastLevel("Light")).toBe("Light");
    expect(normalizeRoastLevel("Medium")).toBe("Medium");
    expect(normalizeRoastLevel("Dark")).toBe("Dark");
    expect(normalizeRoastLevel("Light-Medium")).toBe("Light-Medium");
    expect(normalizeRoastLevel("Medium-Dark")).toBe("Medium-Dark");
  });

  it("normalizes case-insensitive input", () => {
    expect(normalizeRoastLevel("light")).toBe("Light");
    expect(normalizeRoastLevel("MEDIUM")).toBe("Medium");
    expect(normalizeRoastLevel("dark")).toBe("Dark");
  });

  it("handles multi-word patterns with hyphens and spaces", () => {
    expect(normalizeRoastLevel("Light Medium")).toBe("Light-Medium");
    expect(normalizeRoastLevel("light-medium")).toBe("Light-Medium");
    expect(normalizeRoastLevel("medium dark")).toBe("Medium-Dark");
    expect(normalizeRoastLevel("Medium-Dark")).toBe("Medium-Dark");
  });

  it("handles abbreviated patterns (Grey Soul style)", () => {
    expect(normalizeRoastLevel("Light-Med Roast")).toBe("Light-Medium");
    expect(normalizeRoastLevel("Med-Dark Profile")).toBe("Medium-Dark");
    expect(normalizeRoastLevel("Ultra-Light Roast")).toBe("Light");
    expect(normalizeRoastLevel("Med Roast")).toBe("Medium");
  });

  it("extracts roast from title text", () => {
    expect(normalizeRoastLevel("Kolli Berry Estate - Light Roast")).toBe("Light");
    expect(normalizeRoastLevel("Shevaroys Washed (Light-Med Roast)")).toBe("Light-Medium");
    expect(normalizeRoastLevel("High Grown Espresso (Med-Dark Profile)")).toBe("Medium-Dark");
  });

  it("extracts roast from URL path", () => {
    expect(normalizeRoastLevel("/product/our-coffees/marcs-signature-blends/dark-roast/old-kent-estate/")).toBe("Dark");
    expect(normalizeRoastLevel("/product/our-coffees/marcs-single-estate-origin/medium-dark-roast/sandalkad/")).toBe("Medium-Dark");
    expect(normalizeRoastLevel("/product/our-coffees/marcs-signature-blends/light-roast/genesis/")).toBe("Light");
  });

  it("returns null for no match", () => {
    expect(normalizeRoastLevel("")).toBeNull();
    expect(normalizeRoastLevel(null)).toBeNull();
    expect(normalizeRoastLevel(undefined)).toBeNull();
    expect(normalizeRoastLevel("just some random text")).toBeNull();
  });

  it("prefers multi-word match over partial single-word", () => {
    expect(normalizeRoastLevel("medium dark roast")).toBe("Medium-Dark");
    expect(normalizeRoastLevel("light medium roast")).toBe("Light-Medium");
  });
});

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<p>Hello <strong>World</strong></p>")).toBe("Hello World");
  });

  it("decodes common entities", () => {
    expect(stripHtml("coffee &amp; tea")).toBe("coffee & tea");
    expect(stripHtml("&lt;b&gt;bold&lt;/b&gt;")).toBe("<b>bold</b>");
    expect(stripHtml("it&#39;s fine")).toBe("it's fine");
  });

  it("collapses whitespace", () => {
    expect(stripHtml("<p>  spaced   out  </p>")).toBe("spaced out");
  });

  it("handles empty and plain text", () => {
    expect(stripHtml("")).toBe("");
    expect(stripHtml("no tags here")).toBe("no tags here");
  });
});
