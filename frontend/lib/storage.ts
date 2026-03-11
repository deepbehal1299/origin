import { ROAST_LEVELS, ROASTER_NAMES, RoastLevel } from "@/lib/types";

const KEYS = {
  compare: "origin_compare",
  roasters: "origin_roasters",
  roastPreferences: "origin_roast_preferences",
  saved: "origin_saved",
} as const;

const MAX_COMPARE_ITEMS = 5;

const hasWindow = () => typeof window !== "undefined";

function readJson<T>(key: string, fallback: T): T {
  if (!hasWindow()) {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    if (!value) {
      return fallback;
    }
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!hasWindow()) {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function uniqStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.filter((value): value is string => typeof value === "string")));
}

export function getCompareIds(): string[] {
  return uniqStringArray(readJson<unknown>(KEYS.compare, [])).slice(0, MAX_COMPARE_ITEMS);
}

export function setCompareIds(ids: string[]): string[] {
  const nextIds = Array.from(new Set(ids)).slice(0, MAX_COMPARE_ITEMS);
  writeJson(KEYS.compare, nextIds);
  return nextIds;
}

export function addCompareId(id: string): { ids: string[]; added: boolean; reason?: "limit" | "duplicate" } {
  const current = getCompareIds();
  if (current.includes(id)) {
    return { ids: current, added: false, reason: "duplicate" };
  }
  if (current.length >= MAX_COMPARE_ITEMS) {
    return { ids: current, added: false, reason: "limit" };
  }

  const next = [...current, id];
  setCompareIds(next);
  return { ids: next, added: true };
}

export function removeCompareId(id: string): string[] {
  const next = getCompareIds().filter((existing) => existing !== id);
  setCompareIds(next);
  return next;
}

export function getSavedIds(): string[] {
  return uniqStringArray(readJson<unknown>(KEYS.saved, []));
}

export function toggleSavedId(id: string): string[] {
  const current = getSavedIds();
  const next = current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id];
  writeJson(KEYS.saved, next);
  return next;
}

export function getRoasterSettings(): Record<string, boolean> {
  const saved = readJson<Record<string, unknown>>(KEYS.roasters, {});
  const defaults = Object.fromEntries(ROASTER_NAMES.map((name) => [name, true]));
  return ROASTER_NAMES.reduce<Record<string, boolean>>((acc, name) => {
    const rawValue = saved[name];
    acc[name] = typeof rawValue === "boolean" ? rawValue : defaults[name];
    return acc;
  }, {});
}

export function setRoasterEnabled(roasterName: string, enabled: boolean): Record<string, boolean> {
  const current = getRoasterSettings();
  const next = { ...current, [roasterName]: enabled };
  writeJson(KEYS.roasters, next);
  return next;
}

export function getRoastPreferences(): RoastLevel[] {
  const saved = uniqStringArray(readJson<unknown>(KEYS.roastPreferences, []));
  const allowed = new Set<string>(ROAST_LEVELS);
  return saved.filter((value): value is RoastLevel => allowed.has(value));
}

export function setRoastPreferences(preferences: RoastLevel[]): RoastLevel[] {
  const allowed = new Set<string>(ROAST_LEVELS);
  const next = Array.from(new Set(preferences)).filter((value): value is RoastLevel => allowed.has(value));
  writeJson(KEYS.roastPreferences, next);
  return next;
}
