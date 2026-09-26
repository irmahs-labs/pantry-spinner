import type {
  GroceryItem,
  Ingredient,
  PantryItem,
  PlanEntry,
} from "../data/model";
import { defaultUnit } from "../data/vocab";
import type { CategoryCode, Vocab } from "../data/vocab";
import { supabase } from "./supabase/client";

export interface Snapshot {
  catalogue: Ingredient[];
  pantry: PantryItem[];
  plan: PlanEntry[];
  grocery: GroceryItem[];
  methodsOff: string[];
}

export const EMPTY: Snapshot = {
  catalogue: [],
  grocery: [],
  methodsOff: [],
  pantry: [],
  plan: [],
};

const INGREDIENTS = "meal_planner_ingredients";
const INGREDIENT_METHODS = "meal_planner_ingredient_methods";
const PANTRY = "meal_planner_pantry";
const HISTORY = "meal_planner_history";
const HISTORY_INGREDIENTS = "meal_planner_history_ingredients";
const SHOPPING_LIST = "meal_planner_shopping_list";
const METHOD_SETTINGS = "meal_planner_method_settings";

/**
 * Code ⇄ id lookups for one vocabulary. The app talks in codes; the tables key
 * on ids. Both directions come from the rows loaded at startup, so there is no
 * second copy of any id to keep in step with the migration.
 */
function lookups(v: Vocab) {
  const pair = <T extends { id: number; code: string }>(rows: T[]) => ({
    code: new Map(rows.map((r) => [r.id, r.code])),
    id: new Map(rows.map((r) => [r.code, r.id])),
  });
  return {
    category: pair(v.categories),
    method: pair(v.methods),
    protein: pair(v.proteinKinds),
    starch: pair(v.starchKinds),
    style: pair(v.dishStyles),
    unit: pair(v.units),
    vegetable: pair(v.vegetableKinds),
  };
}

interface IngredientRow {
  id: string;
  name: string;
  short_name: string | null;
  id_category: number;
  id_protein_kind: number | null;
  id_vegetable_kind: number | null;
  id_starch_kind: number | null;
  gluten_free: boolean | null;
}

function client() {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }
  return supabase;
}

function orThrow(result: { error: unknown }): void {
  if (result.error) {
    throw result.error;
  }
}

/** The three kind columns, only one of which is ever set. */
function kindColumns(item: Ingredient, l: ReturnType<typeof lookups>) {
  return {
    id_protein_kind:
      item.category === "protein"
        ? (l.protein.id.get(item.kind) ?? null)
        : null,
    id_starch_kind:
      item.category === "starch" ? (l.starch.id.get(item.kind) ?? null) : null,
    id_vegetable_kind:
      item.category === "vegetable"
        ? (l.vegetable.id.get(item.kind) ?? null)
        : null,
  };
}

function toIngredient(
  row: IngredientRow,
  l: ReturnType<typeof lookups>,
  methods: string[]
): Ingredient {
  const category = (l.category.code.get(row.id_category) ??
    "protein") as CategoryCode;
  const kind =
    (category === "protein" && row.id_protein_kind
      ? l.protein.code.get(row.id_protein_kind)
      : null) ??
    (category === "vegetable" && row.id_vegetable_kind
      ? l.vegetable.code.get(row.id_vegetable_kind)
      : null) ??
    (category === "starch" && row.id_starch_kind
      ? l.starch.code.get(row.id_starch_kind)
      : null) ??
    "";
  return {
    category,
    glutenFree: row.gluten_free,
    kind,
    methods,
    name: row.name,
    shortName: row.short_name,
  };
}

/** Resolves the names the app works in to the ids the tables key on. */
async function ingredientIds(
  userId: string,
  names: string[]
): Promise<Map<string, string>> {
  const wanted = [...new Set(names)];
  if (!wanted.length) {
    return new Map();
  }

  const rows = await client()
    .from(INGREDIENTS)
    .select("id, name")
    .eq("user_id", userId)
    .in("name", wanted)
    .returns<{ id: string; name: string }[]>();
  orThrow(rows);
  return new Map((rows.data ?? []).map((row) => [row.name, row.id]));
}

/** Everything the signed-in account has stored. A new account comes back empty. */
export async function loadSnapshot(
  userId: string,
  vocab: Vocab
): Promise<Snapshot> {
  const db = client();
  const l = lookups(vocab);
  const [ingredients, ticks, pantry, history, links, list, methods] =
    await Promise.all([
      db
        .from(INGREDIENTS)
        .select(
          "id, name, short_name, id_category, id_protein_kind, id_vegetable_kind, id_starch_kind, gluten_free"
        )
        .eq("user_id", userId)
        .order("name")
        .returns<IngredientRow[]>(),
      db
        .from(INGREDIENT_METHODS)
        .select("id_ingredient, id_method")
        .eq("user_id", userId)
        .returns<{ id_ingredient: string; id_method: number }[]>(),
      db
        .from(PANTRY)
        .select(
          "id_ingredient, quantity, id_unit, serving_size, date_expiration"
        )
        .eq("user_id", userId)
        .returns<
          {
            id_ingredient: string;
            quantity: number;
            id_unit: number;
            serving_size: number;
            date_expiration: string;
          }[]
        >(),
      db
        .from(HISTORY)
        .select("id, name_meal, note, dish_style, id_method, date_cooked")
        .eq("user_id", userId)
        .order("date_cooked", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<
          {
            id: string;
            name_meal: string;
            note: string;
            dish_style: string | null;
            id_method: number | null;
            date_cooked: string;
          }[]
        >(),
      db
        .from(HISTORY_INGREDIENTS)
        .select("id_history, id_ingredient")
        .returns<{ id_history: string; id_ingredient: string }[]>(),
      db
        .from(SHOPPING_LIST)
        .select("id_ingredient, quantity, id_unit, note, acquired")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .returns<
          {
            id_ingredient: string;
            quantity: number;
            id_unit: number;
            note: string;
            acquired: boolean;
          }[]
        >(),
      db
        .from(METHOD_SETTINGS)
        .select("id_method, enabled")
        .eq("user_id", userId)
        .returns<{ id_method: number; enabled: boolean }[]>(),
    ]);

  [ingredients, ticks, pantry, history, links, list, methods].forEach(orThrow);

  const rows = ingredients.data ?? [];
  const nameOf = new Map(rows.map((row) => [row.id, row.name]));

  // In the table's own order, so a ticked list reads the same everywhere.
  const methodOrder = new Map(vocab.methods.map((m, i) => [m.code, i]));
  const ticksOf = new Map<string, string[]>();
  for (const t of ticks.data ?? []) {
    const code = l.method.code.get(t.id_method);
    if (code) {
      ticksOf.set(t.id_ingredient, [
        ...(ticksOf.get(t.id_ingredient) ?? []),
        code,
      ]);
    }
  }
  for (const list of ticksOf.values()) {
    list.sort((a, b) => (methodOrder.get(a) ?? 0) - (methodOrder.get(b) ?? 0));
  }

  const linksByMeal = new Map<string, string[]>();
  for (const link of links.data ?? []) {
    const name = nameOf.get(link.id_ingredient);
    if (!name) {
      continue;
    }
    linksByMeal.set(link.id_history, [
      ...(linksByMeal.get(link.id_history) ?? []),
      name,
    ]);
  }

  return {
    catalogue: rows.map((row) =>
      toIngredient(row, l, ticksOf.get(row.id) ?? [])
    ),
    grocery: (list.data ?? []).flatMap((row) => {
      const name = nameOf.get(row.id_ingredient);
      return name
        ? [
            {
              acquired: row.acquired,
              name,
              note: row.note,
              qty: Number(row.quantity),
              unit: l.unit.code.get(row.id_unit) ?? defaultUnit(vocab),
            },
          ]
        : [];
    }),
    methodsOff: (methods.data ?? [])
      .filter((row) => !row.enabled)
      .flatMap((row) => {
        const code = l.method.code.get(row.id_method);
        return code ? [code] : [];
      }),
    pantry: (pantry.data ?? []).flatMap((row) => {
      const name = nameOf.get(row.id_ingredient);
      return name
        ? [
            {
              expiresOn: row.date_expiration,
              name,
              qty: Number(row.quantity),
              serving: Number(row.serving_size),
              unit: l.unit.code.get(row.id_unit) ?? defaultUnit(vocab),
            },
          ]
        : [];
    }),
    plan: (history.data ?? []).map((row) => ({
      cookedOn: row.date_cooked,
      dish: row.name_meal,
      id: row.id,
      ingredients: linksByMeal.get(row.id) ?? [],
      method: row.id_method ? (l.method.code.get(row.id_method) ?? null) : null,
      note: row.note,
      style: row.dish_style ?? "",
    })),
  };
}

/**
 * Writes only what changed between two snapshots. Diffing keeps the reducer as
 * the single source of truth — a compound action like "into the pot" needs no
 * persistence path of its own.
 */
export async function writeChanges(
  userId: string,
  prev: Snapshot,
  next: Snapshot,
  vocab: Vocab
): Promise<void> {
  const db = client();
  const l = lookups(vocab);

  // Ingredients go first: every other table points at one, so it has to exist.
  const ingredientChanged = next.catalogue.filter((item) => {
    const before = prev.catalogue.find((p) => p.name === item.name);
    return (
      !before ||
      before.category !== item.category ||
      before.kind !== item.kind ||
      before.shortName !== item.shortName ||
      before.glutenFree !== item.glutenFree ||
      before.methods.join(",") !== item.methods.join(",")
    );
  });
  if (ingredientChanged.length) {
    orThrow(
      await db.from(INGREDIENTS).upsert(
        ingredientChanged.map((item) => ({
          gluten_free: item.category === "starch" ? item.glutenFree : null,
          id_category: l.category.id.get(item.category),
          name: item.name,
          short_name: item.shortName,
          user_id: userId,
          ...kindColumns(item, l),
        })),
        { onConflict: "user_id,name" }
      )
    );
  }

  // Ticks: replaced per ingredient whose list changed. The ingredient row exists
  // by now, so its id resolves and the policy's ownership check can see it.
  if (ingredientChanged.length) {
    const tickIds = await ingredientIds(
      userId,
      ingredientChanged.map((i) => i.name)
    );
    const ids = [...tickIds.values()];
    if (ids.length) {
      orThrow(
        await db
          .from(INGREDIENT_METHODS)
          .delete()
          .eq("user_id", userId)
          .in("id_ingredient", ids)
      );
      const rows = ingredientChanged.flatMap((item) => {
        const id = tickIds.get(item.name);
        return id
          ? item.methods.flatMap((code) => {
              const method = l.method.id.get(code);
              return method
                ? [{ id_ingredient: id, id_method: method, user_id: userId }]
                : [];
            })
          : [];
      });
      if (rows.length) {
        orThrow(await db.from(INGREDIENT_METHODS).insert(rows));
      }
    }
  }

  const pantryUpserts = next.pantry.filter((item) => {
    const before = prev.pantry.find((p) => p.name === item.name);
    return (
      !before ||
      before.expiresOn !== item.expiresOn ||
      before.serving !== item.serving ||
      before.qty !== item.qty ||
      before.unit !== item.unit
    );
  });
  const groceryUpserts = next.grocery.filter((item) => {
    const before = prev.grocery.find((g) => g.name === item.name);
    return (
      !before ||
      before.acquired !== item.acquired ||
      before.qty !== item.qty ||
      before.unit !== item.unit ||
      before.note !== item.note
    );
  });
  const planAdded = next.plan.filter(
    (entry) => !prev.plan.some((p) => p.id === entry.id)
  );

  const ids = await ingredientIds(userId, [
    ...pantryUpserts.map((item) => item.name),
    ...groceryUpserts.map((item) => item.name),
    ...planAdded.flatMap((entry) => entry.ingredients),
  ]);

  if (pantryUpserts.length) {
    orThrow(
      await db.from(PANTRY).upsert(
        pantryUpserts.flatMap((item) => {
          const id = ids.get(item.name);
          return id
            ? [
                {
                  date_expiration: item.expiresOn,
                  id_ingredient: id,
                  id_unit: l.unit.id.get(item.unit),
                  quantity: item.qty,
                  serving_size: item.serving,
                  user_id: userId,
                },
              ]
            : [];
        }),
        { onConflict: "user_id,id_ingredient" }
      )
    );
  }

  const pantryGone = removed(prev.pantry, next.pantry, (item) => item.name);
  if (pantryGone.length) {
    orThrow(await deleteByIngredientName(userId, PANTRY, pantryGone));
  }

  if (planAdded.length) {
    orThrow(
      await db.from(HISTORY).insert(
        planAdded.map((entry) => ({
          date_cooked: entry.cookedOn,
          // Blank when the draw had no starch to take a style from.
          dish_style: entry.style || null,
          id: entry.id,
          id_method: entry.method
            ? (l.method.id.get(entry.method) ?? null)
            : null,
          name_meal: entry.dish,
          note: entry.note,
          user_id: userId,
        }))
      )
    );
    const links = planAdded.flatMap((entry) =>
      entry.ingredients.flatMap((name) => {
        const id = ids.get(name);
        return id ? [{ id_history: entry.id, id_ingredient: id }] : [];
      })
    );
    if (links.length) {
      orThrow(await db.from(HISTORY_INGREDIENTS).insert(links));
    }
  }

  const planGone = removed(prev.plan, next.plan, (entry) => entry.id);
  if (planGone.length) {
    orThrow(
      await db.from(HISTORY).delete().eq("user_id", userId).in("id", planGone)
    );
  }

  if (groceryUpserts.length) {
    orThrow(
      await db.from(SHOPPING_LIST).upsert(
        groceryUpserts.flatMap((item) => {
          const id = ids.get(item.name);
          return id
            ? [
                {
                  acquired: item.acquired,
                  id_ingredient: id,
                  id_unit: l.unit.id.get(item.unit),
                  note: item.note,
                  quantity: item.qty,
                  user_id: userId,
                },
              ]
            : [];
        }),
        { onConflict: "user_id,id_ingredient" }
      )
    );
  }

  const groceryGone = removed(prev.grocery, next.grocery, (item) => item.name);
  if (groceryGone.length) {
    orThrow(await deleteByIngredientName(userId, SHOPPING_LIST, groceryGone));
  }

  // A method setting row exists only for a method that is off, so switching one
  // back on deletes its row rather than storing enabled = true.
  const turnedOff = next.methodsOff.filter(
    (code) => !prev.methodsOff.includes(code)
  );
  const turnedOn = prev.methodsOff.filter(
    (code) => !next.methodsOff.includes(code)
  );
  if (turnedOff.length) {
    orThrow(
      await db.from(METHOD_SETTINGS).upsert(
        turnedOff.map((code) => ({
          enabled: false,
          id_method: l.method.id.get(code),
          user_id: userId,
        })),
        { onConflict: "user_id,id_method" }
      )
    );
  }
  if (turnedOn.length) {
    orThrow(
      await db
        .from(METHOD_SETTINGS)
        .delete()
        .eq("user_id", userId)
        .in(
          "id_method",
          turnedOn.flatMap((code) => {
            const id = l.method.id.get(code);
            return id ? [id] : [];
          })
        )
    );
  }
}

async function deleteByIngredientName(
  userId: string,
  table: typeof PANTRY | typeof SHOPPING_LIST,
  names: string[]
): Promise<{ error: unknown }> {
  const ids = await ingredientIds(userId, names);
  if (!ids.size) {
    return { error: null };
  }
  return client()
    .from(table)
    .delete()
    .eq("user_id", userId)
    .in("id_ingredient", [...ids.values()]);
}

function removed<T>(prev: T[], next: T[], key: (item: T) => string): string[] {
  const kept = new Set(next.map(key));
  return prev.map(key).filter((id) => !kept.has(id));
}
