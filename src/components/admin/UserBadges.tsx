export function RoleBadge({ role }: { role: string }) {
  return role === "admin" ? (
    <span className="badge bg-sage-800 font-semibold text-cream-50">Admin</span>
  ) : (
    <span className="badge bg-sage-100 font-semibold text-sage-700">User</span>
  );
}

export function PlanBadge({ plan }: { plan: string }) {
  return plan === "pro" ? (
    <span className="badge bg-ember-100 font-semibold text-ember-800">Pro</span>
  ) : (
    <span className="badge bg-cream-200 font-semibold text-sage-800">Community</span>
  );
}

export function StatusBadge({ disabled }: { disabled: boolean }) {
  return disabled ? (
    <span className="badge bg-red-100 font-semibold text-red-800">Suspended</span>
  ) : (
    <span className="badge gap-1.5 bg-green-100 font-semibold text-green-800">
      <span className="inline-block h-2 w-2 rounded-full bg-green-600" aria-hidden />
      Active
    </span>
  );
}
