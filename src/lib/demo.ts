import * as z from "zod/mini";

import type { RawDemo } from "../data/demo-tables";
import type { Ingredient } from "../data/model";
import type { TableRow } from "../data/rows";
import { EMPTY } from "../data/snapshot";
import type { Snapshot } from "../data/snapshot";
import { defaultUnit } from "../data/vocab";
import type { CategoryCode, Vocab } from "../data/vocab";
import { getJson } from "./api";
import { addDaysISO } from "./dates";

export type { RawDemo } from "../data/demo-tables";

// The columns each demo table has, read once here so everything below works
// with real types. A table that does not match reads as empty: the demo is a
// nicety, and a guest still gets in without it.
const id = z.number();
const optionalId = z.nullable(z.number());
const tables = {
  ingredients: z.array(
    z.object({
      gluten_free: z.nullable(z.boolean()),
      id,
      id_category: id,
      id_protein_kind: optionalId,
      id_starch_kind: optionalId,
      id_vegetable_kind: optionalId,
      name: z.string(),
      short_name: z.nullable(z.string()),
    })
  ),
  methods: z.array(z.object({ id_demo_ingredient: id, id_method: id })),
  pantry: z.array(
    z.object({
      days_left: id,
      id_demo_ingredient: id,
      id_unit: id,
      quantity: z.number(),
      serving_size: z.number(),
    })
  ),
  shopping: z.array(
    z.object({
      id_demo_ingredient: id,
      id_unit: id,
      note: z.string(),
      quantity: z.number(),
    })
  ),
};

const rowsOf = <T>(
  schema: z.ZodMiniType<T[]>,
  rows: readonly TableRow[] | undefined
): T[] => {
  const parsed = schema.safeParse(rows);
  return parsed.success ? parsed.data : [];
};

const codeOf = <T extends { id: number; code: string }>(
  rows: T[],
  rowId: number | null
): string | undefined => rows.find((r) => r.id === rowId)?.code;

const CATEGORIES: ReadonlySet<string> = new Set<CategoryCode>([
  "protein",
  "vegetable",
  "starch",
]);
const isCategory = (code: string | undefined): code is CategoryCode =>
  code !== undefined && CATEGORIES.has(code);

/**
 * Turns the demo rows into a guest's starting snapshot. Use-by dates are stored
 * as days from now, and become dates here — so the demo is always as fresh as
 * the day it was written, whenever it is opened.
 */
export const toDemo = (
  raw: RawDemo,
  vocab: Vocab,
  addDays: (days: number) => string = addDaysISO
): Snapshot => {
  const unitOf = (unitId: number) =>
    codeOf(vocab.units, unitId) ?? defaultUnit(vocab);
  const methodOrder = (code: string) =>
    vocab.methods.findIndex((m) => m.code === code);

  const ingredients = rowsOf(
    tables.ingredients,
    raw.meal_planner_demo_ingredients
  );
  const nameOf = new Map(ingredients.map((r) => [r.id, r.name]));

  const ticks = new Map<number, string[]>();
  for (const t of rowsOf(
    tables.methods,
    raw.meal_planner_demo_ingredient_methods
  )) {
    const code = codeOf(vocab.methods, t.id_method);
    if (code) {
      ticks.set(t.id_demo_ingredient, [
        ...(ticks.get(t.id_demo_ingredient) ?? []),
        code,
      ]);
    }
  }

  const catalogue: Ingredient[] = ingredients.flatMap((r) => {
    const category = codeOf(vocab.categories, r.id_category);
    if (!isCategory(category)) {
      return [];
    }
    const kinds = {
      protein: codeOf(vocab.proteinKinds, r.id_protein_kind),
      starch: codeOf(vocab.starchKinds, r.id_starch_kind),
      vegetable: codeOf(vocab.vegetableKinds, r.id_vegetable_kind),
    } satisfies Record<CategoryCode, string | undefined>;
    return [
      {
        category,
        glutenFree: r.gluten_free,
        kind: kinds[category] ?? "",
        methods: (ticks.get(r.id) ?? []).toSorted(
          (a, b) => methodOrder(a) - methodOrder(b)
        ),
        name: r.name,
        shortName: r.short_name,
      },
    ];
  });

  return {
    ...EMPTY,
    catalogue: catalogue.toSorted((a, b) => a.name.localeCompare(b.name)),
    grocery: rowsOf(
      tables.shopping,
      raw.meal_planner_demo_shopping_list
    ).flatMap((r) => {
      const name = nameOf.get(r.id_demo_ingredient);
      return name
        ? [
            {
              acquired: false,
              name,
              note: r.note,
              qty: r.quantity,
              unit: unitOf(r.id_unit),
            },
          ]
        : [];
    }),
    pantry: rowsOf(tables.pantry, raw.meal_planner_demo_pantry).flatMap((r) => {
      const name = nameOf.get(r.id_demo_ingredient);
      return name
        ? [
            {
              expiresOn: addDays(r.days_left),
              name,
              qty: r.quantity,
              serving: r.serving_size,
              unit: unitOf(r.id_unit),
            },
          ]
        : [];
    }),
  };
};

/**
 * The demo pantry a guest starts from. It lives in four tables seeded by the
 * demo migration — nothing about it is in the source — and is readable
 * without signing in. Opening a guest tab copies it into that tab once; after
 * that the guest works on their own copy and the tables never change.
 */
export const loadDemo = async (vocab: Vocab): Promise<Snapshot> =>
  toDemo(await getJson<RawDemo>("/api/demo"), vocab);
