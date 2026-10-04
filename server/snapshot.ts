import type { PoolClient } from "pg";

import type { Ingredient } from "../src/data/model";
import type { Snapshot } from "../src/data/snapshot";
import { defaultUnit } from "../src/data/vocab";
import type { CategoryCode, Vocab } from "../src/data/vocab";

/**
 * Reading and writing one account's rows. The app works in names and codes;
 * the tables key on ids. This is the one place that translates between them,
 * and every statement here is scoped to the account the session named.
 */

/** Code ⇄ id for each reference table, from the rows the server loaded. */
const lookups = (v: Vocab) => {
  const pair = <T extends { id: number; code: string }>(rows: T[]) => ({
    code: new Map(rows.map((r) => [r.id, r.code])),
    id: new Map(rows.map((r) => [r.code, r.id])),
  });
  return {
    category: pair(v.categories),
    method: pair(v.methods),
    protein: pair(v.proteinKinds),
    starch: pair(v.starchKinds),
    unit: pair(v.units),
    vegetable: pair(v.vegetableKinds),
  };
};
type Lookups = ReturnType<typeof lookups>;

/** A code the reference tables do not have: the request is wrong, not the server. */
export class UnknownCode extends Error {}

const idOf = (map: Map<string, number>, code: string, what: string): number => {
  const id = map.get(code);
  if (id === undefined) {
    throw new UnknownCode(`Unknown ${what}: ${code}`);
  }
  return id;
};

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

const toIngredient = (
  row: IngredientRow,
  l: Lookups,
  methods: string[]
): Ingredient => {
  // SAFETY: id_category references meal_planner_categories, whose codes are
  // the three CategoryCode values the schema's check constraint allows.
  const category = (l.category.code.get(row.id_category) ??
    "protein") as CategoryCode;
  const kindId =
    category === "protein"
      ? row.id_protein_kind
      : category === "vegetable"
        ? row.id_vegetable_kind
        : row.id_starch_kind;
  const kinds =
    category === "protein"
      ? l.protein
      : category === "vegetable"
        ? l.vegetable
        : l.starch;
  return {
    category,
    glutenFree: row.gluten_free,
    kind: kindId === null ? "" : (kinds.code.get(kindId) ?? ""),
    methods,
    name: row.name,
    shortName: row.short_name,
  };
};

/** Everything the account has stored. A new account comes back empty. */
export const loadSnapshot = async (
  db: PoolClient,
  userId: string,
  vocab: Vocab
): Promise<Snapshot> => {
  const l = lookups(vocab);
  const [ingredients, ticks, pantry, history, links, list, methods] =
    await Promise.all([
      db.query<IngredientRow>(
        `select id, name, short_name, id_category, id_protein_kind,
                id_vegetable_kind, id_starch_kind, gluten_free
         from meal_planner_ingredients where user_id = $1 order by name`,
        [userId]
      ),
      db.query<{ id_ingredient: string; id_method: number }>(
        `select id_ingredient, id_method from meal_planner_ingredient_methods
         where user_id = $1`,
        [userId]
      ),
      db.query<{
        id_ingredient: string;
        quantity: number;
        id_unit: number;
        serving_size: number;
        date_expiration: string;
      }>(
        `select id_ingredient, quantity::float8 as quantity, id_unit,
                serving_size::float8 as serving_size,
                date_expiration::text as date_expiration
         from meal_planner_pantry where user_id = $1`,
        [userId]
      ),
      db.query<{
        id: string;
        name_meal: string;
        note: string;
        dish_style: string | null;
        id_method: number | null;
        date_cooked: string;
      }>(
        `select id, name_meal, note, dish_style, id_method,
                date_cooked::text as date_cooked
         from meal_planner_history where user_id = $1
         order by date_cooked desc, created_at desc`,
        [userId]
      ),
      db.query<{ id_history: string; id_ingredient: string }>(
        `select id_history, id_ingredient from meal_planner_history_ingredients
         where user_id = $1`,
        [userId]
      ),
      db.query<{
        id_ingredient: string;
        quantity: number;
        id_unit: number;
        note: string;
        acquired: boolean;
      }>(
        `select id_ingredient, quantity::float8 as quantity, id_unit, note, acquired
         from meal_planner_shopping_list where user_id = $1
         order by created_at desc`,
        [userId]
      ),
      db.query<{ id_method: number; enabled: boolean }>(
        `select id_method, enabled from meal_planner_method_settings
         where user_id = $1`,
        [userId]
      ),
    ]);

  const nameOf = new Map(ingredients.rows.map((row) => [row.id, row.name]));
  const unitCode = (id: number) => l.unit.code.get(id) ?? defaultUnit(vocab);

  // In the table's own order, so a ticked list reads the same everywhere.
  const methodOrder = new Map(vocab.methods.map((m, i) => [m.code, i]));
  const ticksOf = new Map<string, string[]>();
  for (const t of ticks.rows) {
    const code = l.method.code.get(t.id_method);
    if (code) {
      ticksOf.set(t.id_ingredient, [...(ticksOf.get(t.id_ingredient) ?? []), code]);
    }
  }
  for (const codes of ticksOf.values()) {
    codes.sort((a, b) => (methodOrder.get(a) ?? 0) - (methodOrder.get(b) ?? 0));
  }

  const linksByMeal = new Map<string, string[]>();
  for (const link of links.rows) {
    const name = nameOf.get(link.id_ingredient);
    if (name) {
      linksByMeal.set(link.id_history, [...(linksByMeal.get(link.id_history) ?? []), name]);
    }
  }

  return {
    catalogue: ingredients.rows.map((row) =>
      toIngredient(row, l, ticksOf.get(row.id) ?? [])
    ),
    grocery: list.rows.flatMap((row) => {
      const name = nameOf.get(row.id_ingredient);
      return name
        ? [
            {
              acquired: row.acquired,
              name,
              note: row.note,
              qty: row.quantity,
              unit: unitCode(row.id_unit),
            },
          ]
        : [];
    }),
    methodsOff: methods.rows
      .filter((row) => !row.enabled)
      .flatMap((row) => {
        const code = l.method.code.get(row.id_method);
        return code ? [code] : [];
      }),
    pantry: pantry.rows.flatMap((row) => {
      const name = nameOf.get(row.id_ingredient);
      return name
        ? [
            {
              expiresOn: row.date_expiration,
              name,
              qty: row.quantity,
              serving: row.serving_size,
              unit: unitCode(row.id_unit),
            },
          ]
        : [];
    }),
    plan: history.rows.map((row) => ({
      cookedOn: row.date_cooked,
      dish: row.name_meal,
      id: row.id,
      ingredients: linksByMeal.get(row.id) ?? [],
      method: row.id_method ? (l.method.code.get(row.id_method) ?? null) : null,
      note: row.note,
      style: row.dish_style ?? "",
    })),
  };
};

const removed = <T>(prev: T[], next: T[], key: (item: T) => string): string[] => {
  const kept = new Set(next.map(key));
  return prev.map(key).filter((k) => !kept.has(k));
};

/**
 * Makes the stored rows match `next`, writing only what differs from what is
 * stored now. Call inside a transaction: a failure part-way leaves nothing
 * half-saved. Ingredients are never deleted here, as before: the app has no
 * way to remove one, and pantry, list and history rows point at them.
 */
export const saveSnapshot = async (
  db: PoolClient,
  userId: string,
  next: Snapshot,
  vocab: Vocab
): Promise<void> => {
  const l = lookups(vocab);
  const prev = await loadSnapshot(db, userId, vocab);

  // Ingredients first: every other table points at one, so it has to exist.
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
  for (const item of ingredientChanged) {
    const kinds =
      item.category === "protein"
        ? l.protein
        : item.category === "vegetable"
          ? l.vegetable
          : l.starch;
    const kindId = idOf(kinds.id, item.kind, `${item.category} kind`);
    const { rows } = await db.query<{ id: string }>(
      `insert into meal_planner_ingredients
         (user_id, name, short_name, id_category, id_protein_kind,
          id_vegetable_kind, id_starch_kind, gluten_free)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (user_id, name) do update set
         short_name = excluded.short_name, id_category = excluded.id_category,
         id_protein_kind = excluded.id_protein_kind,
         id_vegetable_kind = excluded.id_vegetable_kind,
         id_starch_kind = excluded.id_starch_kind,
         gluten_free = excluded.gluten_free
       returning id`,
      [
        userId,
        item.name,
        item.shortName,
        idOf(l.category.id, item.category, "category"),
        item.category === "protein" ? kindId : null,
        item.category === "vegetable" ? kindId : null,
        item.category === "starch" ? kindId : null,
        item.category === "starch" ? item.glutenFree : null,
      ]
    );
    const ingredientId = rows[0]?.id;
    // Ticks are replaced whole for an ingredient whose row changed.
    await db.query(
      `delete from meal_planner_ingredient_methods
       where user_id = $1 and id_ingredient = $2`,
      [userId, ingredientId]
    );
    const methodIds = item.methods.map((code) => idOf(l.method.id, code, "method"));
    if (methodIds.length) {
      await db.query(
        `insert into meal_planner_ingredient_methods (user_id, id_ingredient, id_method)
         select $1, $2, unnest($3::smallint[])`,
        [userId, ingredientId, methodIds]
      );
    }
  }

  // Every name below resolves to the account's own ingredient, or the write fails.
  const { rows: idRows } = await db.query<{ id: string; name: string }>(
    "select id, name from meal_planner_ingredients where user_id = $1",
    [userId]
  );
  const ids = new Map(idRows.map((row) => [row.name, row.id]));
  const ingredientId = (name: string): string => {
    const id = ids.get(name);
    if (!id) {
      throw new UnknownCode(`Unknown ingredient: ${name}`);
    }
    return id;
  };

  const pantryChanged = next.pantry.filter((item) => {
    const before = prev.pantry.find((p) => p.name === item.name);
    return (
      !before ||
      before.expiresOn !== item.expiresOn ||
      before.serving !== item.serving ||
      before.qty !== item.qty ||
      before.unit !== item.unit
    );
  });
  for (const item of pantryChanged) {
    await db.query(
      `insert into meal_planner_pantry
         (user_id, id_ingredient, quantity, id_unit, serving_size, date_expiration)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, id_ingredient) do update set
         quantity = excluded.quantity, id_unit = excluded.id_unit,
         serving_size = excluded.serving_size,
         date_expiration = excluded.date_expiration`,
      [
        userId,
        ingredientId(item.name),
        item.qty,
        idOf(l.unit.id, item.unit, "unit"),
        item.serving,
        item.expiresOn,
      ]
    );
  }
  const pantryGone = removed(prev.pantry, next.pantry, (item) => item.name);
  if (pantryGone.length) {
    await db.query(
      `delete from meal_planner_pantry
       where user_id = $1 and id_ingredient = any($2::uuid[])`,
      [userId, pantryGone.map(ingredientId)]
    );
  }

  const planAdded = next.plan.filter((entry) => !prev.plan.some((p) => p.id === entry.id));
  for (const entry of planAdded) {
    await db.query(
      `insert into meal_planner_history
         (id, user_id, name_meal, note, dish_style, id_method, date_cooked)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.id,
        userId,
        entry.dish,
        entry.note,
        // Blank when the draw had no starch to take a style from.
        entry.style || null,
        entry.method ? idOf(l.method.id, entry.method, "method") : null,
        entry.cookedOn,
      ]
    );
    const linked = [...new Set(entry.ingredients)].map(ingredientId);
    if (linked.length) {
      await db.query(
        `insert into meal_planner_history_ingredients (user_id, id_history, id_ingredient)
         select $1, $2, unnest($3::uuid[])`,
        [userId, entry.id, linked]
      );
    }
  }
  const planGone = removed(prev.plan, next.plan, (entry) => entry.id);
  if (planGone.length) {
    await db.query(
      "delete from meal_planner_history where user_id = $1 and id = any($2::uuid[])",
      [userId, planGone]
    );
  }

  const groceryChanged = next.grocery.filter((item) => {
    const before = prev.grocery.find((g) => g.name === item.name);
    return (
      !before ||
      before.acquired !== item.acquired ||
      before.qty !== item.qty ||
      before.unit !== item.unit ||
      before.note !== item.note
    );
  });
  for (const item of groceryChanged) {
    await db.query(
      `insert into meal_planner_shopping_list
         (user_id, id_ingredient, quantity, id_unit, note, acquired)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, id_ingredient) do update set
         quantity = excluded.quantity, id_unit = excluded.id_unit,
         note = excluded.note, acquired = excluded.acquired`,
      [
        userId,
        ingredientId(item.name),
        item.qty,
        idOf(l.unit.id, item.unit, "unit"),
        item.note,
        item.acquired,
      ]
    );
  }
  const groceryGone = removed(prev.grocery, next.grocery, (item) => item.name);
  if (groceryGone.length) {
    await db.query(
      `delete from meal_planner_shopping_list
       where user_id = $1 and id_ingredient = any($2::uuid[])`,
      [userId, groceryGone.map(ingredientId)]
    );
  }

  // A settings row exists only for a method that is off, so switching one back
  // on deletes its row rather than storing enabled = true.
  const turnedOff = next.methodsOff.filter((code) => !prev.methodsOff.includes(code));
  const turnedOn = prev.methodsOff.filter((code) => !next.methodsOff.includes(code));
  if (turnedOff.length) {
    await db.query(
      `insert into meal_planner_method_settings (user_id, id_method, enabled)
       select $1, unnest($2::smallint[]), false
       on conflict (user_id, id_method) do update set enabled = false`,
      [userId, turnedOff.map((code) => idOf(l.method.id, code, "method"))]
    );
  }
  if (turnedOn.length) {
    await db.query(
      `delete from meal_planner_method_settings
       where user_id = $1 and id_method = any($2::smallint[])`,
      [userId, turnedOn.map((code) => idOf(l.method.id, code, "method"))]
    );
  }
};
