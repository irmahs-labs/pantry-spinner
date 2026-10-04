import type { RawDemo } from "../data/demo-tables";
import type { Ingredient } from "../data/model";
import { EMPTY } from "../data/snapshot";
import type { Snapshot } from "../data/snapshot";
import { defaultUnit } from "../data/vocab";
import type { CategoryCode, Vocab } from "../data/vocab";
import { getJson } from "./api";
import { addDaysISO } from "./dates";

export type { RawDemo } from "../data/demo-tables";

/**
 * The demo pantry a guest starts from. It lives in four tables seeded by the
 * demo migration — nothing about it is in the source — and is readable
 * without signing in. Opening a guest tab copies it into that tab once; after
 * that the guest works on their own copy and the tables never change.
 */
export const loadDemo = async (vocab: Vocab): Promise<Snapshot> =>
  toDemo(await getJson<RawDemo>("/api/demo"), vocab);

/**
 * Turns the demo rows into a guest's starting snapshot. Use-by dates are stored
 * as days from now, and become dates here — so the demo is always as fresh as
 * the day it was written, whenever it is opened.
 */
export function toDemo(
  raw: RawDemo,
  vocab: Vocab,
  addDays: (days: number) => string = addDaysISO
): Snapshot {
  const codeOf = <T extends { id: number; code: string }>(
    rows: T[],
    id: unknown
  ) => rows.find((r) => r.id === id)?.code;
  const unitOf = (id: unknown) => codeOf(vocab.units, id) ?? defaultUnit(vocab);
  const methodOrder = (code: string) =>
    vocab.methods.findIndex((m) => m.code === code);

  const ingredients = raw.meal_planner_demo_ingredients ?? [];
  const nameOf = new Map(ingredients.map((r) => [r.id, r.name as string]));

  const ticks = new Map<unknown, string[]>();
  for (const t of raw.meal_planner_demo_ingredient_methods ?? []) {
    const code = codeOf(vocab.methods, t.id_method);
    if (code) {
      ticks.set(t.id_demo_ingredient, [
        ...(ticks.get(t.id_demo_ingredient) ?? []),
        code,
      ]);
    }
  }

  const catalogue: Ingredient[] = ingredients.flatMap((r) => {
    const category = codeOf(vocab.categories, r.id_category) as
      | CategoryCode
      | undefined;
    if (!category) {
      return [];
    }
    const kind =
      category === "protein"
        ? codeOf(vocab.proteinKinds, r.id_protein_kind)
        : category === "vegetable"
          ? codeOf(vocab.vegetableKinds, r.id_vegetable_kind)
          : codeOf(vocab.starchKinds, r.id_starch_kind);
    return [
      {
        category,
        glutenFree: (r.gluten_free as boolean | null) ?? null,
        kind: kind ?? "",
        methods: (ticks.get(r.id) ?? []).sort(
          (a, b) => methodOrder(a) - methodOrder(b)
        ),
        name: r.name as string,
        shortName: (r.short_name as string | null) ?? null,
      },
    ];
  });

  return {
    ...EMPTY,
    catalogue: catalogue.sort((a, b) => a.name.localeCompare(b.name)),
    grocery: (raw.meal_planner_demo_shopping_list ?? []).flatMap((r) => {
      const name = nameOf.get(r.id_demo_ingredient);
      return name
        ? [
            {
              name,
              qty: Number(r.quantity),
              unit: unitOf(r.id_unit),
              note: (r.note as string) ?? "",
              acquired: false,
            },
          ]
        : [];
    }),
    pantry: (raw.meal_planner_demo_pantry ?? []).flatMap((r) => {
      const name = nameOf.get(r.id_demo_ingredient);
      return name
        ? [
            {
              name,
              qty: Number(r.quantity),
              unit: unitOf(r.id_unit),
              serving: Number(r.serving_size ?? 1),
              expiresOn: addDays(Number(r.days_left)),
            },
          ]
        : [];
    }),
  };
}
