import { fetchAppStatus, fetchCoffees, type DataMode } from "@/lib/api";
import { AppStatus, Coffee } from "@/lib/types";

const BASE_RETRY_DELAY_MS = process.env.NODE_ENV === "test" ? 0 : 400;

export interface CoffeeSnapshot {
  coffees: Coffee[];
  status: AppStatus;
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    function onAbort() {
      window.clearTimeout(timeoutId);
      reject(new Error("Request aborted"));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function loadCoffeeSnapshot(options?: {
  signal?: AbortSignal;
  mode?: DataMode;
  maxRetries?: number;
}): Promise<CoffeeSnapshot> {
  const mode = options?.mode ?? "live";
  const maxRetries = mode === "live" ? (options?.maxRetries ?? 2) : 0;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const [coffees, status] = await Promise.all([
        fetchCoffees({ signal: options?.signal, mode }),
        fetchAppStatus({ signal: options?.signal, mode }),
      ]);

      return { coffees, status };
    } catch (error) {
      lastError = error;
      if (options?.signal?.aborted || attempt === maxRetries) {
        throw error;
      }

      await wait(BASE_RETRY_DELAY_MS * (attempt + 1), options?.signal);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to load coffee data.");
}
