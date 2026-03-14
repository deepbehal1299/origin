"use client";

import { useEffect, useMemo, useState } from "react";
import { CoffeeCard } from "@/components/CoffeeCard";
import { loadCoffeeSnapshot } from "@/lib/coffee-data";
import {
  addCompareId,
  getCompareIds,
  getRoastPreferences,
  getRoasterSettings,
  getSavedIds,
  toggleSavedId,
} from "@/lib/storage";
import { AppStatus, Coffee, ROAST_LEVELS, RoastLevel } from "@/lib/types";

function formatLastUpdated(timestamp: string | null): string | null {
  if (!timestamp) {
    return null;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export default function FeedPage() {
  const [mode, setMode] = useState<"live" | "mock" | null>(null);
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selectedRoaster, setSelectedRoaster] = useState<string>("All");
  const [selectedRoasts, setSelectedRoasts] = useState<RoastLevel[]>([]);
  const [enabledRoasters, setEnabledRoasters] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setCompareIds(getCompareIds());
    setSavedIds(getSavedIds());
    setEnabledRoasters(getRoasterSettings());
    setSelectedRoasts(getRoastPreferences());
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
        setError("Sorry, we couldn't refresh the coffee list right now. Check back in a few hours.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadCoffees();
    return () => controller.abort();
  }, [mode, reloadKey]);

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

  const lastUpdatedLabel = useMemo(
    () => formatLastUpdated(appStatus?.lastSuccessfulScrapeAt ?? null),
    [appStatus]
  );

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

  function handleRetry() {
    setReloadKey((current) => current + 1);
  }

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Origin</h1>
        <p className="text-sm text-slate-600">Discover and compare coffees from specialty roasters.</p>
        {mode === "live" && lastUpdatedLabel ? (
          <p className="mt-2 text-xs text-slate-500">Last updated {lastUpdatedLabel}</p>
        ) : null}
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
      {!isLoading && error ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!isLoading && !error && coffees.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">No coffees are available right now. Check back in a few hours.</p>
        </div>
      ) : null}

      {!isLoading && !error && coffees.length > 0 && visibleCoffees.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">No coffees match your current filters or enabled roasters.</p>
        </div>
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
