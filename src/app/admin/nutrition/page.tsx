import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { ensureSnapshots, loadAllRecipesForSnapshots } from "@/lib/nutrition/snapshot";
import { NutritionAdminActions, ServingsFlagButton } from "@/components/admin/NutritionAdminActions";

export const dynamic = "force-dynamic";

const list = (s: string) => { try { return JSON.parse(s) as string[]; } catch { return []; } };

export default async function AdminNutritionPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdminPage();
  const show = (await searchParams).show === "untrusted" ? "untrusted" : "all";
  const recipes = await loadAllRecipesForSnapshots();
  const { snapshots } = await ensureSnapshots(recipes);
  const rows = recipes.map((r) => ({ r, s: snapshots.get(r.id)! }));
  const trusted = rows.filter((x) => x.s.trusted).length;
  const visible = show === "untrusted" ? rows.filter((x) => !x.s.trusted) : rows;
  return (
    <div className="space-y-5" data-testid="admin-nutrition">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-sage-900">Nutrition coverage</h1>
          <p className="text-sm text-sage-600">Per-serving estimates saved for each recipe. Only <b>trusted</b> recipes are used for diet-plan calorie math.</p>
        </div>
        <NutritionAdminActions />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="text-xs text-sage-600">Recipes</div><div className="text-2xl font-semibold text-sage-900">{rows.length}</div></div>
        <div className="card p-4"><div className="text-xs text-sage-600">Trusted</div><div className="text-2xl font-semibold text-sage-900" data-testid="nutrition-trusted">{trusted}</div></div>
        <div className="card p-4"><div className="text-xs text-sage-600">Untrusted</div><div className="text-2xl font-semibold text-ember-700" data-testid="nutrition-untrusted">{rows.length - trusted}</div></div>
      </div>
      <nav className="flex gap-2 text-sm">
        <Link href="/admin/nutrition" className={show === "all" ? "btn-primary px-3 py-1.5 text-sm" : "btn-secondary px-3 py-1.5 text-sm"}>All</Link>
        <Link href="/admin/nutrition?show=untrusted" className={show === "untrusted" ? "btn-primary px-3 py-1.5 text-sm" : "btn-secondary px-3 py-1.5 text-sm"} data-testid="show-untrusted">Untrusted only</Link>
      </nav>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm" data-testid="nutrition-table">
          <thead className="bg-cream-100 text-left text-xs text-sage-700">
            <tr><th className="px-3 py-2">Recipe</th><th className="px-3 py-2 text-right">Serv.</th><th className="px-3 py-2 text-right">kcal</th><th className="px-3 py-2 text-right">P / C / F g</th><th className="px-3 py-2 text-right">Matched</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Servings</th></tr>
          </thead>
          <tbody>
            {visible.map(({ r, s }) => (
              <tr key={r.id} className="border-t border-cream-200 align-top" data-testid="nutrition-row" data-trusted={s.trusted ? "1" : "0"}>
                <td className="px-3 py-2"><Link href={`/admin/recipes/${r.id}`} className="font-medium text-sage-900 hover:underline">{r.title}</Link>
                  {list(s.assumptions).length > 0 && <div className="mt-0.5 text-xs text-sage-500">{list(s.assumptions).join(" · ")}</div>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.servings}</td>
                <td className="px-3 py-2 text-right tabular-nums">{Math.round(s.kcal)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{Math.round(s.protein)} / {Math.round(s.carbs)} / {Math.round(s.fat)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.matchedCount}/{s.totalCount}</td>
                <td className="px-3 py-2">
                  {s.trusted ? <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-sage-800">Trusted</span> : <span className="rounded-full bg-ember-100 px-2 py-0.5 text-xs font-semibold text-ember-800">Untrusted</span>}
                  {list(s.reasons).map((x) => <div key={x} className="mt-1 text-xs text-sage-600">{x}</div>)}
                </td>
                <td className="px-3 py-2"><ServingsFlagButton recipeId={r.id} suspect={s.servingsSuspect} note={s.servingsNote} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
