"use client";

import { useEffect, useMemo, useState } from "react";
import { CONSENT_TEXT, COUNTRIES, ETHNICITIES } from "@/lib/demographics/options";

type D = { sex: "male" | "female" | null; ethnicities: string[]; originCountries: string[]; researchConsent: boolean; ageConfirmed: boolean };

export function PrivateDetails() {
  const [d, setD] = useState<D | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/account/demographics", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((x) => x && setD(x)).catch(() => {});
  }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(s) && !d?.originCountries.includes(c.code)).slice(0, 8) : [];
  }, [q, d?.originCountries]);

  if (!d) return null;
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const needDob = d.researchConsent && !d.ageConfirmed;

  async function save() {
    if (!d) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/account/demographics", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sex: d.sex ?? "", ethnicities: d.ethnicities, originCountries: d.originCountries, researchConsent: d.researchConsent, ...(needDob && birthDate ? { birthDate } : {}) }),
      });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ ok: false, text: x.error ?? "Couldn't save." }); return; }
      setD(x); setBirthDate(""); setMsg({ ok: true, text: "Saved privately." });
    } finally { setBusy(false); }
  }

  return (
    <section className="card space-y-4 p-5" data-testid="private-details">
      <div>
        <h2 className="font-display text-xl font-semibold text-sage-900">Private details <span className="text-sm font-normal text-sage-600">(optional)</span></h2>
        <p className="text-sm text-sage-600">Only you can see these. They are never shown on your profile or anywhere public.</p>
      </div>

      <label className="block">
        <span className="label">Sex</span>
        <select className="input max-w-xs" value={d.sex ?? ""} onChange={(e) => setD({ ...d, sex: (e.target.value || null) as D["sex"] })} data-testid="demo-sex">
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>

      <fieldset>
        <legend className="label">Ethnicity / heritage <span className="font-normal text-sage-600">(pick any)</span></legend>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3" data-testid="demo-ethnicities">
          {ETHNICITIES.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={d.ethnicities.includes(e.id)} onChange={() => setD({ ...d, ethnicities: toggle(d.ethnicities, e.id) })} value={e.id} />
              {e.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <span className="label">Family-origin countries <span className="font-normal text-sage-600">(pick any)</span></span>
        <div className="mb-2 flex flex-wrap gap-2" data-testid="demo-countries">
          {d.originCountries.map((c) => (
            <button key={c} type="button" className="rounded-full bg-cream-200 px-3 py-1 text-sm" onClick={() => setD({ ...d, originCountries: d.originCountries.filter((x) => x !== c) })} aria-label={`Remove ${COUNTRIES.find((x) => x.code === c)?.name ?? c}`}>
              {COUNTRIES.find((x) => x.code === c)?.name ?? c} ×
            </button>
          ))}
          {!d.originCountries.length && <span className="text-sm text-sage-600">None selected</span>}
        </div>
        <input className="input max-w-xs" placeholder="Search countries…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="demo-country-search" disabled={d.originCountries.length >= 12} />
        {matches.length > 0 && (
          <ul className="mt-1 max-w-xs rounded-xl border border-cream-300 bg-white text-sm shadow-sm">
            {matches.map((c) => (
              <li key={c.code}>
                <button type="button" className="w-full px-3 py-1.5 text-left hover:bg-cream-100" onClick={() => { setD({ ...d, originCountries: [...d.originCountries, c.code] }); setQ(""); }}>{c.name}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-cream-300 bg-cream-50 p-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={d.researchConsent} onChange={(e) => setD({ ...d, researchConsent: e.target.checked })} data-testid="demo-consent" />
          <span>{CONSENT_TEXT}</span>
        </label>
        <p className="mt-1 pl-6 text-xs text-sage-600">Optional, 16+ only. Uncheck any time to opt out. <a href="/privacy" className="underline">Privacy policy</a></p>
        {needDob && (
          <label className="mt-2 block pl-6">
            <span className="text-xs font-medium text-sage-800">Confirm you're 16 or older (your date of birth is checked, not stored)</span>
            <input type="date" className="input mt-1 max-w-xs" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} aria-label="Date of birth" data-testid="demo-dob" />
          </label>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary text-sm" onClick={save} disabled={busy} data-testid="demo-save">{busy ? "Saving…" : "Save private details"}</button>
        {msg && <span className={msg.ok ? "text-sm text-sage-700" : "text-sm font-medium text-ember-700"} data-testid="demo-msg">{msg.text}</span>}
      </div>
    </section>
  );
}
