import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";

// ---- in-memory prisma for SharedProduct / HouseholdProductOverride / PantryItem ----
const h = vi.hoisted(() => {
  type Row = Record<string, unknown> & { id: string };
  const db = { shared: [] as Row[], overrides: [] as Row[], pantry: [] as Row[] };
  const writes: string[] = [];
  let seq = 0;
  const now = () => new Date();
  const prisma = {
    sharedProduct: {
      findUnique: vi.fn(async ({ where }: { where: { barcode?: string; id?: string } }) =>
        db.shared.find((r) => (where.barcode ? r.barcode === where.barcode : r.id === where.id)) ?? null),
      count: vi.fn(async ({ where }: { where: { createdByUserId: string; createdAt: { gte: Date } } }) =>
        db.shared.filter((r) => r.createdByUserId === where.createdByUserId && (r.createdAt as Date) >= where.createdAt.gte).length),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        writes.push("shared.create");
        if (db.shared.some((r) => r.barcode === data.barcode)) {
          const { Prisma } = await import("@prisma/client");
          throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" });
        }
        const row = { id: `sp${++seq}`, createdAt: now(), updatedAt: now(), ...data } as Row;
        db.shared.push(row);
        return row;
      }),
    },
    householdProductOverride: {
      findUnique: vi.fn(async ({ where }: { where: { householdId_barcode: { householdId: string; barcode: string } } }) =>
        db.overrides.find((r) => r.householdId === where.householdId_barcode.householdId && r.barcode === where.householdId_barcode.barcode) ?? null),
      upsert: vi.fn(async ({ where, create, update }: { where: { householdId_barcode: { householdId: string; barcode: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        writes.push("override.upsert");
        const k = where.householdId_barcode;
        const ex = db.overrides.find((r) => r.householdId === k.householdId && r.barcode === k.barcode);
        if (ex) return Object.assign(ex, update);
        const row = { id: `ov${++seq}`, ...create } as Row;
        db.overrides.push(row);
        return row;
      }),
    },
    pantryItem: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => db.pantry.find((r) => r.id === where.id) ?? null),
    },
  };
  return { db, prisma, writes };
});
vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/product-images", () => ({
  isManagedProductImage: (u: string | null | undefined) => !!u && /^\/product-images\/(shared|household)\//.test(u),
  copyPantryPhotoToProduct: async (u: string | null | undefined, kind: string) =>
    u && u.startsWith("/pantry-images/user/") ? `/product-images/${kind}/copy-of-${u.split("/").pop()}` : null,
  deleteManagedProductImage: async () => {},
}));
const auth = vi.hoisted(() => ({ householdId: null as string | null }));
vi.mock("@/lib/auth", () => ({ resolveHouseholdId: async () => auth.householdId }));
vi.mock("@/lib/open-food-facts", () => ({
  lookupOpenFoodFacts: vi.fn(async (b: string) => ({ found: false, barcode: b })),
}));
vi.mock("@/lib/write-scope", () => ({
  requireWriteScope: vi.fn(async () => ({
    ok: false,
    response: NextResponse.json({ error: "Sign in", code: "SIGN_IN_REQUIRED" }, { status: 401 }),
  })),
  notFoundResponse: () => NextResponse.json({ error: "Not found" }, { status: 404 }),
}));

import { gtinCheckDigit, validateBarcode, canonicalBarcode } from "@/lib/barcode";
import {
  contributeFromPantryItem,
  resolveProductForScan,
  toPublicProduct,
  PUBLIC_PRODUCT_KEYS,
  SHARED_CREATE_LIMITS,
} from "@/lib/shared-products";
import { reencodePhoto, ImageReencodeError } from "@/lib/image-reencode";
import { GET as lookupGET } from "@/app/api/barcode/lookup/route";
import { POST as contributePOST } from "@/app/api/products/contribute/route";

const UPC = "036000291452"; // valid UPC-A
const A = { userId: "userA", householdId: "hhA" };
const B = { userId: "userB", householdId: "hhB" };
const item = (o: Partial<Record<string, unknown>> = {}) => ({
  name: "Test Crackers",
  quantity: 8,
  unit: "oz",
  category: "Snacks",
  barcode: UPC,
  imageUrl: "/pantry-images/user/a.webp",
  ...o,
}) as Parameters<typeof contributeFromPantryItem>[0];

beforeEach(() => {
  h.db.shared.length = 0;
  h.db.overrides.length = 0;
  h.db.pantry.length = 0;
  h.writes.length = 0;
  auth.householdId = null;
});

describe("barcode check digits", () => {
  it("accepts valid UPC-A, EAN-13 and EAN-8", () => {
    expect(validateBarcode(UPC)).toEqual({ ok: true, code: UPC, kind: "UPC-A" });
    expect(validateBarcode("4006381333931")).toMatchObject({ ok: true, kind: "EAN-13" });
    expect(validateBarcode("96385074")).toMatchObject({ ok: true, kind: "EAN-8" });
    expect(validateBarcode("0 36000-29145 2")).toMatchObject({ ok: true, code: UPC });
  });
  it("rejects bad check digits, lengths and non-digits", () => {
    expect(validateBarcode("036000291453").ok).toBe(false);
    expect(validateBarcode("4006381333932").ok).toBe(false);
    expect(validateBarcode("96385075").ok).toBe(false);
    expect(validateBarcode("12345").ok).toBe(false);
    expect(validateBarcode("abc").ok).toBe(false);
    expect(validateBarcode("").ok).toBe(false);
  });
  it("EAN-13 with a leading 0 is the same product as its UPC-A", () => {
    expect(canonicalBarcode("0" + UPC)).toBe(UPC);
    expect(gtinCheckDigit("03600029145")).toBe(2);
  });
});

describe("first save wins", () => {
  it("first household creates the shared record with name, size, unit and a copied photo", async () => {
    const r = await contributeFromPantryItem(item(), A);
    expect(r.result).toBe("created");
    expect(h.db.shared).toHaveLength(1);
    expect(h.db.shared[0]).toMatchObject({
      barcode: UPC, name: "Test Crackers", size: "8 oz", unit: "oz",
      imageUrl: "/product-images/shared/copy-of-a.webp",
      createdByUserId: "userA", createdByHouseholdId: "hhA",
    });
  });
  it("a later save by another household never overwrites; it becomes their override", async () => {
    await contributeFromPantryItem(item(), A);
    const before = { ...h.db.shared[0] };
    const r = await contributeFromPantryItem(item({ name: "B's Crackers", imageUrl: "/product-images/shared/copy-of-a.webp" }), B);
    expect(r.result).toBe("override");
    expect(h.db.shared[0]).toEqual(before);
    expect(h.db.overrides).toHaveLength(1);
    expect(h.db.overrides[0]).toMatchObject({ householdId: "hhB", name: "B's Crackers", imageUrl: "/product-images/shared/copy-of-a.webp" });
  });
  it("saving the prefilled info unchanged creates no override", async () => {
    await contributeFromPantryItem(item(), A);
    const r = await contributeFromPantryItem(item({ imageUrl: "/product-images/shared/copy-of-a.webp" }), B);
    expect(r.result).toBe("unchanged");
    expect(h.db.overrides).toHaveLength(0);
  });
  it("losing a create race falls back to an override", async () => {
    await contributeFromPantryItem(item(), A);
    h.prisma.sharedProduct.findUnique.mockResolvedValueOnce(null);
    const r = await contributeFromPantryItem(item({ name: "Racer" }), B);
    expect(r.result).toBe("override");
    expect(h.db.shared).toHaveLength(1);
  });
  it("skips invalid barcodes and rate-limits creation", async () => {
    expect((await contributeFromPantryItem(item({ barcode: "036000291453" }), A)).result).toBe("skipped");
    for (let i = 0; i < SHARED_CREATE_LIMITS.perHour; i++) {
      h.db.shared.push({ id: `x${i}`, barcode: `x${i}`, createdByUserId: "userA", createdAt: new Date() });
    }
    expect((await contributeFromPantryItem(item(), A)).result).toBe("rate_limited");
  });
});

describe("override precedence", () => {
  it("household override → shared → nothing", async () => {
    await contributeFromPantryItem(item(), A);
    await contributeFromPantryItem(item({ name: "B's Crackers" }), B);
    expect(await resolveProductForScan(UPC, "hhB")).toMatchObject({ name: "B's Crackers", source: "household" });
    expect(await resolveProductForScan(UPC, "hhA")).toMatchObject({ name: "Test Crackers", source: "shared" });
    expect(await resolveProductForScan(UPC, null)).toMatchObject({ name: "Test Crackers", source: "shared" });
    expect(await resolveProductForScan("4006381333931", "hhA")).toBeNull();
  });
});

describe("privacy allowlist", () => {
  it("public product has only product keys", async () => {
    await contributeFromPantryItem(item(), A);
    const pub = toPublicProduct(h.db.shared[0] as never, "shared");
    expect(Object.keys(pub).sort()).toEqual([...PUBLIC_PRODUCT_KEYS].sort());
    const s = JSON.stringify(pub);
    expect(s).not.toMatch(/userA|hhA|createdBy/);
  });
  it("lookup response carries no user/household ids", async () => {
    await contributeFromPantryItem(item(), A);
    await contributeFromPantryItem(item({ name: "B's Crackers" }), B);
    for (const hh of [null, "hhA", "hhB"]) {
      auth.householdId = hh;
      const res = await lookupGET(new NextRequest(`http://x/api/barcode/lookup?barcode=${UPC}`));
      const txt = await res.text();
      expect(res.status).toBe(200);
      expect(txt).not.toMatch(/userA|userB|hhA|hhB|createdBy|householdId/);
    }
  });
});

describe("guests write nothing", () => {
  it("guest lookup reads the shared record without any DB write", async () => {
    await contributeFromPantryItem(item(), A);
    h.writes.length = 0;
    auth.householdId = null;
    const res = await lookupGET(new NextRequest(`http://x/api/barcode/lookup?barcode=${UPC}`));
    expect(await res.json()).toMatchObject({ found: true, name: "Test Crackers", source: "shared" });
    expect(h.writes).toEqual([]);
  });
  it("guest contribute is rejected before touching the DB", async () => {
    const res = await contributePOST(new NextRequest("http://x/api/products/contribute", { method: "POST", body: JSON.stringify({ itemId: "p1" }) }));
    expect(res.status).toBe(401);
    expect(h.prisma.pantryItem.findUnique).not.toHaveBeenCalled();
    expect(h.writes).toEqual([]);
  });
});

describe("image processing", () => {
  it("re-encodes to WebP, auto-orients, caps size and strips EXIF/GPS", async () => {
    const jpeg = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#c84" } })
      .withMetadata({ orientation: 6, exif: { IFD0: { Artist: "secret-person" }, IFD3: { GPSLatitudeRef: "N" } } as never })
      .jpeg()
      .toBuffer();
    expect(jpeg.includes(Buffer.from("secret-person"))).toBe(true);
    const out = await reencodePhoto(jpeg);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation === undefined || meta.orientation === 1).toBe(true);
    expect(Math.max(meta.width!, meta.height!)).toBe(1200);
    expect(meta.height).toBeGreaterThan(meta.width!); // rotated by orientation 6
    expect(out.includes(Buffer.from("secret-person"))).toBe(false);
  });
  it("rejects non-images and empty files", async () => {
    await expect(reencodePhoto(Buffer.from("<svg onload=alert(1)>"))).rejects.toBeInstanceOf(ImageReencodeError);
    await expect(reencodePhoto(Buffer.alloc(0))).rejects.toBeInstanceOf(ImageReencodeError);
  });
});
