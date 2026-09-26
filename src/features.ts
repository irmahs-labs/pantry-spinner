/**
 * Features that are built but switched off.
 *
 * `history` — the Cooked screen: the sidebar entry, the screen, and landing on
 * it after "Into the pot". Recording does not wait on it. Every dish sent into
 * the pot is written to meal_planner_history either way, and the Draw screen
 * reads yesterday's back from there.
 */
export const FEATURES = {
  history: false,
} as const;
