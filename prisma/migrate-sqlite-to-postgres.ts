/**
 * One-off: copy FridgeForge data from SQLite (prisma/dev.db) into the
 * Postgres DATABASE_URL currently configured for Prisma.
 *
 * Preserves IDs / relations. Non-destructive toward SQLite.
 * Skips rows whose primary key already exists in Postgres.
 *
 * Usage:
 *   SQLITE_PATH=prisma/dev.db npx tsx prisma/migrate-sqlite-to-postgres.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const sqlitePath =
  process.env.SQLITE_PATH || path.join(__dirname, "dev.db");

if (!existsSync(sqlitePath)) {
  console.error(`SQLite file not found: ${sqlitePath}`);
  process.exit(1);
}

const prisma = new PrismaClient();

type Row = Record<string, unknown>;

function dump(table: string): Row[] {
  const sql = `SELECT * FROM "${table}"`;
  const out = execFileSync("sqlite3", ["-json", sqlitePath, sql], {
    encoding: "utf8",
  }).trim();
  if (!out) return [];
  return JSON.parse(out) as Row[];
}

function asDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    // epoch ms as string, or ISO
    if (/^\d+$/.test(v)) return new Date(Number(v));
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  throw new Error(`Cannot parse date: ${JSON.stringify(v)}`);
}

function asDateRequired(v: unknown, field: string): Date {
  const d = asDate(v);
  if (!d) throw new Error(`Missing required date: ${field}`);
  return d;
}

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return Boolean(v);
}

function asNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  return Number(v);
}

async function main() {
  console.log(`Reading SQLite: ${sqlitePath}`);
  console.log("Target: DATABASE_URL (Postgres) from env/.env");

  const users = dump("User");
  const households = dump("Household");
  const sessions = dump("Session");
  const members = dump("HouseholdMember");
  const pantry = dump("PantryItem");
  const recipes = dump("Recipe");
  const ingredients = dump("RecipeIngredient");
  const favorites = dump("RecipeFavorite");
  const shares = dump("RecipeShare");
  const coupons = dump("Coupon");
  const staples = dump("CustomPantryStaple");
  const shopping = dump("ShoppingListItem");

  const sqliteCounts: Record<string, number> = {
    User: users.length,
    Household: households.length,
    Session: sessions.length,
    HouseholdMember: members.length,
    PantryItem: pantry.length,
    Recipe: recipes.length,
    RecipeIngredient: ingredients.length,
    RecipeFavorite: favorites.length,
    RecipeShare: shares.length,
    Coupon: coupons.length,
    CustomPantryStaple: staples.length,
    ShoppingListItem: shopping.length,
  };
  console.log("SQLite counts:", sqliteCounts);

  let inserted = 0;
  let skipped = 0;

  async function upsertMany(
    label: string,
    rows: Row[],
    exists: (id: string) => Promise<boolean>,
    create: (row: Row) => Promise<unknown>
  ) {
    for (const row of rows) {
      const id = String(row.id);
      if (await exists(id)) {
        skipped++;
        continue;
      }
      try {
        await create(row);
        inserted++;
      } catch (e) {
        console.error(`Failed ${label} id=${id}:`, e);
        throw e;
      }
    }
    console.log(`… ${label}: processed ${rows.length}`);
  }

  await upsertMany(
    "User",
    users,
    async (id) => !!(await prisma.user.findUnique({ where: { id } })),
    (r) =>
      prisma.user.create({
        data: {
          id: String(r.id),
          email: String(r.email),
          name: (r.name as string) ?? null,
          passwordHash: (r.passwordHash as string) ?? null,
          plan: String(r.plan ?? "community"),
          createdAt: asDateRequired(r.createdAt, "User.createdAt"),
          updatedAt: asDateRequired(r.updatedAt, "User.updatedAt"),
        },
      })
  );

  await upsertMany(
    "Household",
    households,
    async (id) => !!(await prisma.household.findUnique({ where: { id } })),
    (r) =>
      prisma.household.create({
        data: {
          id: String(r.id),
          name: String(r.name),
          inviteCode: String(r.inviteCode),
          createdAt: asDateRequired(r.createdAt, "Household.createdAt"),
          updatedAt: asDateRequired(r.updatedAt, "Household.updatedAt"),
        },
      })
  );

  await upsertMany(
    "Session",
    sessions,
    async (id) => !!(await prisma.session.findUnique({ where: { id } })),
    (r) =>
      prisma.session.create({
        data: {
          id: String(r.id),
          token: String(r.token),
          userId: String(r.userId),
          expiresAt: asDateRequired(r.expiresAt, "Session.expiresAt"),
          createdAt: asDateRequired(r.createdAt, "Session.createdAt"),
        },
      })
  );

  await upsertMany(
    "HouseholdMember",
    members,
    async (id) =>
      !!(await prisma.householdMember.findUnique({ where: { id } })),
    (r) =>
      prisma.householdMember.create({
        data: {
          id: String(r.id),
          householdId: String(r.householdId),
          userId: String(r.userId),
          role: String(r.role ?? "member"),
          createdAt: asDateRequired(r.createdAt, "HouseholdMember.createdAt"),
        },
      })
  );

  await upsertMany(
    "PantryItem",
    pantry,
    async (id) => !!(await prisma.pantryItem.findUnique({ where: { id } })),
    (r) =>
      prisma.pantryItem.create({
        data: {
          id: String(r.id),
          name: String(r.name),
          quantity: asNum(r.quantity) ?? 1,
          unit: String(r.unit ?? "each"),
          category: (r.category as string) ?? null,
          tags: String(r.tags ?? "[]"),
          barcode: (r.barcode as string) ?? null,
          expirationDate: asDate(r.expirationDate),
          nutritionJson: (r.nutritionJson as string) ?? null,
          householdId: (r.householdId as string) ?? null,
          createdAt: asDateRequired(r.createdAt, "PantryItem.createdAt"),
          updatedAt: asDateRequired(r.updatedAt, "PantryItem.updatedAt"),
        },
      })
  );

  await upsertMany(
    "Recipe",
    recipes,
    async (id) => !!(await prisma.recipe.findUnique({ where: { id } })),
    (r) =>
      prisma.recipe.create({
        data: {
          id: String(r.id),
          title: String(r.title),
          description: (r.description as string) ?? null,
          steps: String(r.steps),
          costTier: String(r.costTier ?? "cheap"),
          tags: String(r.tags ?? "[]"),
          cuisine: (r.cuisine as string) ?? null,
          course: (r.course as string) ?? null,
          foodCategories: String(r.foodCategories ?? "[]"),
          origins: String(r.origins ?? "[]"),
          servings: Number(r.servings ?? 2),
          cookTimeMinutes:
            r.cookTimeMinutes == null ? null : Number(r.cookTimeMinutes),
          sourceUrl: (r.sourceUrl as string) ?? null,
          imageUrl: (r.imageUrl as string) ?? null,
          isStruggleMeal: asBool(r.isStruggleMeal),
          techniqueTips: (r.techniqueTips as string) ?? null,
          flavorBoosters: (r.flavorBoosters as string) ?? null,
          visibility: String(r.visibility ?? "household"),
          ownerUserId: (r.ownerUserId as string) ?? null,
          householdId: (r.householdId as string) ?? null,
          createdAt: asDateRequired(r.createdAt, "Recipe.createdAt"),
          updatedAt: asDateRequired(r.updatedAt, "Recipe.updatedAt"),
        },
      })
  );

  await upsertMany(
    "RecipeIngredient",
    ingredients,
    async (id) =>
      !!(await prisma.recipeIngredient.findUnique({ where: { id } })),
    (r) =>
      prisma.recipeIngredient.create({
        data: {
          id: String(r.id),
          recipeId: String(r.recipeId),
          name: String(r.name),
          quantity: asNum(r.quantity) ?? 1,
          unit: String(r.unit ?? "each"),
          optional: asBool(r.optional),
        },
      })
  );

  await upsertMany(
    "RecipeFavorite",
    favorites,
    async (id) =>
      !!(await prisma.recipeFavorite.findUnique({ where: { id } })),
    (r) =>
      prisma.recipeFavorite.create({
        data: {
          id: String(r.id),
          userId: String(r.userId),
          recipeId: String(r.recipeId),
          createdAt: asDateRequired(r.createdAt, "RecipeFavorite.createdAt"),
        },
      })
  );

  await upsertMany(
    "RecipeShare",
    shares,
    async (id) => !!(await prisma.recipeShare.findUnique({ where: { id } })),
    (r) =>
      prisma.recipeShare.create({
        data: {
          id: String(r.id),
          recipeId: String(r.recipeId),
          fromUserId: String(r.fromUserId),
          toUserEmail: (r.toUserEmail as string) ?? null,
          toUserId: (r.toUserId as string) ?? null,
          accepted: asBool(r.accepted),
          acceptedAt: asDate(r.acceptedAt),
          createdAt: asDateRequired(r.createdAt, "RecipeShare.createdAt"),
        },
      })
  );

  await upsertMany(
    "Coupon",
    coupons,
    async (id) => !!(await prisma.coupon.findUnique({ where: { id } })),
    (r) =>
      prisma.coupon.create({
        data: {
          id: String(r.id),
          brand: String(r.brand),
          title: String(r.title),
          discountText: String(r.discountText),
          terms: (r.terms as string) ?? null,
          codeValue: String(r.codeValue),
          codeType: String(r.codeType ?? "qr"),
          expiresAt: asDate(r.expiresAt),
          clipped: asBool(r.clipped),
          used: asBool(r.used),
          usedAt: asDate(r.usedAt),
          householdId: (r.householdId as string) ?? null,
          createdAt: asDateRequired(r.createdAt, "Coupon.createdAt"),
          updatedAt: asDateRequired(r.updatedAt, "Coupon.updatedAt"),
        },
      })
  );

  await upsertMany(
    "CustomPantryStaple",
    staples,
    async (id) =>
      !!(await prisma.customPantryStaple.findUnique({ where: { id } })),
    (r) =>
      prisma.customPantryStaple.create({
        data: {
          id: String(r.id),
          name: String(r.name),
          category: String(r.category),
          measureKind: (r.measureKind as string) ?? null,
          suggestedUnit: (r.suggestedUnit as string) ?? null,
          hidden: asBool(r.hidden),
          householdId: (r.householdId as string) ?? null,
          createdAt: asDateRequired(r.createdAt, "CustomPantryStaple.createdAt"),
          updatedAt: asDateRequired(r.updatedAt, "CustomPantryStaple.updatedAt"),
        },
      })
  );

  await upsertMany(
    "ShoppingListItem",
    shopping,
    async (id) =>
      !!(await prisma.shoppingListItem.findUnique({ where: { id } })),
    (r) =>
      prisma.shoppingListItem.create({
        data: {
          id: String(r.id),
          name: String(r.name),
          quantity: asNum(r.quantity),
          unit: (r.unit as string) ?? null,
          checked: asBool(r.checked),
          recipeId: (r.recipeId as string) ?? null,
          recipeTitle: (r.recipeTitle as string) ?? null,
          householdId: (r.householdId as string) ?? null,
          userId: (r.userId as string) ?? null,
          createdAt: asDateRequired(r.createdAt, "ShoppingListItem.createdAt"),
          updatedAt: asDateRequired(r.updatedAt, "ShoppingListItem.updatedAt"),
        },
      })
  );

  const pgCounts = {
    User: await prisma.user.count(),
    Household: await prisma.household.count(),
    Session: await prisma.session.count(),
    HouseholdMember: await prisma.householdMember.count(),
    PantryItem: await prisma.pantryItem.count(),
    Recipe: await prisma.recipe.count(),
    RecipeIngredient: await prisma.recipeIngredient.count(),
    RecipeFavorite: await prisma.recipeFavorite.count(),
    RecipeShare: await prisma.recipeShare.count(),
    Coupon: await prisma.coupon.count(),
    CustomPantryStaple: await prisma.customPantryStaple.count(),
    ShoppingListItem: await prisma.shoppingListItem.count(),
  };

  console.log("Postgres counts:", pgCounts);
  console.log(`Inserted ${inserted}, skipped existing ${skipped}`);

  const mismatches: string[] = [];
  for (const [k, v] of Object.entries(sqliteCounts)) {
    if (pgCounts[k as keyof typeof pgCounts] !== v) {
      mismatches.push(
        `${k}: sqlite=${v} pg=${pgCounts[k as keyof typeof pgCounts]}`
      );
    }
  }
  if (mismatches.length) {
    console.error("COUNT MISMATCH:", mismatches);
    process.exit(2);
  }
  console.log("Row counts match. Migration OK.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
