import { prisma } from "@/lib/db";

/**
 * Canonical How-to LMS starter catalog (courses, lessons, course badges).
 * Single source of truth for prisma/seed.ts and prisma/seed-content.ts.
 * Stable keys: badge.slug, course.slug, (course, lesson.slug).
 */
export type HowToCatalogEntry = {
  badge: { slug: string; title: string; description: string; emoji: string };
  course: { slug: string; title: string; description: string; sortOrder: number };
  lessons: {
    slug: string;
    title: string;
    summary: string;
    body: string;
    sortOrder: number;
    estimatedMinutes: number;
  }[];
};

export const HOWTO_CATALOG: HowToCatalogEntry[] = [
    {
      badge: {
        slug: "boil-water",
        title: "I know how to boil water",
        description: "Finished the Boil Water basics course.",
        emoji: "💧",
      },
      course: {
        slug: "boil-water",
        title: "Boil water",
        description: "The first kitchen skill: hot water, safely and on purpose.",
        sortOrder: 1,
      },
      lessons: [
        {
          slug: "pick-a-pot",
          title: "Pick a pot and fill it",
          summary: "Choose a pot that fits the job and leave headroom.",
          sortOrder: 1,
          estimatedMinutes: 3,
          body: `Use a pot large enough for what you need, with at least an inch of space above the water so it will not boil over.

Fill with cold tap water. Cold water heats more evenly and is usually fresher from the pipes.

Add a pinch of salt if you are boiling for pasta or vegetables — it seasons the food as it cooks.`,
        },
        {
          slug: "bring-to-a-boil",
          title: "Bring it to a boil",
          summary: "Lid on to speed up, watch for a rolling boil.",
          sortOrder: 2,
          estimatedMinutes: 5,
          body: `Set the pot over medium-high heat. A lid traps steam and gets you to a boil faster.

A simmer has small bubbles; a rolling boil has big bubbles that do not stop when you stir.

Turn the heat down a notch once it boils hard — you only need a steady boil, not a volcano.`,
        },
        {
          slug: "safety-basics",
          title: "Stay safe around steam",
          summary: "Handles in, lids away from you, pot holders ready.",
          sortOrder: 3,
          estimatedMinutes: 3,
          body: `Keep pot handles turned inward so nobody bumps them.

Lift lids away from your face — steam burns faster than you expect.

Use a dry pot holder or towel. Wet cloth conducts heat and can scald your hand.`,
        },
      ],
    },
    {
      badge: {
        slug: "knife-safe",
        title: "Knife-safe cook",
        description: "Finished Knife safety basics.",
        emoji: "🔪",
      },
      course: {
        slug: "knife-safety",
        title: "Knife safety basics",
        description: "Hold, cut, and store a knife without drama.",
        sortOrder: 2,
      },
      lessons: [
        {
          slug: "grip-and-claw",
          title: "Grip and claw",
          summary: "Pinch the blade; curl your guide fingers.",
          sortOrder: 1,
          estimatedMinutes: 4,
          body: `Hold the knife by pinching the blade just in front of the handle with thumb and forefinger — more control than a fist on the handle alone.

Curl the fingertips of your other hand under (the “claw”) so knuckles guide the blade and fingertips stay clear.

Never cut toward your body. Slow and steady beats fast and bloody.`,
        },
        {
          slug: "board-and-pass",
          title: "Board, pass, and store",
          summary: "Stable board, never catch a falling knife.",
          sortOrder: 2,
          estimatedMinutes: 3,
          body: `Put a damp towel under a sliding cutting board so it stays put.

Pass a knife handle-first, or set it down for the other person to pick up. Never toss it.

Store knives in a block, on a strip, or in a sheath — loose in a drawer is how blades and fingers get hurt.`,
        },
      ],
    },
    {
      badge: {
        slug: "egg-scrambler",
        title: "Egg scrambler",
        description: "Finished Scramble eggs.",
        emoji: "🍳",
      },
      course: {
        slug: "scramble-eggs",
        title: "Scramble eggs",
        description: "Soft, creamy scrambled eggs on a weeknight timeline.",
        sortOrder: 3,
      },
      lessons: [
        {
          slug: "beat-and-season",
          title: "Beat and season",
          summary: "Fork until even; salt before the pan.",
          sortOrder: 1,
          estimatedMinutes: 3,
          body: `Crack eggs into a bowl (not straight into a hot pan — shells happen).

Beat with a fork until the yolks and whites look one color. A splash of milk or water is optional.

Salt lightly before cooking so seasoning dissolves into the mix.`,
        },
        {
          slug: "low-and-slow",
          title: "Cook low and slow",
          summary: "Butter, gentle heat, pull early.",
          sortOrder: 2,
          estimatedMinutes: 5,
          body: `Melt a little butter in a nonstick or well-seasoned pan over medium-low.

Pour in eggs. Stir gently with a spatula, scraping the bottom. Soft curds form in a minute or two.

Pull the pan off heat when eggs still look a touch wet — carryover heat finishes them. Overcooked eggs turn rubbery.`,
        },
      ],
    },
    {
      badge: {
        slug: "rice-stovetop",
        title: "Rice on the stove",
        description: "Finished Cook rice (stovetop).",
        emoji: "🍚",
      },
      course: {
        slug: "cook-rice",
        title: "Cook rice",
        description: "Fluffy white rice without a rice cooker.",
        sortOrder: 4,
      },
      lessons: [
        {
          slug: "rinse-and-ratio",
          title: "Rinse and measure",
          summary: "Rinse until clearer; 1:1.5 or 1:2 water.",
          sortOrder: 1,
          estimatedMinutes: 4,
          body: `Rinse rice in a fine strainer under cold water until the water runs mostly clear. This washes off surface starch so grains stay separate.

A reliable starting ratio for long-grain white rice is 1 cup rice to 1½–2 cups water. Start with 1¾ cups water if you are unsure.

Use a pot with a tight lid.`,
        },
        {
          slug: "simmer-and-rest",
          title: "Simmer, rest, fluff",
          summary: "Boil, lid on low, then rest off heat.",
          sortOrder: 2,
          estimatedMinutes: 20,
          body: `Bring rice and water to a boil uncovered. Stir once, then cover and drop to the lowest simmer for about 15 minutes.

Do not peek constantly — steam is doing the work.

Turn off the heat and rest, still covered, 5–10 minutes. Then fluff with a fork.`,
        },
      ],
    },
    {
      badge: {
        slug: "seasoned-palate",
        title: "Seasoned palate",
        description: "Finished Taste as you go.",
        emoji: "🧂",
      },
      course: {
        slug: "taste-as-you-go",
        title: "Taste as you go",
        description: "Salt, acid, and heat — the three knobs that fix most bland food.",
        sortOrder: 5,
      },
      lessons: [
        {
          slug: "salt-acid-heat",
          title: "Salt, acid, heat",
          summary: "When food tastes flat, ask which knob is missing.",
          sortOrder: 1,
          estimatedMinutes: 5,
          body: `Taste before you serve. Flat food usually needs salt, a splash of acid (vinegar, lemon), or a little heat (pepper, chili).

Add a pinch, stir, taste again. You can always add more; you cannot easily take it out.

Sweetness (a pinch of sugar) can round sharp tomato or vinegar sauces — use a light hand.`,
        },
        {
          slug: "clean-spoon",
          title: "Clean spoon rule",
          summary: "Do not double-dip the tasting spoon.",
          sortOrder: 2,
          estimatedMinutes: 2,
          body: `Use a clean spoon each time you taste from a shared pot — or pour a little into a cup.

This keeps the pot safe for everyone and keeps your feedback honest.

Write down what fixed a dish once you nail it. Next time is faster.`,
        },
      ],
    },
];

export type HowToSeedResult = {
  badgesCreated: number;
  coursesCreated: number;
  lessonsCreated: number;
  updated: number;
};

/**
 * Idempotent upsert of the How-to catalog by stable slug.
 * Creates missing badges/courses/lessons and links each course to its badge
 * when the course has none. Existing rows keep admin edits unless
 * forceUpdateContent is true. Never touches badge imageUrl/kind, user
 * progress, or awarded badges.
 */
export async function ensureHowToCatalogSeeded(opts?: {
  forceUpdateContent?: boolean;
}): Promise<HowToSeedResult> {
  const force = opts?.forceUpdateContent === true;
  const res: HowToSeedResult = {
    badgesCreated: 0,
    coursesCreated: 0,
    lessonsCreated: 0,
    updated: 0,
  };
  for (const entry of HOWTO_CATALOG) {
    let badge = await prisma.howToBadge.findUnique({
      where: { slug: entry.badge.slug },
    });
    if (!badge) {
      badge = await prisma.howToBadge.create({
        data: { ...entry.badge, kind: "howto" },
      });
      res.badgesCreated += 1;
    } else if (force) {
      badge = await prisma.howToBadge.update({
        where: { id: badge.id },
        data: {
          title: entry.badge.title,
          description: entry.badge.description,
          emoji: entry.badge.emoji,
        },
      });
      res.updated += 1;
    }

    let course = await prisma.howToCourse.findUnique({
      where: { slug: entry.course.slug },
    });
    if (!course) {
      course = await prisma.howToCourse.create({
        data: { ...entry.course, badgeId: badge.id },
      });
      res.coursesCreated += 1;
    } else if (force) {
      course = await prisma.howToCourse.update({
        where: { id: course.id },
        data: {
          title: entry.course.title,
          description: entry.course.description,
          sortOrder: entry.course.sortOrder,
          badgeId: badge.id,
        },
      });
      res.updated += 1;
    } else if (!course.badgeId) {
      course = await prisma.howToCourse.update({
        where: { id: course.id },
        data: { badgeId: badge.id },
      });
      res.updated += 1;
    }

    for (const lesson of entry.lessons) {
      const existing = await prisma.howToLesson.findUnique({
        where: { courseId_slug: { courseId: course.id, slug: lesson.slug } },
      });
      if (!existing) {
        await prisma.howToLesson.create({
          data: { ...lesson, courseId: course.id },
        });
        res.lessonsCreated += 1;
      } else if (force) {
        await prisma.howToLesson.update({
          where: { id: existing.id },
          data: {
            title: lesson.title,
            summary: lesson.summary,
            body: lesson.body,
            sortOrder: lesson.sortOrder,
            estimatedMinutes: lesson.estimatedMinutes,
          },
        });
        res.updated += 1;
      }
    }
  }
  return res;
}
