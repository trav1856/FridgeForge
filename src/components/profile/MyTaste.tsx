"use client";

import { useEffect, useState } from "react";

type Row = { cuisine: string; views: number; recipes: number; favorites: number; score: number };

export function MyTaste() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = () => fetch("/api/account/taste", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((x) => x && setRows(x.cuisines)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!rows) return null;
  const top = rows.slice(0, 8);
  const max = Math.max(1, ...top.map((r) => r.score));
  async function clear() {
    if (!confirm("Clear your recipe-view history? Favorites stay.")) return;
    await fetch("/api/account/taste", { method: "DELETE" });
    load();
  }
  return (
    <section className="card space-y-3 p-5" data-testid="my-taste">
      <div>
        <h2 className="font-display text-xl font-semibold text-sage-900">My taste</h2>
        <p className="text-sm text-sage-600">Your top cuisines from recipes you open and favorite. Only you can see this.</p>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-sage-600">Open or favorite a few recipes and your top cuisines will show up here.</p>
      ) : (
        <ol className="space-y-2">
          {top.map((r) => (
            <li key={r.cuisine} className="text-sm" data-testid="taste-row">
              <div className="flex justify-between"><span className="font-medium text-sage-900">{r.cuisine}</span><span className="text-sage-600">{r.views} view{r.views === 1 ? "" : "s"} · {r.favorites} favorite{r.favorites === 1 ? "" : "s"}</span></div>
              <div className="mt-1 h-2 rounded-full bg-cream-200"><div className="h-2 rounded-full bg-ember-500" style={{ width: `${Math.round((r.score / max) * 100)}%` }} /></div>
            </li>
          ))}
        </ol>
      )}
      {rows.some((r) => r.views > 0) && <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={clear} data-testid="taste-clear">Clear view history</button>}
    </section>
  );
}
