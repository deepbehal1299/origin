import { Coffee } from "@/lib/types";

const DEFAULT_API_URL = "http://localhost:4000";
const LOCAL_MOCK_ENDPOINT = "/api/mock/coffees";

export type DataMode = "live" | "mock";

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<Coffee[]> {
  const response = await fetch(url, {
    method: "GET",
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch coffees. Status: ${response.status}`);
  }

  const data = (await response.json()) as Coffee[];
  return Array.isArray(data) ? data : [];
}

export async function fetchCoffees(options?: { signal?: AbortSignal; mode?: DataMode }): Promise<Coffee[]> {
  const mode = options?.mode ?? "live";

  if (mode === "mock") {
    return fetchJson(LOCAL_MOCK_ENDPOINT, options?.signal);
  }

  return fetchJson(`${getApiBaseUrl()}/coffees`, options?.signal);
}

