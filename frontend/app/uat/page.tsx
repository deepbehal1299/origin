import Link from "next/link";

const CHECKLIST = [
  "Feed loads coffee cards in mock mode.",
  "Roast and roaster filters work on Feed.",
  "Save toggles and persists after refresh.",
  "Compare allows up to 5 coffees only.",
  "Compare table shows all required fields.",
  "Settings toggles persist and affect Feed.",
  "Buy opens product links in new tab.",
];

export default function UatPage() {
  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">UAT Preview</h1>
        <p className="text-sm text-slate-600">
          Use this page to test the frontend with mock coffee data without backend dependency.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Start Testing</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/?mock=1" className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800">
            Open Feed (Mock)
          </Link>
          <Link
            href="/compare?mock=1"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Open Compare (Mock)
          </Link>
          <Link
            href="/settings?mock=1"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Open Settings
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">UAT Checklist</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          {CHECKLIST.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
