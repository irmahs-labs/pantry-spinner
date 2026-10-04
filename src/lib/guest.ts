import { EMPTY } from "../data/snapshot";
import type { Snapshot } from "../data/snapshot";

/**
 * Guest mode: a tab you can look around in without an account. It starts from
 * the demo pantry in the database (see src/lib/demo.ts) and lives in
 * sessionStorage, which is scoped to the one tab and cleared when it closes. A
 * reload keeps the pantry; closing the tab loses it. Nothing a guest does is
 * written anywhere but this tab.
 */
const KEY = "spin-supper:guest";

export const isGuest = () => read() !== null;

export function startGuest(start: Snapshot = EMPTY): void {
  write(start);
}

export const loadGuest = (): Snapshot => read() ?? EMPTY;
export const saveGuest = (snapshot: Snapshot) => write(snapshot);

export function endGuest(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable; losing guest data is the expected outcome.
  }
}

function read(): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Snapshot;
    // An older tab may hold ingredients from before methods could be ticked.
    parsed.catalogue = parsed.catalogue.map((i) => ({
      ...i,
      methods: i.methods ?? [],
    }));
    // …and pantry items from before a serving had a size.
    parsed.pantry = parsed.pantry.map((p) => ({ ...p, serving: p.serving ?? 1 }));
    return parsed;
  } catch {
    return null;
  }
}

function write(snapshot: Snapshot): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Private windows and full quotas both land here. The session still works in
    // memory; it just will not survive a reload, which guest mode allows for.
  }
}
