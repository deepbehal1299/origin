"use client";

import { useEffect, useState } from "react";
import { getRoastPreferences, getRoasterSettings, setRoastPreferences, setRoasterEnabled } from "@/lib/storage";
import { ROAST_LEVELS, ROASTER_NAMES, RoastLevel } from "@/lib/types";

export default function SettingsPage() {
  const [roasterSettings, setRoasterSettings] = useState<Record<string, boolean>>({});
  const [roastPreferences, setRoastPreferenceState] = useState<RoastLevel[]>([]);

  useEffect(() => {
    setRoasterSettings(getRoasterSettings());
    setRoastPreferenceState(getRoastPreferences());
  }, []);

  function handleRoasterToggle(roasterName: string, enabled: boolean) {
    setRoasterSettings(setRoasterEnabled(roasterName, enabled));
  }

  function handleRoastPreferenceToggle(roastLevel: RoastLevel) {
    const next = roastPreferences.includes(roastLevel)
      ? roastPreferences.filter((value) => value !== roastLevel)
      : [...roastPreferences, roastLevel];

    setRoastPreferenceState(setRoastPreferences(next));
  }

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">Control enabled roasters and your roast preferences.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Roasters</h2>
        <ul className="space-y-3">
          {ROASTER_NAMES.map((name) => (
            <li key={name} className="flex items-center justify-between">
              <span className="text-sm text-slate-800">{name}</span>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={roasterSettings[name] ?? true}
                  onChange={(event) => handleRoasterToggle(name, event.target.checked)}
                />
                Enabled
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Preferred Roast Levels</h2>
        <div className="flex flex-wrap gap-2">
          {ROAST_LEVELS.map((roastLevel) => {
            const selected = roastPreferences.includes(roastLevel);
            return (
              <button
                key={roastLevel}
                type="button"
                onClick={() => handleRoastPreferenceToggle(roastLevel)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {roastLevel}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
