import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch } from "react";

import { EMPTY } from "../data/snapshot";
import type { Snapshot } from "../data/snapshot";
import { loadVocab, whyLoadFailed } from "../data/vocab";
import type { LoadFailure } from "../data/vocab";
import { snapshotOf } from "../state/planner";
import type { Action, PlannerState } from "../state/planner";
import { currentAccount, signOut as signOutEverywhere } from "./account";
import type { Account } from "./account";
import { loadDemo } from "./demo";
import * as guest from "./guest";
import { loadSnapshot, saveSnapshot } from "./remote";

/**
 * `booting`    — loading the vocabulary, then finding out who you are
 * `signed-out` — the sign-in page
 * `ready`      — the app
 * `broken`     — the vocabulary could not be loaded, and without it the app has
 *                no words for anything, so it says so instead of opening empty
 */
export type Phase = "booting" | "signed-out" | "ready" | "broken";

export interface RemoteSync {
  phase: Phase;
  /** Set when `phase` is `broken`: what went wrong reading the reference tables. */
  failure: LoadFailure | null;
  email: string | null;
  /** Looking around without an account: this tab only, nothing saved anywhere else. */
  guest: boolean;
  saveFailed: boolean;
  signOut: () => void;
  startGuest: () => void | Promise<void>;
}

const sameSnapshot = (a: Snapshot, b: Snapshot) =>
  a.catalogue === b.catalogue &&
  a.pantry === b.pantry &&
  a.plan === b.plan &&
  a.grocery === b.grocery &&
  a.methodsOff === b.methodsOff;

/**
 * Loads the vocabulary, then mirrors the reducer into storage: hydrate on
 * opening, and save on every state change after. Signed in, that store is the
 * app's API. As a guest it is sessionStorage, so the pantry survives a reload
 * and dies with the tab.
 */
export const useRemoteSync = (
  state: PlannerState,
  dispatch: Dispatch<Action>
): RemoteSync => {
  const [isGuest, setIsGuest] = useState(guest.isGuest);
  const [vocabReady, setVocabReady] = useState(false);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [phase, setPhase] = useState<Phase>("booting");
  const [account, setAccount] = useState<Account | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const synced = useRef<Snapshot | null>(null);

  // Everything else waits on this: no screen has a word to show without it.
  useEffect(() => {
    let cancelled = false;
    loadVocab()
      .then((vocab) => {
        if (!cancelled) {
          dispatch({ type: "vocab/load", vocab });
          setVocabReady(true);
        }
      })
      .catch((error: unknown) => {
        console.error("Could not load the reference tables", error);
        if (!cancelled) {
          setFailure(whyLoadFailed(error));
          setPhase("broken");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // A guest reload picks the pantry back up out of this tab's storage.
  useEffect(() => {
    if (!vocabReady || !isGuest || synced.current) {
      return;
    }
    const stored = guest.loadGuest();
    dispatch({ snapshot: stored, type: "state/hydrate" });
    synced.current = stored;
    setPhase("ready");
  }, [vocabReady, isGuest, dispatch]);

  // Signed in or not is decided once per page load: signing in and out both
  // happen on the account service's page, and both come back with a reload.
  useEffect(() => {
    if (!vocabReady || isGuest) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const who = await currentAccount();
        if (cancelled) {
          return;
        }
        setAccount(who);
        if (!who) {
          setPhase("signed-out");
          return;
        }
        const stored = await loadSnapshot();
        if (cancelled) {
          return;
        }
        dispatch({ snapshot: stored, type: "state/hydrate" });
        synced.current = stored;
        setSaveFailed(false);
        setPhase("ready");
      } catch (error) {
        console.error("Could not load your pantry", error);
        if (!cancelled) {
          setSaveFailed(true);
          setPhase("ready");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vocabReady, isGuest, dispatch]);

  // One save at a time, always of the newest state: two in flight could land
  // out of order and leave the older one stored.
  const queued = useRef<Snapshot | null>(null);
  const saving = useRef(false);
  const flush = useCallback(async () => {
    if (saving.current) {
      return;
    }
    saving.current = true;
    while (queued.current) {
      const next = queued.current;
      queued.current = null;
      try {
        await saveSnapshot(next);
        setSaveFailed(false);
      } catch (error) {
        console.error("Could not save that change", error);
        setSaveFailed(true);
      }
    }
    saving.current = false;
  }, []);

  useEffect(() => {
    const prev = synced.current;
    if (phase !== "ready" || !prev) {
      return;
    }
    const next = snapshotOf(state);
    if (sameSnapshot(prev, next)) {
      return;
    }
    synced.current = next;

    if (isGuest) {
      guest.saveGuest(next);
      return;
    }
    if (!account) {
      return;
    }
    queued.current = next;
    flush();
  }, [state, account, phase, isGuest, flush]);

  const starting = useRef(false);
  const { vocab } = state;
  const startGuest = useCallback(async () => {
    if (!vocabReady || starting.current) {
      return;
    }
    starting.current = true;
    // The demo is a nicety: if it cannot be read, the guest starts empty rather
    // than not at all.
    const start = await loadDemo(vocab).catch((error: unknown) => {
      console.error("Could not load the demo pantry", error);
      return EMPTY;
    });
    starting.current = false;
    guest.startGuest(start);
    dispatch({ snapshot: start, type: "state/hydrate" });
    synced.current = start;
    setIsGuest(true);
    setPhase("ready");
  }, [vocabReady, vocab, dispatch]);

  const signOut = useCallback(() => {
    if (isGuest) {
      guest.endGuest();
      synced.current = null;
      dispatch({ snapshot: EMPTY, type: "state/hydrate" });
      setIsGuest(false);
      setPhase("signed-out");
      return;
    }
    signOutEverywhere();
  }, [isGuest, dispatch]);

  return {
    email: account?.email ?? null,
    failure,
    guest: isGuest,
    phase,
    saveFailed,
    signOut,
    startGuest,
  };
};
