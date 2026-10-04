import { ApiError, getJson } from "../lib/api";

/**
 * The app's vocabulary, loaded from the reference tables at startup. Nothing in
 * this file is a word the app uses — it only says what shape the rows have and
 * how to read them. Every label, kind, unit, method, diet rule and dish-name
 * template comes from the database, so rewording anything is an edit there.
 *
 * The three category codes are the one thing fixed here, because they are fixed
 * in the schema too: meal_planner_ingredients has one kind column per category,
 * so a fourth category would be a migration, not a row.
 */
export type CategoryCode = "protein" | "vegetable" | "starch";
const CATEGORY_CODES: ReadonlySet<string> = new Set<CategoryCode>([
  "protein",
  "vegetable",
  "starch",
]);

export interface Category {
  id: number;
  code: CategoryCode;
  label: string;
  position: number;
}
export interface ProteinKind {
  id: number;
  code: string;
  label: string;
  examples: string;
  diet: string;
  redMeat: boolean;
}
export interface VegetableKind {
  id: number;
  code: string;
  label: string;
  examples: string;
  word: string;
}
export interface StarchKind {
  id: number;
  code: string;
  label: string;
  examples: string;
  styleId: number;
  glutenFree: boolean;
}
export interface DishStyle {
  id: number;
  code: string;
  label: string;
  template: string;
}
export interface Unit {
  id: number;
  code: string;
  label: string;
  isCount: boolean;
  isDefault: boolean;
  /** What a serving starts at, in `servingUnit`. Null: one of the unit is a serving. */
  defaultServing: number | null;
  /** The unit a serving is sized in: `g` for `kg`. Null for a unit that is its own serving. */
  servingUnit: string | null;
  /** How many `servingUnit` make one of this unit: 1000 for `kg`. */
  servingFactor: number;
}
export interface Method {
  id: number;
  code: string;
  label: string;
  phrase: string;
}
export interface DietRule {
  id: number;
  code: string;
  label: string;
  excludesDiets: string[];
  excludesRedMeat: boolean;
  requiresGlutenFree: boolean;
}

export interface Vocab {
  /** In reel order, left to right. */
  categories: Category[];
  proteinKinds: ProteinKind[];
  vegetableKinds: VegetableKind[];
  starchKinds: StarchKind[];
  dishStyles: DishStyle[];
  units: Unit[];
  methods: Method[];
  dietRules: DietRule[];
}

export const EMPTY_VOCAB: Vocab = {
  categories: [],
  dietRules: [],
  dishStyles: [],
  methods: [],
  proteinKinds: [],
  starchKinds: [],
  units: [],
  vegetableKinds: [],
};

/** The reference tables as the API returns them, keyed by table name. */
export type RawVocab = Record<
  (typeof VOCAB_TABLES)[number],
  Record<string, unknown>[]
>;

export const VOCAB_TABLES = [
  "meal_planner_categories",
  "meal_planner_protein_kinds",
  "meal_planner_vegetable_kinds",
  "meal_planner_starch_kinds",
  "meal_planner_dish_styles",
  "meal_planner_units",
  "meal_planner_cooking_methods",
  "meal_planner_diet_rules",
] as const;

/**
 * Why the reference tables could not be read.
 *
 * `missing`     — the database answered but the tables are not there: the migrations have not been applied
 * `unreachable` — the API or its database did not answer
 */
export type LoadFailure = "missing" | "unreachable";

/** Sorts an error from `loadVocab` by what the API said, if it said anything. */
export const whyLoadFailed = (error: unknown): LoadFailure =>
  error instanceof ApiError && error.reason === "missing"
    ? "missing"
    : "unreachable";

/** Every reference table, in one request. Readable without signing in. */
export const loadVocab = async (): Promise<Vocab> =>
  toVocab(await getJson<RawVocab>("/api/vocab"));

/** Turns raw rows into the app's shape. Separate from the fetch so it can be tested. */
export function toVocab(raw: RawVocab): Vocab {
  type Row = Record<string, unknown>;
  const rows = (table: (typeof VOCAB_TABLES)[number]): Row[] => raw[table] ?? [];
  // A unit's serving unit is another row of the same table, referenced by id.
  const unitCodes = new Map(
    rows("meal_planner_units").map((r) => [r.id, String(r.code)])
  );

  return {
    categories: rows("meal_planner_categories")
      .filter((r) => CATEGORY_CODES.has(String(r.code)))
      .map((r) => ({
        code: r.code as CategoryCode,
        id: r.id as number,
        label: r.label as string,
        position: r.position as number,
      }))
      .sort((a, b) => a.position - b.position),
    dietRules: rows("meal_planner_diet_rules").map((r) => ({
      code: r.code as string,
      excludesDiets: (r.excludes_diets as string[]) ?? [],
      excludesRedMeat: r.excludes_red_meat as boolean,
      id: r.id as number,
      label: r.label as string,
      requiresGlutenFree: r.requires_gluten_free as boolean,
    })),
    dishStyles: rows("meal_planner_dish_styles").map((r) => ({
      code: r.code as string,
      id: r.id as number,
      label: r.label as string,
      template: r.name_template as string,
    })),
    methods: rows("meal_planner_cooking_methods").map((r) => ({
      code: r.code as string,
      id: r.id as number,
      label: r.label as string,
      phrase: r.phrase as string,
    })),
    proteinKinds: rows("meal_planner_protein_kinds").map((r) => ({
      code: r.code as string,
      diet: r.diet as string,
      examples: r.examples as string,
      id: r.id as number,
      label: r.label as string,
      redMeat: r.is_red_meat as boolean,
    })),
    starchKinds: rows("meal_planner_starch_kinds").map((r) => ({
      code: r.code as string,
      examples: r.examples as string,
      glutenFree: r.gluten_free as boolean,
      id: r.id as number,
      label: r.label as string,
      styleId: r.id_dish_style as number,
    })),
    units: rows("meal_planner_units").map((r) => ({
      code: r.code as string,
      defaultServing:
        r.default_serving === null || r.default_serving === undefined
          ? null
          : Number(r.default_serving),
      id: r.id as number,
      isCount: r.is_count as boolean,
      isDefault: r.is_default as boolean,
      label: r.label as string,
      servingFactor: Number(r.serving_factor ?? 1),
      servingUnit:
        unitCodes.get(r.id_serving_unit as number | null | undefined) ?? null,
    })),
    vegetableKinds: rows("meal_planner_vegetable_kinds").map((r) => ({
      code: r.code as string,
      examples: r.examples as string,
      id: r.id as number,
      label: r.label as string,
      word: r.cooking_word as string,
    })),
  };
}

// ── Reading it ───────────────────────────────────────────────────────────────

export const categoryCodes = (v: Vocab): CategoryCode[] =>
  v.categories.map((c) => c.code);

export const labelOfCategory = (v: Vocab, code: CategoryCode) =>
  v.categories.find((c) => c.code === code)?.label ?? "";

export const kindsFor = (v: Vocab, category: CategoryCode) =>
  category === "protein"
    ? v.proteinKinds
    : category === "vegetable"
      ? v.vegetableKinds
      : v.starchKinds;

export const defaultUnit = (v: Vocab): string =>
  (v.units.find((u) => u.isDefault) ?? v.units[0])?.code ?? "";

/** The serving a new item in this unit starts on, or null if the unit is its own serving. */
export const defaultServing = (v: Vocab, unit: string): number | null =>
  v.units.find((u) => u.code === unit)?.defaultServing ?? null;

/** Whole servings left, counting a part-serving as one: 100 g at 150 g a serving is 1. */
export const servingsLeft = (quantity: number, serving: number): number =>
  Math.max(0, Math.ceil(quantity / serving - 1e-9));

/** The unit a serving is sized in when stocking in `unit`: grams for kilograms. */
export const servingUnitOf = (v: Vocab, unit: string): string =>
  v.units.find((u) => u.code === unit)?.servingUnit ?? unit;

/** How many serving units make one `unit`: 1000 for kilograms, 1 otherwise. */
export const servingFactorOf = (v: Vocab, unit: string): number =>
  v.units.find((u) => u.code === unit)?.servingFactor ?? 1;

/** One serving, converted into the stock's own unit: 75 g of a kilogram item is 0.075. */
export const servingInUnit = (v: Vocab, unit: string, serving: number) =>
  serving / servingFactorOf(v, unit);

export const methodOf = (v: Vocab, code: string | null | undefined) =>
  code ? v.methods.find((m) => m.code === code) : undefined;

/** "×8" for a count, "600 g" for anything else — which is which is a column. */
export function formatQuantity(
  v: Vocab,
  quantity: number,
  unit: string
): string {
  return v.units.find((u) => u.code === unit)?.isCount
    ? `×${quantity}`
    : `${quantity} ${unit}`;
}
