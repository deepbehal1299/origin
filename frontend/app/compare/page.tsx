"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchCoffees } from "@/lib/api";
import { getCompareIds, removeCompareId } from "@/lib/storage";
import { Coffee } from "@/lib/types";

export default function ComparePage() {
  const [mode, setMode] = useState<"live" | "mock">("live");
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCompareIds(getCompareIds());
    const query = new URLSearchParams(window.location.search);
    setMode(query.get("mock") === "1" ? "mock" : "live");
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCoffees() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchCoffees({ signal: controller.signal, mode });
        setCoffees(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to fetch coffees.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCoffees();
    return () => controller.abort();
  }, [mode]);

  const comparedCoffees = useMemo(() => {
    const coffeeMap = new Map(coffees.map((coffee) => [coffee.id, coffee]));
    return compareIds.map((id) => coffeeMap.get(id)).filter((coffee): coffee is Coffee => Boolean(coffee));
  }, [coffees, compareIds]);

  function handleRemove(id: string) {
    setCompareIds(removeCompareId(id));
  }

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Compare</h1>
        <p className="text-sm text-slate-600">Compare up to 5 coffees side-by-side.</p>
        {mode === "mock" ? (
          <p className="mt-2 inline-block rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
            UAT mock mode is active.
          </p>
        ) : null}
      </header>

      {isLoading ? <p className="text-sm text-slate-600">Loading compare data...</p> : null}
      {error ? <p className="text-sm text-red-600">Unable to load compare data. {error}</p> : null}

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
