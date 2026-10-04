import type { PoolClient } from "pg";

import { DEMO_TABLES } from "../src/data/demo-tables";
import type { RawDemo } from "../src/data/demo-tables";
import { toVocab, VOCAB_TABLES } from "../src/data/vocab";
import type { RawVocab, Vocab } from "../src/data/vocab";
import { pool } from "./db";

/**
 * The shared tables: the vocabulary every screen reads its words from, and the
 * demo pantry a guest starts with. Readable without signing in; nobody writes
 * them but a migration.
 *
 * Each table comes back as JSON built by Postgres itself, so numbers stay
 * numbers (pg hands `numeric` over as text) and the result has exactly the
 * shape of the test fixtures, which scripts/vocab-fixture.sh dumps the same way.
 */
const readTables = async <T extends string>(
  db: PoolClient | typeof pool,
  tables: readonly T[]
): Promise<Record<T, Record<string, unknown>[]>> => {
  const results = await Promise.all(
    tables.map((table) =>
      db.query<{ rows: Record<string, unknown>[] }>(
        // Table names come from the constant lists, never from a request.
        `select coalesce(json_agg(t order by ${
          table === "meal_planner_categories" ? "position" : "t"
        }), '[]') as rows from public.${table} t`
      )
    )
  );
  const raw: Partial<Record<T, Record<string, unknown>[]>> = {};
  tables.forEach((table, i) => {
    raw[table] = results[i]?.rows[0]?.rows ?? [];
  });
  // SAFETY: every name in `tables` was assigned in the loop above.
  return raw as Record<T, Record<string, unknown>[]>;
};

export const readVocab = (db: PoolClient | typeof pool = pool): Promise<RawVocab> =>
  readTables(db, VOCAB_TABLES);

export const readDemo = (): Promise<RawDemo> => readTables(pool, DEMO_TABLES);

/** The vocabulary as the app uses it, for translating codes to ids. */
export const loadVocab = async (db: PoolClient | typeof pool = pool): Promise<Vocab> =>
  toVocab(await readVocab(db));
