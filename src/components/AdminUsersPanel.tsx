"use client";

import { useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  role: string;
  disabled: boolean;
  createdAt: string;
  householdCount: number;
  reviewCount: number;
};

type Props = { initial: UserRow[] };

export function AdminUsersPanel({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          typeof data.error === "string" ? data.error : "Update failed"
        );
        return;
      }
      const u = data.user;
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                role: u.role,
                disabled: u.disabled,
                plan: u.plan,
              }
            : r
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-sage-600">
        Set role (admin / user) or soft-disable accounts. Disabled users cannot
        sign in.
      </p>
      {status && <p className="text-sm text-ember-700">{status}</p>}
      <ul className="space-y-2">
        {rows.map((u) => (
          <li key={u.id} className="card flex flex-wrap items-center gap-2 p-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sage-900">
                {u.name || u.email}
                {u.disabled && (
                  <span className="ml-2 badge bg-ember-100 text-ember-800">
                    disabled
                  </span>
                )}
              </div>
              <div className="text-[11px] text-sage-500">
                {u.email} · {u.plan} · {u.householdCount} hh · {u.reviewCount}{" "}
                reviews
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={busyId === u.id}
              onClick={() =>
                patch(u.id, { role: u.role === "admin" ? "user" : "admin" })
              }
            >
              role: {u.role}
            </button>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={busyId === u.id}
              onClick={() => patch(u.id, { disabled: !u.disabled })}
            >
              {u.disabled ? "Enable" : "Disable"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
