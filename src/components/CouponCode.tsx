"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  codeType: "qr" | "barcode";
  /** Larger for in-store redeem view */
  size?: "md" | "lg";
};

export function CouponCode({ value, codeType, size = "md" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      setError(null);
      try {
        if (codeType === "qr") {
          const QR = await import("qrcode");
          const url = await QR.toDataURL(value, {
            width: size === "lg" ? 280 : 160,
            margin: 2,
            color: { dark: "#1a1a1a", light: "#ffffff" },
            errorCorrectionLevel: "M",
          });
          if (!cancelled) setDataUrl(url);
        } else {
          const JsBarcode = (await import("jsbarcode")).default;
          const canvas = canvasRef.current;
          if (!canvas) return;
          JsBarcode(canvas, value, {
            format: "CODE128",
            width: size === "lg" ? 2.4 : 1.6,
            height: size === "lg" ? 100 : 56,
            displayValue: true,
            fontSize: size === "lg" ? 16 : 12,
            margin: 8,
            background: "#ffffff",
            lineColor: "#1a1a1a",
          });
          if (!cancelled) setDataUrl(canvas.toDataURL("image/png"));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not render code"
          );
        }
      }
    }
    void draw();
    return () => {
      cancelled = true;
    };
  }, [value, codeType, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      {codeType === "barcode" && (
        <canvas ref={canvasRef} className="hidden" aria-hidden />
      )}
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt={`${codeType} code ${value}`}
          className={
            size === "lg"
              ? "max-w-full rounded-lg bg-white p-3 shadow-sm"
              : "max-w-[200px] rounded-md bg-white p-2"
          }
        />
      ) : error ? (
        <p className="font-mono text-sm text-sage-800">{value}</p>
      ) : (
        <p className="text-xs text-sage-500">Rendering code…</p>
      )}
      <p className="break-all font-mono text-xs text-sage-600">{value}</p>
    </div>
  );
}
