import type {
  GroceryItem,
  Ingredient,
  PantryItem,
  PlanEntry,
} from "./model";

/**
 * Everything one account keeps: the shape the API sends and receives, the
 * guest tab stores, and the reducer hydrates from. Shared by the app and the
 * server, so both sides agree on it by construction.
 */
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
