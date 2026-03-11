"use client";

import { Coffee } from "@/lib/types";

interface CoffeeCardProps {
  coffee: Coffee;
  isSaved: boolean;
  isCompared: boolean;
  onToggleSave: (coffeeId: string) => void;
  onAddCompare: (coffeeId: string) => void;
}

export function CoffeeCard({ coffee, isSaved, isCompared, onToggleSave, onAddCompare }: CoffeeCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        {coffee.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coffee.image_url}
            alt={coffee.name}
            className="h-16 w-16 rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">
            No image
          </div>
        )}

        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-900">{coffee.name}</h2>
          <p className="text-sm text-slate-600">{coffee.roaster}</p>
          <p className="text-sm text-slate-600">Roast: {coffee.roast_level ?? "—"}</p>
        </div>
      </div>

      <p className="mb-2 line-clamp-2 text-sm text-slate-700">Notes: {coffee.tasting_notes ?? "—"}</p>
      <p className="mb-4 text-base font-semibold text-slate-900">INR {coffee.price}</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onToggleSave(coffee.id)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {isSaved ? "Saved" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => onAddCompare(coffee.id)}
          disabled={isCompared}
          className={`rounded-md px-3 py-2 text-sm ${
            isCompared ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {isCompared ? "In Compare" : "Compare"}
        </button>

        <a
          href={coffee.product_url}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Buy
        </a>
      </div>
    </article>
  );
}
