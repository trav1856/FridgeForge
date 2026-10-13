"use client";

import { FormEvent, useRef, useState } from "react";
import type { AdminProduct } from "@/lib/shared-products";

/** Moderate shared product records (first-save-wins barcode info + photo). */
export function AdminProductsPanel({ initial }: { initial: AdminProduct[] }) {
  const [products, setProducts] = useState(initial);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    const res = await fetch(`/api/admin/products?q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setProducts(data.products);
    else setMsg(data.error || "Search failed");
  }

  function replace(p: AdminProduct) {
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
  }

  return (
    <div className="space-y-4" data-testid="admin-products">
      <div className="card space-y-3 p-4">
        <div>
          <h2 className="font-display text-xl font-bold text-sage-900">Shared products</h2>
          <p className="text-sm text-sage-600">
            Barcode records shared by all kitchens. The first save wins; later edits by other
            households stay private to them. Edits here are logged.
          </p>
        </div>
        <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="Search name or barcode"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search shared products"
          />
          <button className="btn-secondary" type="submit">Search</button>
        </form>
        {msg && <p className="text-sm text-sage-700" role="status">{msg}</p>}
      </div>
      {products.length === 0 ? (
        <p className="card p-5 text-sm text-sage-600">No shared products yet.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {products.map((p) => (
            <ProductRow
              key={p.id}
              p={p}
              onSaved={(n) => { replace(n); setMsg(`Saved ${n.barcode}`); }}
              onDeleted={() => { setProducts((l) => l.filter((x) => x.id !== p.id)); setMsg(`Deleted ${p.barcode}`); }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductRow({
  p,
  onSaved,
  onDeleted,
}: {
  p: AdminProduct;
  onSaved: (p: AdminProduct) => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState({ name: p.name, size: p.size ?? "", unit: p.unit ?? "", category: p.category ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed");
      return data;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const d = await call(`/api/admin/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (d) onSaved({ ...p, ...d.product });
  }

  async function photo(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const d = await call(`/api/admin/products/${p.id}/photo`, { method: "POST", body: fd });
    if (d) onSaved({ ...p, ...d.product });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removePhoto() {
    const d = await call(`/api/admin/products/${p.id}/photo`, { method: "DELETE" });
    if (d) onSaved({ ...p, ...d.product });
  }

  async function del() {
    if (!confirm(`Delete the shared record for ${p.barcode}?`)) return;
    const d = await call(`/api/admin/products/${p.id}`, { method: "DELETE" });
    if (d) onDeleted();
  }

  return (
    <li className="card space-y-3 p-4" data-testid="admin-product" data-barcode={p.barcode}>
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream-100">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-xs text-sage-500">No photo</div>
          )}
        </div>
        <div className="min-w-0 text-xs text-sage-600">
          <p className="font-mono text-sm text-sage-900">{p.barcode}</p>
          <p>Created {new Date(p.createdAt).toLocaleString()}</p>
          <p className="truncate">By user {p.createdByUserId ?? "—"}</p>
          <p>{p.overrideCount} household override{p.overrideCount === 1 ? "" : "s"}</p>
        </div>
      </div>
      <form onSubmit={save} className="grid gap-2 sm:grid-cols-2">
        <label className="sm:col-span-2 text-xs text-sage-600">
          Name
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label className="text-xs text-sage-600">
          Size
          <input className="input" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
        </label>
        <label className="text-xs text-sage-600">
          Unit
          <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </label>
        <label className="sm:col-span-2 text-xs text-sage-600">
          Category
          <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </label>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <button className="btn-primary" type="submit" disabled={busy}>Save</button>
          <button className="btn-secondary" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
            Replace photo
          </button>
          {p.imageUrl && (
            <button className="btn-secondary" type="button" disabled={busy} onClick={() => void removePhoto()}>
              Remove photo
            </button>
          )}
          <button className="btn-ghost text-sm text-red-700" type="button" disabled={busy} onClick={() => void del()}>
            Delete record
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Replace product photo"
          onChange={(e) => void photo(e.target.files?.[0] ?? null)}
        />
      </form>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </li>
  );
}
