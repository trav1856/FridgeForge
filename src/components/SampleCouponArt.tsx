import { SAMPLE_WATERMARK } from "@/lib/sample-coupons";

/** Large diagonal "SAMPLE — NOT VALID" overlay. Parent must be `relative overflow-hidden`. */
export function SampleWatermark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div
      aria-hidden
      data-testid="sample-watermark"
      className="pointer-events-none absolute inset-0 z-10 flex select-none items-center justify-center overflow-hidden"
    >
      <span
        className={
          (size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl") +
          " -rotate-[24deg] whitespace-nowrap rounded-lg border-4 border-red-500/40 px-4 py-1 font-black uppercase tracking-widest text-red-600/35"
        }
      >
        {SAMPLE_WATERMARK}
      </span>
    </div>
  );
}

/** Stand-in for a scannable code: a crossed-out box. Samples never show QR, barcodes, or UPCs. */
export function SampleCodePlaceholder({ size = "md" }: { size?: "md" | "lg" }) {
  const h = size === "lg" ? 120 : 64;
  return (
    <div
      data-testid="sample-code-placeholder"
      className="flex flex-col items-center gap-2"
    >
      <svg
        role="img"
        aria-label="No code: sample coupon"
        viewBox="0 0 200 100"
        width={h * 2}
        height={h}
        className="rounded-md border-2 border-sage-300 bg-cream-50"
      >
        <line x1="6" y1="6" x2="194" y2="94" stroke="#b91c1c" strokeWidth="4" strokeLinecap="round" />
        <line x1="194" y1="6" x2="6" y2="94" stroke="#b91c1c" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
        No code — sample only, not valid in stores
      </p>
    </div>
  );
}
