/**
 * Drawings, not data. These are SVG path strings keyed by the codes the
 * database uses, so an icon follows its row wherever it appears. A code the
 * database has and this file does not — a dish style added in the dashboard,
 * say — gets a plain fallback rather than breaking the screen.
 *
 * 24px glyphs at stroke-width 2.75; multiple paths are separated by "|".
 */

/** SVG paths by a database code; a code may be missing, so lookups fall back. */
interface PathsByCode {
  [code: string]: string;
}

const DISH: PathsByCode = {
  bowl: "M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z|M7 21h10|M5 12a7 6 0 0 1 14 0|M10 8h.01|M14 9h.01|M12 6h.01",
  noodles:
    "M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z|M7 21h10|M13 3l-3 9|M19 3l-5 9|M6 12c0-1.5 1.5-1.5 1.5-3|M9.5 12c0-1.5 1.5-1.5 1.5-3",
  roast:
    "M3 14h18|M5 14v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3|M7 14a5 4 0 0 1 10 0|M12 10V8",
  salad:
    "M7 21h10|M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z|M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1|m13 12 4-4|M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2",
  skillet:
    "M2 11h14v2a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5v-2Z|M16 12h6|M6 7c0-1 1-1.5 1-2.5|M10 7c0-1 1-1.5 1-2.5",
  tacos:
    "M2 18a10 10 0 0 1 20 0Z|M5 13c1-1.2 2-.2 3-1.4s2-.2 3-1.4 2-.2 3-1.4 2-.2 3 1",
};

// Lucide: egg, carrot, wheat
const CAT = [
  "M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z",
  "M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46|M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z|M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z",
  "M2 22 16 8|M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z|M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z|M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z|M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z|M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z|M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z|M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
];

// Lucide: cooking-pot, utensils-crossed, chef-hat, carrot, soup, salad
export const COOK_ICONS = [
  "M2 12h20|M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8|m4 8-2-2|m18 8 2-2|m19 5 3-3|m5 5-3-3",
  "m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8|M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7|M2.1 21.8 13 11|m9 11 1.5 1.5",
  "M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z|M6 17h12",
  CAT[1],
  "M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z|M7 21h10|M19.5 12 22 6|M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62|M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62|M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62",
  DISH.salad,
];

/** A plain plate, for any dish style this file has no drawing for. */
const PLATE =
  "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z|M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z";

/** Lucide: egg, carrot, wheat — by category code. */
const CATEGORY: PathsByCode = {
  protein: CAT[0],
  starch: CAT[2],
  vegetable: CAT[1],
};

export const dishIcon = (styleCode: string | undefined) =>
  (styleCode && DISH[styleCode]) || PLATE;

export const categoryIcon = (code: string) => CATEGORY[code] ?? PLATE;
