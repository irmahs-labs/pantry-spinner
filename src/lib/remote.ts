import type { Snapshot } from "../data/snapshot";
import { getJson, putJson } from "./api";

/**
 * The signed-in account's pantry, through the app's API. The API works out
 * which rows changed and writes them in one transaction, so the app only ever
 * sends the whole snapshot as it now stands.
 */
export const loadSnapshot = (): Promise<Snapshot> => getJson<Snapshot>("/api/snapshot");

export const saveSnapshot = (next: Snapshot): Promise<void> =>
  putJson("/api/snapshot", next);
