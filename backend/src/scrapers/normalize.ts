import type { RoastLevel } from "../types.js";
import { ROAST_LEVELS } from "../types.js";

const ROAST_PATTERNS: Array<{ pattern: RegExp; level: RoastLevel }> = [
  { pattern: /\blight[\s-]*medium\b/i, level: "Light-Medium" },
  { pattern: /\bmedium[\s-]*dark\b/i, level: "Medium-Dark" },
  { pattern: /\blight\b/i, level: "Light" },
  { pattern: /\bmedium\b/i, level: "Medium" },
  { pattern: /\bdark\b/i, level: "Dark" },
];

/**
 * Try to extract a canonical RoastLevel from a free-text source.
 * Check multi-word patterns first to avoid "Medium" matching "Medium-Dark".
 */
export function normalizeRoastLevel(text: string | null | undefined): RoastLevel | null {
  if (!text) return null;

  const exact = ROAST_LEVELS.find(
    (r) => r.toLowerCase() === text.trim().toLowerCase()
  );
  if (exact) return exact;

  for (const { pattern, level } of ROAST_PATTERNS) {
    if (pattern.test(text)) return level;
  }

  return null;
}

/**
 * Strip HTML tags and decode common entities.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
