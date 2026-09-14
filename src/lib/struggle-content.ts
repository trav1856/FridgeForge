/**
 * Struggle Mode–only static resources (budget shopping + kids meals).
 * Not shown in How-to; gated by StruggleModeProvider / localStorage.
 */

export type BudgetTip = {
  id: string;
  title: string;
  body: string;
};

export type KidsMealDeal = {
  id: string;
  place: string;
  note: string;
  /** Day or cadence when known, e.g. "Wed", "Mon", "app Tue" */
  when?: string;
};

export const BUDGET_GROCERY_TIPS: BudgetTip[] = [
  {
    id: "pantry-first",
    title: "Shop pantry-first",
    body: "Open the fridge and cupboards before you leave. Build the list around what you already have so you buy fill-ins, not a second pantry.",
  },
  {
    id: "unit-price",
    title: "Compare unit price",
    body: "Shelf tags show price per ounce or pound. Bigger isn’t always cheaper — check the unit and buy what you’ll actually use.",
  },
  {
    id: "store-brands",
    title: "Try store brands",
    body: "For staples (rice, beans, oats, canned tomatoes, frozen veg, dairy), house brands are usually the same product for less. Swap one aisle at a time.",
  },
  {
    id: "protein-value",
    title: "Beans, eggs, and thighs",
    body: "Dry or canned beans, eggs, and chicken thighs (or drumsticks) stretch further than many “premium” cuts. Season well and you’re set.",
  },
  {
    id: "frozen-produce",
    title: "Frozen produce counts",
    body: "Frozen fruit and veg don’t spoil on the counter, often cost less, and work great in stir-fries, soups, smoothies, and sheet pans.",
  },
  {
    id: "batch-cook",
    title: "Batch cook once, eat twice",
    body: "Cook a pot of rice, beans, or a big tray of roasted veg. Portion leftovers for lunch or a second dinner so busy nights stay cheap.",
  },
  {
    id: "loyalty-apps",
    title: "Use loyalty apps (selectively)",
    body: "Digital coupons and fuel points help when they match your list. Skip “deals” that push extras you wouldn’t buy anyway.",
  },
  {
    id: "season-sales",
    title: "Lean on sales + flexible recipes",
    body: "If chicken is on sale, cook chicken. If not, beans or eggs. Keep a few recipes that swap protein so the flyer drives the cart.",
  },
  {
    id: "waste-less",
    title: "Cut waste, not joy",
    body: "Freeze bread ends, leftover rice, and half cans of tomato. A little planning beats buying more “healthy” food that goes soft in the drawer.",
  },
  {
    id: "flavor-cheap",
    title: "Flavor boosters that pay off",
    body: "Soy sauce, vinegar, chili, garlic, citrus, and toasted spices make cheap staples taste intentional — salt in layers, finish with acid.",
  },
];

export const KIDS_MEAL_DEALS: KidsMealDeal[] = [
  {
    id: "dennys",
    place: "Denny’s",
    note: "Many locations run kids-eat-free (or discounted) with a paying adult — hours and ages vary.",
  },
  {
    id: "ihop",
    place: "IHOP",
    note: "Kids meal promos appear often with purchase of an adult entrée; confirm the current offer locally.",
  },
  {
    id: "smashburger",
    place: "Smashburger",
    when: "Wed",
    note: "Kids eat free on Wednesdays at many locations with a qualifying adult purchase.",
  },
  {
    id: "outback",
    place: "Outback Steakhouse",
    when: "Mon",
    note: "Kids eat free Mondays is a common promo — usually one kids meal per paying adult.",
  },
  {
    id: "dickeys",
    place: "Dickey’s Barbecue Pit",
    when: "Sun",
    note: "Kids eat free Sundays at participating stores with adult purchase.",
  },
  {
    id: "bob-evans",
    place: "Bob Evans",
    when: "app Tue",
    note: "App / rewards Tuesday kids deals show up often — check the app before you go.",
  },
  {
    id: "tgi-fridays",
    place: "TGI Fridays",
    note: "Kids meal deals rotate by market; ask about current family or kids offers.",
  },
  {
    id: "ruby-tuesday",
    place: "Ruby Tuesday",
    note: "Some locations still run kids-eat-free nights — call ahead; not every store participates.",
  },
  {
    id: "wings-and-rings",
    place: "Wings and Rings",
    note: "Kids eat free or discounted nights appear on local calendars — verify day and age cutoff.",
  },
  {
    id: "mellow-mushroom",
    place: "Mellow Mushroom",
    note: "Participating shops run kids specials (often midweek). Policies are location-specific.",
  },
  {
    id: "mod-pizza",
    place: "MOD Pizza",
    note: "Kids pricing / promos vary; some markets have free or discounted kids pies with adult order.",
  },
  {
    id: "freebirds",
    place: "Freebirds World Burrito",
    note: "Kids meal value and occasional free-kids events — check your local Freebirds.",
  },
  {
    id: "tony-romas",
    place: "Tony Roma’s",
    note: "Kids eat free promotions are common on select nights; confirm before driving over.",
  },
  {
    id: "chilis",
    place: "Chili’s",
    note: "Rewards / app offers sometimes include free or discounted kids meals — not a standing free night everywhere.",
  },
  {
    id: "fogo",
    place: "Fogo de Chão",
    note: "Young kids often eat free or steeply discounted with a dining adult — age rules are strict; ask the host.",
  },
  {
    id: "wendys",
    place: "Wendy’s",
    note: "App offers and kids meal combos change often — open the app for current family deals.",
  },
];

export const KIDS_MEAL_CAVEATS = [
  "Deals change without notice and vary by location — verify before you go.",
  "Usually one kids meal per paying adult (or per entrée). Age cutoffs differ.",
  "Call ahead or check the restaurant’s app/site for today’s rules.",
  "FridgeForge is not affiliated with these chains; this is a community snapshot, not an offer.",
] as const;

export const NON_RESTAURANT_KID_FOOD = {
  title: "Free kid food outside restaurants",
  body: "USDA Summer Meals (and similar school-year programs) and local food pantries can cover kids’ meals with no restaurant purchase. Search “USDA Summer Meals near me” or ask your school district / 211 for pantry hours.",
} as const;

export const STRUGGLE_SECTIONS = [
  {
    id: "budget-tips",
    href: "/struggle#budget-tips",
    title: "Budget grocery tips",
    blurb: "Practical shopping habits — pantry-first, unit price, staples that stretch.",
    icon: "🛒",
  },
  {
    id: "kids-meals",
    href: "/struggle#kids-meals",
    title: "Kids eat free / reduced",
    blurb: "National US chain snapshot — verify locally; deals change.",
    icon: "👨‍👩‍👧‍👦",
  },
] as const;
