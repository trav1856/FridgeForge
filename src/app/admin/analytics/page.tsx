import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { DIMENSIONS, currentReport, type Cell, type Dimension } from "@/lib/demographics/analytics";

export const dynamic = "force-dynamic";

const fmt = (n: number | null) => (n === null ? <span className="text-sage-500" title="Fewer than 20 users">&lt;20</span> : n.toLocaleString());

function CellView({ c }: { c: Cell | undefined }) {
  if (!c) return <td className="px-2 py-1.5 text-right">–</td>;
  return (
    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
      {fmt(c.views)} <span className="text-sage-500">/</span> {fmt(c.favorites)}
    </td>
  );
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ dim?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const dim: Dimension = (DIMENSIONS.find((d) => d.id === sp.dim)?.id ?? "sex") as Dimension;
  const r = await currentReport();
  const block = r.dimensions[dim];
  const cuisines = r.cuisines.slice(0, 12);
  return (
    <div className="space-y-5" data-testid="admin-analytics">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-sage-900">Analytics</h1>
          <p className="text-sm text-sage-600">
            Recipe views and favorites by cuisine. Consenting users aged 16+ only. Anything backed by fewer than {r.k} users is suppressed.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/admin/analytics/export?format=pdf" className="btn-primary text-sm" data-testid="export-pdf">Executive summary (PDF)</a>
          <a href="/api/admin/analytics/export?format=csv" className="btn-secondary text-sm" data-testid="export-csv">CSV</a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="text-xs text-sage-600">Eligible cohort</div><div className="text-2xl font-semibold text-sage-900" data-testid="cohort-size">{r.cohortSize === null ? `<${r.k}` : r.cohortSize}</div></div>
        <div className="card p-4"><div className="text-xs text-sage-600">Cuisines with activity</div><div className="text-2xl font-semibold text-sage-900">{r.cuisines.length}</div></div>
        <div className="card p-4"><div className="text-xs text-sage-600">k-anonymity threshold</div><div className="text-2xl font-semibold text-sage-900">{r.k} users</div></div>
      </div>

      {r.cohortSize === null ? (
        <div className="card p-5 text-sm text-sage-700" data-testid="analytics-suppressed">Fewer than {r.k} users have opted in so far, so nothing can be reported yet.</div>
      ) : (
        <>
          <section className="card overflow-x-auto p-4">
            <h2 className="mb-2 font-semibold text-sage-900">All eligible users <span className="text-xs font-normal text-sage-600">views / favorites</span></h2>
            <table className="text-sm" data-testid="overall-table">
              <thead><tr>{cuisines.map((c) => <th key={c} className="px-2 py-1 text-right font-medium text-sage-700">{c}</th>)}</tr></thead>
              <tbody><tr>{cuisines.map((c) => <CellView key={c} c={r.overall[c]} />)}</tr></tbody>
            </table>
          </section>

          <nav className="flex flex-wrap gap-2" aria-label="Breakdown">
            {DIMENSIONS.map((d) => (
              <Link key={d.id} href={`/admin/analytics?dim=${d.id}`} className={d.id === dim ? "btn-primary px-3 py-1.5 text-sm" : "btn-secondary px-3 py-1.5 text-sm"} data-testid={`dim-${d.id}`}>{d.label}</Link>
            ))}
          </nav>

          <section className="card overflow-x-auto p-4">
            <h2 className="mb-2 font-semibold text-sage-900">By {block.label.toLowerCase()} <span className="text-xs font-normal text-sage-600">views / favorites</span></h2>
            {block.groups.length === 0 ? (
              <p className="text-sm text-sage-600">No group has {r.k}+ users yet.</p>
            ) : (
              <table className="text-sm" data-testid="breakdown-table">
                <thead><tr><th className="px-2 py-1 text-left font-medium text-sage-700">Group</th><th className="px-2 py-1 text-right font-medium text-sage-700">Users</th>{cuisines.map((c) => <th key={c} className="px-2 py-1 text-right font-medium text-sage-700">{c}</th>)}</tr></thead>
                <tbody>
                  {block.groups.map((g) => (
                    <tr key={g.key} className="border-t border-cream-200" data-testid="group-row">
                      <td className="whitespace-nowrap px-2 py-1.5 font-medium text-sage-900">{g.label}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{g.size}</td>
                      {cuisines.map((c) => <CellView key={c} c={g.cells[c]} />)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {block.suppressedGroups > 0 && <p className="mt-2 text-xs text-sage-600" data-testid="suppressed-groups">{block.suppressedGroups} group(s) with fewer than {r.k} users are hidden.</p>}
          </section>
        </>
      )}
    </div>
  );
}
