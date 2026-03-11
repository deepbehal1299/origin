"use client";

import { useEffect, useMemo, useState } from "react";
import { CoffeeCard } from "@/components/CoffeeCard";
import { fetchCoffees } from "@/lib/api";
import {
  addCompareId,
  getCompareIds,
  getRoastPreferences,
  getRoasterSettings,
  getSavedIds,
  toggleSavedId,
} from "@/lib/storage";
import { Coffee, ROAST_LEVELS, RoastLevel } from "@/lib/types";

export default function FeedPage() {
  const [mode, setMode] = useState<"live" | "mock">("live");
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selectedRoaster, setSelectedRoaster] = useState<string>("All");
  const [selectedRoasts, setSelectedRoasts] = useState<RoastLevel[]>([]);
  const [enabledRoasters, setEnabledRoasters] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setCompareIds(getCompareIds());
    setSavedIds(getSavedIds());
    setEnabledRoasters(getRoasterSettings());
    setSelectedRoasts(getRoastPreferences());
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

  const visibleCoffees = useMemo(() => {
    return coffees
      .filter((coffee) => enabledRoasters[coffee.roaster] ?? true)
      .filter((coffee) => (selectedRoaster === "All" ? true : coffee.roaster === selectedRoaster))
      .filter((coffee) => (selectedRoasts.length === 0 ? true : coffee.roast_level ? selectedRoasts.includes(coffee.roast_level) : false));
  }, [coffees, enabledRoasters, selectedRoaster, selectedRoasts]);

  const roasterOptions = useMemo(() => {
    const names = Array.from(new Set(coffees.map((coffee) => coffee.roaster)));
    return ["All", ...names];
  }, [coffees]);

  function onToggleRoast(roastLevel: RoastLevel) {
    setSelectedRoasts((previous) =>
      previous.includes(roastLevel)
        ? previous.filter((level) => level !== roastLevel)
        : [...previous, roastLevel]
    );
  }

  function handleToggleSaved(coffeeId: string) {
    setSavedIds(toggleSavedId(coffeeId));
  }

  function handleAddCompare(coffeeId: string) {
    const result = addCompareId(coffeeId);
    setCompareIds(result.ids);
    if (!result.added && result.reason === "limit") {
      setFeedback("You can compare up to 5 coffees.");
      return;
    }
    if (!result.added && result.reason === "duplicate") {
      setFeedback("Coffee is already in compare.");
      return;
    }
    setFeedback("Added to compare.");
  }

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Origin</h1>
        <p className="text-sm text-slate-600">Discover and compare coffees from specialty roasters.</p>
        {mode === "mock" ? (
          <p className="mt-2 inline-block rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
            UAT mock mode is active.
          </p>
        ) : null}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="roaster-filter">
            Roaster
          </label>
          <select
            id="roaster-filter"
            value={selectedRoaster}
            onChange={(event) => setSelectedRoaster(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {roasterOptions.map((roaster) => (
              <option key={roaster} value={roaster}>
                {roaster}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Roast level</p>
          <div className="flex flex-wrap gap-2">
            {ROAST_LEVELS.map((roastLevel) => {
              const selected = selectedRoasts.includes(roastLevel);
              return (
                <button
                  key={roastLevel}
                  type="button"
                  onClick={() => onToggleRoast(roastLevel)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {roastLevel}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {feedback ? <p className="text-sm text-slate-600">{feedback}</p> : null}

      {isLoading ? <p className="text-sm text-slate-600">Loading coffees...</p> : null}
      {error ? <p className="text-sm text-red-600">Unable to load coffees right now. {error}</p> : null}

      {!isLoading && !error && visibleCoffees.length === 0 ? (
        <p className="text-sm text-slate-600">No coffees found for the current filters.</p>
      ) : null}

      <section className="grid grid-cols-1 gap-4 pb-4">
        {visibleCoffees.map((coffee) => (
          <CoffeeCard
            key={coffee.id}
            coffee={coffee}
            isSaved={savedIds.includes(coffee.id)}
            isCompared={compareIds.includes(coffee.id)}
            onToggleSave={handleToggleSaved}
            onAddCompare={handleAddCompare}
          />
        ))}
      </section>
    </main>
  );
}
