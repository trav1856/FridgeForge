/**
 * Reference-content-only seed: How-to courses/lessons/badges and Struggle Mode
 * hub cards. Safe to run against a live DB — it never touches users,
 * households, recipes, pantry, coupons, sessions, lesson progress, or awarded
 * badges. Idempotent: rows are matched by stable slug, so re-runs never
 * duplicate.
 *
 *   npm run db:seed:content              # create missing rows only
 *   FF_CONTENT_FORCE=1 npm run db:seed:content   # also reset existing rows
 *                                                # to the canonical catalog
 *
 * Canonical content lives in src/lib/howto-catalog.ts and
 * src/lib/struggle-content.ts (via src/lib/struggle-resources.ts).
 */
import { prisma } from "../src/lib/db";
import { ensureHowToCatalogSeeded } from "../src/lib/howto-catalog";
import { ensureStruggleResourcesSeeded } from "../src/lib/struggle-resources";

async function main() {
  const force = process.env.FF_CONTENT_FORCE === "1";
  const howto = await ensureHowToCatalogSeeded({ forceUpdateContent: force });
  const struggle = await ensureStruggleResourcesSeeded({
    forceUpdateContent: force,
  });
  const [badges, courses, lessons, resources] = await Promise.all([
    prisma.howToBadge.count(),
    prisma.howToCourse.count(),
    prisma.howToLesson.count(),
    prisma.struggleResource.count(),
  ]);
  console.log(
    `How-to: badges +${howto.badgesCreated}, courses +${howto.coursesCreated}, lessons +${howto.lessonsCreated}, updated ${howto.updated}`
  );
  console.log(
    `Struggle resources: +${struggle.created} created, ${struggle.updated} force-updated`
  );
  console.log(
    `Totals now: HowToBadge=${badges} HowToCourse=${courses} HowToLesson=${lessons} StruggleResource=${resources} (force=${force})`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
