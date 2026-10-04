import type { TableRow } from "./rows";

/**
 * The four tables the demo pantry lives in, seeded by the demo migration.
 * Shared by the server, which reads them, and the app, which turns them into a
 * guest's starting snapshot.
 */
export const DEMO_TABLES = [
  "meal_planner_demo_ingredients",
  "meal_planner_demo_ingredient_methods",
  "meal_planner_demo_pantry",
  "meal_planner_demo_shopping_list",
] as const;

export type RawDemo = Record<(typeof DEMO_TABLES)[number], TableRow[]>;
