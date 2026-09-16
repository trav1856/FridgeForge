"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  boxFromDrag,
  fullPageBox,
  type NormBox,
} from "@/lib/recipe-import-crop";

type Props = {
  imageUrl: string;
  box: NormBox | null;
  onBoxChange: (box: NormBox | null) => void;
  disabled?: boolean;
};

/**
 * Drag (mouse + touch) a rectangle over a page image.
 * Coordinates are normalized 0–1 relative to the displayed image box.
 */
export function BoundingBoxPicker({
  imageUrl,
  box,
  onBoxChange,
  disabled,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<NormBox | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [imageUrl]);

  const localPoint = useCallback((e: ReactPointerEvent) => {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: Math.min(Math.max(0, e.clientX - rect.left), rect.width),
      y: Math.min(Math.max(0, e.clientY - rect.top), rect.height),
      w: rect.width,
      h: rect.height,
    };
  }, []);

  function onPointerDown(e: ReactPointerEvent) {
    if (disabled) return;
    const p = localPoint(e);
    if (!p || p.w < 8 || p.h < 8) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: p.x, y: p.y };
    setDraft(null);
    onBoxChange(null);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!dragStart.current || disabled) return;
    const p = localPoint(e);
    if (!p) return;
    setDraft(
      boxFromDrag(
        dragStart.current.x,
        dragStart.current.y,
        p.x,
        p.y,
        p.w,
        p.h
      )
    );
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (disabled) return;
    const start = dragStart.current;
    const p = localPoint(e);
    dragStart.current = null;
    if (!start || !p) {
      setDraft(null);
      return;
    }
    const finalBox = boxFromDrag(start.x, start.y, p.x, p.y, p.w, p.h);
    setDraft(null);
    onBoxChange(finalBox);
  }

  const shown = draft || box;

  return (
    <div className="space-y-2">
      <div
        ref={wrapRef}
        className="relative select-none overflow-hidden rounded-xl border border-cream-300 bg-cream-100 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragStart.current = null;
          setDraft(null);
        }}
        style={{ cursor: disabled ? "default" : "crosshair" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Cookbook page"
          className="block max-h-[70vh] w-full object-contain"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
        {shown && (
          <div
            className="pointer-events-none absolute border-2 border-ember-600 bg-ember-500/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]"
            style={{
              left: `${shown.x * 100}%`,
              top: `${shown.y * 100}%`,
              width: `${shown.w * 100}%`,
              height: `${shown.h * 100}%`,
            }}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-sage-600">
        <span>
          Drag a rectangle around one recipe
          {natural ? ` · ${natural.w}×${natural.h}px` : ""}
        </span>
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-xs"
          disabled={disabled}
          onClick={() => onBoxChange(fullPageBox())}
        >
          Use full page
        </button>
        {box && (
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-xs"
            disabled={disabled}
            onClick={() => onBoxChange(null)}
          >
            Clear box
          </button>
        )}
      </div>
    </div>
  );
}
