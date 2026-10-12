/**
 * Profile picture + banner uploads. Same storage approach as user recipe photos
 * (files under public/, served as static paths), but every upload is decoded,
 * auto-oriented, cropped server-side and re-encoded to WebP. sharp does not copy
 * metadata unless asked, so EXIF (including GPS), XMP and ICC are dropped.
 */
import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

export type ProfileImageKind = "avatar" | "banner";

export const PROFILE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const MAX_INPUT_PIXELS = 50_000_000;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export const PROFILE_IMAGE_SPECS: Record<
  ProfileImageKind,
  { aspect: number; outW: number; outH: number; minW: number; minH: number }
> = {
  avatar: { aspect: 1, outW: 400, outH: 400, minW: 160, minH: 160 },
  banner: { aspect: 3, outW: 1500, outH: 500, minW: 600, minH: 200 },
};

export class ProfileImageError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type CropParams = { zoom: number; focusX: number; focusY: number };

const clamp = (n: number, lo: number, hi: number) =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;

/** Parse crop params from form fields; out-of-range values are clamped, junk → defaults. */
export function parseCropParams(get: (k: string) => unknown): CropParams {
  const num = (k: string, d: number) => {
    const v = Number.parseFloat(String(get(k) ?? ""));
    return Number.isFinite(v) ? v : d;
  };
  return {
    zoom: clamp(num("zoom", 1), 1, 3),
    focusX: clamp(num("focusX", 0.5), 0, 1),
    focusY: clamp(num("focusY", 0.5), 0, 1),
  };
}

/** Pure: crop rectangle (integer px, inside the image) for an aspect ratio. */
export function cropRect(
  width: number,
  height: number,
  aspect: number,
  crop: CropParams
): { left: number; top: number; width: number; height: number } {
  let cw: number, ch: number;
  if (width / height > aspect) {
    ch = height;
    cw = height * aspect;
  } else {
    cw = width;
    ch = width / aspect;
  }
  const z = clamp(crop.zoom, 1, 3);
  cw = Math.max(1, Math.floor(cw / z));
  ch = Math.max(1, Math.floor(ch / z));
  const left = Math.round((width - cw) * clamp(crop.focusX, 0, 1));
  const top = Math.round((height - ch) * clamp(crop.focusY, 0, 1));
  return { left, top, width: cw, height: ch };
}

/** Decode → check real format → auto-orient → crop → resize → WebP (no metadata). */
export async function processProfileImage(
  bytes: Buffer,
  kind: ProfileImageKind,
  crop: CropParams
): Promise<Buffer> {
  if (!bytes.length) throw new ProfileImageError("Empty image file.");
  if (bytes.length > PROFILE_IMAGE_MAX_BYTES) {
    throw new ProfileImageError("Image must be 8MB or smaller.", 413);
  }
  const spec = PROFILE_IMAGE_SPECS[kind];
  let meta: sharp.Metadata;
  try {
    meta = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new ProfileImageError("That file isn't a readable image.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new ProfileImageError("Image must be JPEG, PNG or WebP.");
  }
  let oriented: { data: Buffer; info: sharp.OutputInfo };
  try {
    oriented = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .png({ compressionLevel: 1 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ProfileImageError("That file isn't a readable image.");
  }
  const { width, height } = oriented.info;
  if (width < spec.minW || height < spec.minH) {
    throw new ProfileImageError(
      `Image is too small. Use at least ${spec.minW} × ${spec.minH} pixels.`
    );
  }
  const rect = cropRect(width, height, spec.aspect, crop);
  return sharp(oriented.data)
    .extract(rect)
    .resize(spec.outW, spec.outH, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();
}

const MANAGED_RE = /^\/profile-images\/u\/[A-Za-z0-9._-]+\.webp$/;

export function profileImagesDir(): string {
  return path.join(process.cwd(), "public", "profile-images", "u");
}

export function isManagedProfileImagePath(url: string | null | undefined): url is string {
  return Boolean(url && MANAGED_RE.test(url));
}

export async function saveProfileImageFile(userId: string, kind: ProfileImageKind, webp: Buffer) {
  const dir = profileImagesDir();
  await mkdir(dir, { recursive: true });
  const safeId = userId.replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
  const filename = `${safeId}-${kind}-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.webp`;
  await writeFile(path.join(dir, filename), webp, { mode: 0o644 });
  return `/profile-images/u/${filename}`;
}

/** Best-effort delete of a managed profile image (ignored for anything else). */
export async function deleteManagedProfileImage(url: string | null | undefined) {
  if (!isManagedProfileImagePath(url)) return;
  const name = url.slice("/profile-images/u/".length);
  await unlink(path.join(profileImagesDir(), name)).catch(() => {});
}
