"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileEditor, type EditableProfile } from "@/components/content/ProfileEditor";
import { ChefAvatar } from "@/components/content/ChefAvatar";
import { jsonFetch } from "@/components/content/api";

type Chef = EditableProfile & {
  id: string;
  slug: string;
  hidden: boolean;
  featuredAt: string | null;
  account: { id: string; label: string } | null;
  recipeIds: string[];
  posts: number;
  pinId: string | null;
};

const EMPTY: EditableProfile = { name: "", bio: null, photoUrl: null, credentials: [], links: [], youtubeUrl: null };

export function AdminChefsPanel({ chefs, recipes }: { chefs: Chef[]; recipes: { id: string; title: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="admin-chefs">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-sage-900">Chefs</h2>
          <p className="text-xs text-sage-600">
            Chef accounts manage their own profile (flag them on the user page). Add a chef without an account here.
            Featured or pinned chefs appear at the top of Chef&apos;s Corner (newest 3).
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreating((v) => !v)} data-testid="chef-new">
          {creating ? "Close" : "Add chef"}
        </button>
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.text}</p>}
      {creating && (
        <div className="card p-5">
          <h3 className="mb-3 font-semibold text-sage-900">New chef (no account)</h3>
          <ProfileEditor initial={EMPTY} endpoint="/api/admin/chefs" method="POST" submitLabel="Create chef" onSaved={() => setCreating(false)} />
        </div>
      )}
      {chefs.length === 0 ? (
        <p className="card p-6 text-sm text-sage-600">No chefs yet.</p>
      ) : (
        <ul className="space-y-3">
          {chefs.map((c) => (
            <li key={c.id} className="card p-4" data-testid="admin-chef-row" data-id={c.id}>
              <div className="flex flex-wrap items-center gap-3">
                <ChefAvatar name={c.name} photoUrl={c.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/chefs/${c.slug}`} className="font-semibold text-sage-900 hover:text-ember-700">{c.name}</Link>
                  <div className="text-xs text-sage-500">
                    {c.account ? <>Chef account · <Link className="hover:underline" href={`/admin/users/${c.account.id}`}>{c.account.label}</Link></> : "Admin-managed"}
                    {" · "}{c.recipeIds.length} recipes · {c.posts} posts
                    {c.hidden && " · hidden"}
                    {c.featuredAt && " · featured"}
                    {c.pinId && " · pinned"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className="btn-secondary px-3 py-1.5 text-[13px]" disabled={busy} data-testid="chef-feature"
                    onClick={() => run(() => jsonFetch(`/api/admin/chefs/${c.id}`, "PATCH", { featured: !c.featuredAt }), c.featuredAt ? "Unfeatured." : "Featured.")}>
                    {c.featuredAt ? "Unfeature" : "Feature"}
                  </button>
                  <button type="button" className="btn-secondary px-3 py-1.5 text-[13px]" disabled={busy || c.hidden} data-testid="chef-pin"
                    onClick={() => run(() => (c.pinId ? jsonFetch(`/api/admin/pins?pinId=${c.pinId}`, "DELETE") : jsonFetch("/api/admin/pins", "POST", { kind: "profile", refId: c.id })), c.pinId ? "Unpinned." : "Pinned to home.")}>
                    {c.pinId ? "Unpin" : "Pin to home"}
                  </button>
                  <button type="button" className="btn-ghost px-3 py-1.5 text-[13px]" onClick={() => setOpen(open === c.id ? null : c.id)} data-testid="chef-edit">
                    {open === c.id ? "Close" : "Edit"}
                  </button>
                  {!c.account && (
                    <button type="button" className="btn-ghost px-3 py-1.5 text-[13px] text-red-700" disabled={busy} data-testid="chef-delete"
                      onClick={() => window.confirm(`Delete ${c.name}? Their recipes stay but lose the credit.`) && run(() => jsonFetch(`/api/admin/chefs/${c.id}`, "DELETE"), "Deleted.")}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {open === c.id && (
                <div className="mt-4 grid gap-6 border-t border-cream-200 pt-4 lg:grid-cols-2">
                  <ProfileEditor initial={c} endpoint={`/api/admin/chefs/${c.id}`} method="PATCH" />
                  <RecipeCredits chef={c} recipes={recipes} onSave={(ids) => run(() => jsonFetch(`/api/admin/chefs/${c.id}`, "PATCH", { recipeIds: ids }), "Recipe credits saved.")} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecipeCredits({ chef, recipes, onSave }: { chef: Chef; recipes: { id: string; title: string }[]; onSave: (ids: string[]) => void }) {
  const [sel, setSel] = useState<string[]>(chef.recipeIds);
  const [q, setQ] = useState("");
  const shown = recipes.filter((r) => sel.includes(r.id) || !q || r.title.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  return (
    <div>
      <h4 className="text-sm font-semibold text-sage-900">Credited recipes</h4>
      <p className="text-xs text-sage-600">
        {chef.account ? "A chef account's own public recipes are credited automatically; add others here." : "Public recipes credited to this chef get the Featured Chef badge."}
      </p>
      <input className="input mt-2" placeholder="Search public recipes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />
      <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-cream-300 bg-white p-2 text-sm">
        {shown.map((r) => (
          <li key={r.id}>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel((cur) => (e.target.checked ? [...cur, r.id] : cur.filter((x) => x !== r.id)))} data-testid="credit-recipe" data-id={r.id} />
              {r.title}
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-secondary mt-2" onClick={() => onSave(sel)} data-testid="credit-save">Save credits</button>
    </div>
  );
}
