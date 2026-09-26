import { supabase } from "../lib/supabase/client";

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
  /** What a serving starts at in this unit. Null: one of the unit is a serving. */
  defaultServing: number | null;
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

/** The reference tables as PostgREST returns them, keyed by table name. */
export type RawVocab = Record<
  (typeof TABLES)[number],
  Record<string, unknown>[]
>;

const TABLES = [
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
 * `missing`     — the project answered but the tables are not there: the migrations have not been applied
 * `refused`     — the project answered and turned the key or the role away
 * `unreachable` — no answer at all
 */
export type LoadFailure = "missing" | "refused" | "unreachable";

/** What `loadVocab` rejects with: a PostgrestError, which is an Error with a code. */
export interface LoadError {
  code?: string;
  message: string;
}

/** Sorts an error from `loadVocab` by the PostgREST or Postgres code it carries. */
export function whyLoadFailed({ code = "", message }: LoadError): LoadFailure {
  // PGRST205: not in PostgREST's schema cache. 42P01: undefined_table.
  if (code === "PGRST205" || code === "42P01") {
    return "missing";
  }
  // 42501: insufficient_privilege. PGRST30x: the JWT, i.e. the anon key.
  if (
    code === "42501" ||
    code.startsWith("PGRST30") ||
    /api key|jwt/iu.test(message)
  ) {
    return "refused";
  }
  return "unreachable";
}

/** Reads every reference table in parallel. Readable without signing in. */
export async function loadVocab(): Promise<Vocab> {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }
  const db = supabase;
  const results = await Promise.all(
    TABLES.map((table) =>
      db
        .from(table)
        .select("*")
        .order(table === "meal_planner_categories" ? "position" : "id")
    )
  );
  const raw = {} as RawVocab;
  results.forEach((result, i) => {
    if (result.error) {
      // PostgREST hands back the parsed body, not an Error: keep its code on a real one.
      throw Object.assign(new Error(result.error.message), {
        code: result.error.code,
      });
    }
    raw[TABLES[i]] = (result.data ?? []) as Record<string, unknown>[];
  });
  return toVocab(raw);
}

/** Turns raw rows into the app's shape. Separate from the fetch so it can be tested. */
export function toVocab(raw: RawVocab): Vocab {
  type Row = Record<string, unknown>;
  const rows = (table: (typeof TABLES)[number]): Row[] => raw[table] ?? [];

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
      id: r.id as number,
      defaultServing:
        r.default_serving === null || r.default_serving === undefined
          ? null
          : Number(r.default_serving),
      isCount: r.is_count as boolean,
      isDefault: r.is_default as boolean,
      label: r.label as string,
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
