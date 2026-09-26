import type { CategoryCode } from "./vocab";

/**
 * The app's own types. Codes here (a kind, a unit, a method) are the `code`
 * column of a reference table; the words they stand for live in the database.
 */

export interface Ingredient {
  name: string;
  /** What a dish name calls it — "Chicken" for Chicken Thighs. Null uses `name`. */
  shortName: string | null;
  category: CategoryCode;
  /** A code from the kind table belonging to `category`. */
  kind: string;
  /** Starches only; the kind supplies the default and this is the answer. */
  glutenFree: boolean | null;
  /** The cooking methods ticked for it. A dish is only named after one of these. */
  methods: string[];
}

/** What is actually in the pantry. The reels are built from these alone. */
export interface PantryItem {
  name: string;
  qty: number;
  unit: string;
  /** How much one serving is, in `unit`. 1 for units that are their own serving. */
  serving: number;
  /** The last day it is good for, as an ISO date. Days left are derived from it. */
  expiresOn: string;
}

export interface PlanEntry {
  id: string;
  cookedOn: string;
  dish: string;
  note: string;
  style: string;
  method: string | null;
  ingredients: string[];
}

export interface GroceryItem {
  name: string;
  qty: number;
  unit: string;
  note: string;
  acquired: boolean;
}
