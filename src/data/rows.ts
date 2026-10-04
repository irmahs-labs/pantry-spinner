/** Any value JSON can carry: what a row of a shared table holds. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * One row of a table, as the API sends it: column name to value. Rows stay
 * this loose on the way in and are read into the app's own types by
 * toVocab and toDemo, which know each table's columns.
 */
export type TableRow = Readonly<Record<string, JsonValue>>;
