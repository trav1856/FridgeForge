import { PantryManager } from "@/components/PantryManager";
import { StruggleBanner } from "@/components/StruggleBanner";

export default function PantryPage() {
  return (
    <div>
      <StruggleBanner />
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-sage-900">Pantry</h1>
        <p className="mt-1 text-sm text-sage-600">
          What you already have — add manually, scan barcodes, or bulk-import
          from a receipt.
        </p>
      </div>
      <PantryManager />
    </div>
  );
}
