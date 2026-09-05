"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function CouponCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    brand: "",
    title: "",
    discountText: "",
    terms: "Demo coupon. One use per household. Not a real manufacturer offer.",
    codeValue: "",
    codeType: "qr" as "qr" | "barcode",
    expiresAt: "",
    clipped: true,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          expiresAt: form.expiresAt
            ? new Date(form.expiresAt).toISOString()
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Create failed");
      router.push(`/coupons/${data.id}`);
    } catch {
      setError("Could not create coupon");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3 p-4 sm:p-5">
      <p className="text-sm text-sage-600">
        Local demo form — no manufacturer login. For roadmap: real brand portal
        and GS1 coupon standards.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Brand</label>
          <input
            className="input"
            required
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            placeholder="Acme Foods"
          />
        </div>
        <div>
          <label className="label">Discount text</label>
          <input
            className="input"
            required
            value={form.discountText}
            onChange={(e) => setForm({ ...form, discountText: e.target.value })}
            placeholder="$1.00 OFF"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <input
            className="input"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Any Acme pasta sauce"
          />
        </div>
        <div>
          <label className="label">Code type</label>
          <select
            className="input"
            value={form.codeType}
            onChange={(e) =>
              setForm({
                ...form,
                codeType: e.target.value as "qr" | "barcode",
              })
            }
          >
            <option value="qr">QR</option>
            <option value="barcode">Barcode (Code128)</option>
          </select>
        </div>
        <div>
          <label className="label">Expires</label>
          <input
            className="input"
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Code value</label>
          <input
            className="input"
            required
            value={form.codeValue}
            onChange={(e) => setForm({ ...form, codeValue: e.target.value })}
            placeholder="DEMO-ACME-100OFF or UPC digits"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Terms</label>
          <textarea
            className="input min-h-[80px]"
            value={form.terms}
            onChange={(e) => setForm({ ...form, terms: e.target.value })}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Create coupon"}
        </button>
        <Link href="/coupons" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
