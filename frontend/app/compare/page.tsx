"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadCoffeeSnapshot } from "@/lib/coffee-data";
import { getCompareIds, removeCompareId } from "@/lib/storage";
import { AppStatus, Coffee } from "@/lib/types";

function formatLastUpdated(timestamp: string | null): string | null {
  if (!timestamp) {
    return null;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export default function ComparePage() {
  const [mode, setMode] = useState<"live" | "mock" | null>(null);
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setCompareIds(getCompareIds());
    const query = new URLSearchParams(window.location.search);
    setMode(query.get("mock") === "1" ? "mock" : "live");
  }, []);

  useEffect(() => {
    if (mode === null) {
      return;
    }
    const resolvedMode = mode;

    const controller = new AbortController();

    async function loadCoffees() {
      setIsLoading(true);
      setError(null);
      try {
        const snapshot = await loadCoffeeSnapshot({
          signal: controller.signal,
          mode: resolvedMode,
          maxRetries: 2,
        });
        setCoffees(snapshot.coffees);
        setAppStatus(snapshot.status);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }
        setError("Sorry, we couldn't refresh compare right now. Check back in a few hours.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadCoffees();
    return () => controller.abort();
  }, [mode, reloadKey]);

  const comparedCoffees = useMemo(() => {
    const coffeeMap = new Map(coffees.map((coffee) => [coffee.id, coffee]));
    return compareIds.map((id) => coffeeMap.get(id)).filter((coffee): coffee is Coffee => Boolean(coffee));
  }, [coffees, compareIds]);

  const lastUpdatedLabel = useMemo(
    () => formatLastUpdated(appStatus?.lastSuccessfulScrapeAt ?? null),
    [appStatus]
  );

  function handleRemove(id: string) {
    setCompareIds(removeCompareId(id));
  }

  function handleRetry() {
    setReloadKey((current) => current + 1);
  }

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Compare</h1>
        <p className="text-sm text-slate-600">Compare up to 5 coffees side-by-side.</p>
        {mode === "live" && lastUpdatedLabel ? (
          <p className="mt-2 text-xs text-slate-500">Last updated {lastUpdatedLabel}</p>
        ) : null}
        {mode === "mock" ? (
          <p className="mt-2 inline-block rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
            UAT mock mode is active.
          </p>
        ) : null}
      </header>

      {isLoading ? <p className="text-sm text-slate-600">Loading compare data...</p> : null}
      {!isLoading && error ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">{error}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            >
              Try again
            </button>
            <Link
              href={mode === "mock" ? "/?mock=1" : "/"}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Go to Feed
            </Link>
          </div>
        </div>
      ) : null}

      {!isLoading && !error && comparedCoffees.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm text-slate-600">Add coffees from the Feed to compare.</p>
          <Link
            href={mode === "mock" ? "/?mock=1" : "/"}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
          >
            Go to Feed
          </Link>
        </div>
      ) : null}

      {comparedCoffees.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2">Coffee Name</th>
                <th className="px-3 py-2">Brand</th>
                <th className="px-3 py-2">Roast Level</th>
                <th className="px-3 py-2">Tasting Notes</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Buy</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {comparedCoffees.map((coffee) => (
                <tr key={coffee.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">{coffee.name}</td>
                  <td className="px-3 py-2">{coffee.roaster}</td>
                  <td className="px-3 py-2">{coffee.roast_level ?? "—"}</td>
                  <td className="px-3 py-2">{coffee.tasting_notes ?? "—"}</td>
                  <td className="max-w-xs px-3 py-2">{coffee.description ?? "—"}</td>
                  <td className="px-3 py-2">INR {coffee.price}</td>
                  <td className="px-3 py-2">
                    <a
                      href={coffee.product_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-slate-900 underline"
                    >
                      Buy
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleRemove(coffee.id)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
