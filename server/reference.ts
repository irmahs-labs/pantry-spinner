import type { PoolClient } from "pg";

import { DEMO_TABLES } from "../src/data/demo-tables";
import type { RawDemo } from "../src/data/demo-tables";
import type { TableRow } from "../src/data/rows";
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
): Promise<Record<T, TableRow[]>> => {
  const results = await Promise.all(
    tables.map((table) =>
      db.query<{ rows: TableRow[] }>(
        // Table names come from the constant lists, never from a request.
        `select coalesce(json_agg(t order by ${
          table === "meal_planner_categories" ? "position" : "t"
        }), '[]') as rows from public.${table} t`
      )
    )
  );
  const entries = tables.map((table, i) => [
    table,
    results[i]?.rows[0]?.rows ?? [],
  ]);
  // SAFETY: built from `tables` itself, so every name in T has its entry.
  return Object.fromEntries(entries) as Record<T, TableRow[]>;
};

export const readVocab = (
  db: PoolClient | typeof pool = pool
): Promise<RawVocab> => readTables(db, VOCAB_TABLES);

export const readDemo = (): Promise<RawDemo> => readTables(pool, DEMO_TABLES);

/** The vocabulary as the app uses it, for translating codes to ids. */
export const loadVocab = async (
  db: PoolClient | typeof pool = pool
): Promise<Vocab> => toVocab(await readVocab(db));
