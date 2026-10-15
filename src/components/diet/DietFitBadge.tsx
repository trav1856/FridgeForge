import type { DietFit } from "@/lib/diet/fit";

export function DietFitBadge({ fit }: { fit: DietFit }) {
  const cls = !fit.trusted ? "border-cream-300 bg-cream-100 text-sage-700" : fit.ok ? "border-sage-300 bg-sage-50 text-sage-800" : "border-ember-200 bg-ember-50 text-ember-800";
  return (
    <p className={`mb-2 inline-flex max-w-[340px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cls}`} data-testid="diet-fit-badge" data-fit={fit.trusted ? (fit.ok ? "yes" : "no") : "unknown"}>
      {!fit.trusted ? `${fit.diet}: nutrition unknown` : fit.ok ? `Fits your ${fit.diet} plan ✓` : `Doesn't fit ${fit.diet} ✕${fit.why ? ` (${fit.why})` : ""}`}
    </p>
  );
}
