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

/** Code ⇄ id both ways for one reference table. */
const pair = <T extends { id: number; code: string }>(rows: T[]) => ({
  code: new Map(rows.map((r) => [r.id, r.code])),
  id: new Map(rows.map((r) => [r.code, r.id])),
});

/** Code ⇄ id for each reference table, from the rows the server loaded. */
const lookups = (v: Vocab) => ({
  category: pair(v.categories),
  kind: {
    protein: pair(v.proteinKinds),
    starch: pair(v.starchKinds),
    vegetable: pair(v.vegetableKinds),
  } satisfies Record<CategoryCode, ReturnType<typeof pair>>,
  method: pair(v.methods),
  unit: pair(v.units),
});
type Lookups = ReturnType<typeof lookups>;

/** A code the reference tables do not have: the request is wrong, not the server. */
export class UnknownCodeError extends Error {
  override name = "UnknownCodeError";
}

const idOf = (map: Map<string, number>, code: string, what: string): number => {
  const id = map.get(code);
  if (id === undefined) {
    throw new UnknownCodeError(`Unknown ${what}: ${code}`);
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
  const kindIds: Record<CategoryCode, number | null> = {
    protein: row.id_protein_kind,
    starch: row.id_starch_kind,
    vegetable: row.id_vegetable_kind,
  };
  const kindId = kindIds[category];
  const kinds = l.kind[category];
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
      ticksOf.set(t.id_ingredient, [
        ...(ticksOf.get(t.id_ingredient) ?? []),
        code,
      ]);
    }
  }
  for (const codes of ticksOf.values()) {
    codes.sort((a, b) => (methodOrder.get(a) ?? 0) - (methodOrder.get(b) ?? 0));
  }

  const linksByMeal = new Map<string, string[]>();
  for (const link of links.rows) {
    const name = nameOf.get(link.id_ingredient);
    if (name) {
      linksByMeal.set(link.id_history, [
        ...(linksByMeal.get(link.id_history) ?? []),
        name,
      ]);
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

const removed = <T>(
  prev: T[],
  next: T[],
  key: (item: T) => string
): string[] => {
  const kept = new Set(next.map(key));
  return prev.map(key).filter((k) => !kept.has(k));
};

/**
 * The rows of `next` that are new or differ from `prev`, matched by `key`.
 * `same` says whether two versions of one row are equal.
 */
const changed = <T>(
  prev: T[],
  next: T[],
  key: (item: T) => string,
  same: (a: T, b: T) => boolean
): T[] => {
  const before = new Map(prev.map((item) => [key(item), item]));
  return next.filter((item) => {
    const old = before.get(key(item));
    return !old || !same(old, item);
  });
};

/** Ingredients and their ticked methods. Each changed ingredient's ticks are replaced whole. */
const saveCatalogue = async (
  db: PoolClient,
  userId: string,
  l: Lookups,
  prev: Snapshot,
  next: Snapshot
): Promise<void> => {
  const items = changed(
    prev.catalogue,
    next.catalogue,
    (i) => i.name,
    (a, b) =>
      a.category === b.category &&
      a.kind === b.kind &&
      a.shortName === b.shortName &&
      a.glutenFree === b.glutenFree &&
      a.methods.join(",") === b.methods.join(",")
  );
  if (!items.length) {
    return;
  }
  const kindOf = (i: Ingredient, category: CategoryCode) =>
    i.category === category
      ? idOf(l.kind[category].id, i.kind, `${category} kind`)
      : null;
  const { rows } = await db.query<{ id: string; name: string }>(
    `insert into meal_planner_ingredients
       (user_id, name, short_name, id_category, id_protein_kind,
        id_vegetable_kind, id_starch_kind, gluten_free)
     select $1, * from unnest($2::text[], $3::text[], $4::smallint[],
       $5::smallint[], $6::smallint[], $7::smallint[], $8::boolean[])
     on conflict (user_id, name) do update set
       short_name = excluded.short_name, id_category = excluded.id_category,
       id_protein_kind = excluded.id_protein_kind,
       id_vegetable_kind = excluded.id_vegetable_kind,
       id_starch_kind = excluded.id_starch_kind,
       gluten_free = excluded.gluten_free
     returning id, name`,
    [
      userId,
      items.map((i) => i.name),
      items.map((i) => i.shortName),
      items.map((i) => idOf(l.category.id, i.category, "category")),
      items.map((i) => kindOf(i, "protein")),
      items.map((i) => kindOf(i, "vegetable")),
      items.map((i) => kindOf(i, "starch")),
      items.map((i) => (i.category === "starch" ? i.glutenFree : null)),
    ]
  );
  const idByName = new Map(rows.map((r) => [r.name, r.id]));
  const ticks = items.flatMap((i) =>
    i.methods.map((code) => ({
      ingredient: idByName.get(i.name),
      method: idOf(l.method.id, code, "method"),
    }))
  );
  await db.query(
    `delete from meal_planner_ingredient_methods
     where user_id = $1 and id_ingredient = any($2::uuid[])`,
    [userId, rows.map((r) => r.id)]
  );
  if (ticks.length) {
    await db.query(
      `insert into meal_planner_ingredient_methods (user_id, id_ingredient, id_method)
       select $1, * from unnest($2::uuid[], $3::smallint[])`,
      [userId, ticks.map((t) => t.ingredient), ticks.map((t) => t.method)]
    );
  }
};

const savePantry = async (
  db: PoolClient,
  userId: string,
  l: Lookups,
  ingredientId: (name: string) => string,
  prev: Snapshot,
  next: Snapshot
): Promise<void> => {
  const items = changed(
    prev.pantry,
    next.pantry,
    (i) => i.name,
    (a, b) =>
      a.expiresOn === b.expiresOn &&
      a.serving === b.serving &&
      a.qty === b.qty &&
      a.unit === b.unit
  );
  if (items.length) {
    await db.query(
      `insert into meal_planner_pantry
         (user_id, id_ingredient, quantity, id_unit, serving_size, date_expiration)
       select $1, * from unnest($2::uuid[], $3::numeric[], $4::smallint[],
         $5::numeric[], $6::date[])
       on conflict (user_id, id_ingredient) do update set
         quantity = excluded.quantity, id_unit = excluded.id_unit,
         serving_size = excluded.serving_size,
         date_expiration = excluded.date_expiration`,
      [
        userId,
        items.map((i) => ingredientId(i.name)),
        items.map((i) => i.qty),
        items.map((i) => idOf(l.unit.id, i.unit, "unit")),
        items.map((i) => i.serving),
        items.map((i) => i.expiresOn),
      ]
    );
  }
  const gone = removed(prev.pantry, next.pantry, (i) => i.name);
  if (gone.length) {
    await db.query(
      `delete from meal_planner_pantry
       where user_id = $1 and id_ingredient = any($2::uuid[])`,
      [userId, gone.map(ingredientId)]
    );
  }
};

/** Cooked meals are only ever added or removed, never edited. */
const savePlan = async (
  db: PoolClient,
  userId: string,
  l: Lookups,
  ingredientId: (name: string) => string,
  prev: Snapshot,
  next: Snapshot
): Promise<void> => {
  const known = new Set(prev.plan.map((p) => p.id));
  const added = next.plan.filter((entry) => !known.has(entry.id));
  if (added.length) {
    await db.query(
      `insert into meal_planner_history
         (user_id, id, name_meal, note, dish_style, id_method, date_cooked)
       select $1, * from unnest($2::uuid[], $3::text[], $4::text[], $5::text[],
         $6::smallint[], $7::date[])`,
      [
        userId,
        added.map((e) => e.id),
        added.map((e) => e.dish),
        added.map((e) => e.note),
        // Blank when the draw had no starch to take a style from.
        added.map((e) => e.style || null),
        added.map((e) =>
          e.method ? idOf(l.method.id, e.method, "method") : null
        ),
        added.map((e) => e.cookedOn),
      ]
    );
    const links = added.flatMap((e) =>
      [...new Set(e.ingredients)].map((name) => ({
        history: e.id,
        ingredient: ingredientId(name),
      }))
    );
    if (links.length) {
      await db.query(
        `insert into meal_planner_history_ingredients (user_id, id_history, id_ingredient)
         select $1, * from unnest($2::uuid[], $3::uuid[])`,
        [userId, links.map((k) => k.history), links.map((k) => k.ingredient)]
      );
    }
  }
  const gone = removed(prev.plan, next.plan, (e) => e.id);
  if (gone.length) {
    await db.query(
      "delete from meal_planner_history where user_id = $1 and id = any($2::uuid[])",
      [userId, gone]
    );
  }
};

const saveGrocery = async (
  db: PoolClient,
  userId: string,
  l: Lookups,
  ingredientId: (name: string) => string,
  prev: Snapshot,
  next: Snapshot
): Promise<void> => {
  const items = changed(
    prev.grocery,
    next.grocery,
    (i) => i.name,
    (a, b) =>
      a.acquired === b.acquired &&
      a.qty === b.qty &&
      a.unit === b.unit &&
      a.note === b.note
  );
  if (items.length) {
    await db.query(
      `insert into meal_planner_shopping_list
         (user_id, id_ingredient, quantity, id_unit, note, acquired)
       select $1, * from unnest($2::uuid[], $3::numeric[], $4::smallint[],
         $5::text[], $6::boolean[])
       on conflict (user_id, id_ingredient) do update set
         quantity = excluded.quantity, id_unit = excluded.id_unit,
         note = excluded.note, acquired = excluded.acquired`,
      [
        userId,
        items.map((i) => ingredientId(i.name)),
        items.map((i) => i.qty),
        items.map((i) => idOf(l.unit.id, i.unit, "unit")),
        items.map((i) => i.note),
        items.map((i) => i.acquired),
      ]
    );
  }
  const gone = removed(prev.grocery, next.grocery, (i) => i.name);
  if (gone.length) {
    await db.query(
      `delete from meal_planner_shopping_list
       where user_id = $1 and id_ingredient = any($2::uuid[])`,
      [userId, gone.map(ingredientId)]
    );
  }
};

/**
 * A settings row exists only for a method that is off, so switching one back
 * on deletes its row rather than storing enabled = true.
 */
const saveMethods = async (
  db: PoolClient,
  userId: string,
  l: Lookups,
  prev: Snapshot,
  next: Snapshot
): Promise<void> => {
  const ids = (codes: string[]) =>
    codes.map((code) => idOf(l.method.id, code, "method"));
  const turnedOff = next.methodsOff.filter(
    (code) => !prev.methodsOff.includes(code)
  );
  const turnedOn = prev.methodsOff.filter(
    (code) => !next.methodsOff.includes(code)
  );
  if (turnedOff.length) {
    await db.query(
      `insert into meal_planner_method_settings (user_id, id_method, enabled)
       select $1, unnest($2::smallint[]), false
       on conflict (user_id, id_method) do update set enabled = false`,
      [userId, ids(turnedOff)]
    );
  }
  if (turnedOn.length) {
    await db.query(
      `delete from meal_planner_method_settings
       where user_id = $1 and id_method = any($2::smallint[])`,
      [userId, ids(turnedOn)]
    );
  }
};

/**
 * Makes the stored rows match `next`, writing only what differs from what is
 * stored now, one statement per kind of change. Call inside a transaction: a
 * failure part-way leaves nothing half-saved. Ingredients are never deleted
 * here, as before: the app has no way to remove one, and pantry, list and
 * history rows point at them.
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
  await saveCatalogue(db, userId, l, prev, next);

  // Every name below resolves to the account's own ingredient, or the save fails.
  const { rows } = await db.query<{ id: string; name: string }>(
    "select id, name from meal_planner_ingredients where user_id = $1",
    [userId]
  );
  const ids = new Map(rows.map((row) => [row.name, row.id]));
  const ingredientId = (name: string): string => {
    const id = ids.get(name);
    if (!id) {
      throw new UnknownCodeError(`Unknown ingredient: ${name}`);
    }
    return id;
  };

  await savePantry(db, userId, l, ingredientId, prev, next);
  await savePlan(db, userId, l, ingredientId, prev, next);
  await saveGrocery(db, userId, l, ingredientId, prev, next);
  await saveMethods(db, userId, l, prev, next);
};
