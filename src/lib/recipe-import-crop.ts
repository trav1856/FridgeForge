/** Normalized bounding box in 0–1 image coordinates (origin top-left). */
export type NormBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PixelRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const EPS = 1e-9;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Clamp and normalize a user box; rejects degenerate / tiny selections. */
export function normalizeBox(raw: Partial<NormBox> | null | undefined): NormBox | null {
  if (!raw) return null;
  const x = clamp01(Number(raw.x));
  const y = clamp01(Number(raw.y));
  let w = Number(raw.w);
  let h = Number(raw.h);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  // Allow reverse drag
  let nx = x;
  let ny = y;
  if (w < 0) {
    nx = clamp01(x + w);
    w = Math.abs(w);
  }
  if (h < 0) {
    ny = clamp01(y + h);
    h = Math.abs(h);
  }
  w = Math.min(w, 1 - nx);
  h = Math.min(h, 1 - ny);
  if (w < 0.02 || h < 0.02) return null;
  return { x: nx, y: ny, w, h };
}

/** Full-page box when user opts out of drawing. */
export function fullPageBox(): NormBox {
  return { x: 0, y: 0, w: 1, h: 1 };
}

/** Convert normalized box to integer pixel crop rect. */
export function boxToPixelRect(
  box: NormBox,
  imageWidth: number,
  imageHeight: number
): PixelRect | null {
  if (imageWidth < 1 || imageHeight < 1) return null;
  const left = Math.floor(box.x * imageWidth);
  const top = Math.floor(box.y * imageHeight);
  const right = Math.ceil((box.x + box.w) * imageWidth);
  const bottom = Math.ceil((box.y + box.h) * imageHeight);
  const width = Math.max(1, Math.min(imageWidth - left, right - left));
  const height = Math.max(1, Math.min(imageHeight - top, bottom - top));
  if (width < 2 || height < 2) return null;
  return { left, top, width, height };
}

/** Build a NormBox from two pointer points in element-local pixel space. */
export function boxFromDrag(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  elWidth: number,
  elHeight: number
): NormBox | null {
  if (elWidth <= EPS || elHeight <= EPS) return null;
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const right = Math.max(x0, x1);
  const bottom = Math.max(y0, y1);
  return normalizeBox({
    x: left / elWidth,
    y: top / elHeight,
    w: (right - left) / elWidth,
    h: (bottom - top) / elHeight,
  });
}
