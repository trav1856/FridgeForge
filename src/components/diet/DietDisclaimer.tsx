import { DIET_DISCLAIMER } from "@/lib/diet/disclaimer";

export function DietDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? "text-xs leading-relaxed text-sage-600" : "rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs leading-relaxed text-sage-800"} data-testid="diet-disclaimer">
      <span className="font-semibold">Health notice: </span>{DIET_DISCLAIMER}
    </p>
  );
}
