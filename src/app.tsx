import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import SignIn from "./components/sign-in";
import type { Ingredient } from "./data/model";
import { labelOfCategory } from "./data/vocab";
import {
  SETTLE_MS,
  canSpin,
  chooseMethods,
  daysLeft,
  emptyReels,
  ingredientOf,
  planSpin,
  reelsFrom,
} from "./engine/reel";
import type { Triple } from "./engine/reel";
import { FEATURES } from "./features";
import { useRemoteSync } from "./lib/use-remote-sync";
import { AddIngredient } from "./screens/add-ingredient";
import { Cooked } from "./screens/cooked";
import { CookingMethods } from "./screens/cooking-methods";
import { Draw } from "./screens/draw";
import { Pantry } from "./screens/pantry";
import { ReelRules } from "./screens/reel-rules";
import { ShoppingList } from "./screens/shopping-list";
import {
  activeRules,
  createInitialState,
  methodsOn,
  plannerReducer,
} from "./state/planner";
import type { Screen } from "./state/planner";

const TITLES: Record<Screen, string> = {
  add: "Add an ingredient",
  list: "Shopping list",
  methods: "Cooking methods",
  pantry: "The pantry",
  plan: "What you cooked",
  setup: "Reel rules",
  spin: "Tonight",
};

export default function App() {
  const [state, dispatch] = useReducer(
    plannerReducer,
    undefined,
    createInitialState
  );
  const { phase, email, failure, guest, saveFailed, signOut, startGuest } =
    useRemoteSync(state, dispatch);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const v = state.vocab;
  const reels = useMemo(
    () => reelsFrom(state.pantry, state.catalogue, v),
    [state.pantry, state.catalogue, v]
  );
  const ready = canSpin(reels, v);

  const spin = useCallback(() => {
    if (state.spinning || !ready) {
      return;
    }
    const plan = planSpin(state.idx, state.locks, reels, {
      catalogue: state.catalogue,
      rules: activeRules(state),
      vocab: v,
      weighting: state.weighting,
    });
    dispatch({ plan, type: "spin/start" });
    // Each pick is cooked one of the ways ticked for it, drawn with the dish.
    const picks = plan.target.map((t, k) =>
      reels[k][t] ? ingredientOf(state.catalogue, reels[k][t].name) : undefined
    ) as Triple<Ingredient | undefined>;
    const methods = chooseMethods(
      picks,
      state.methodsOff,
      state.locks,
      state.methods
    );
    timers.current.push(
      window.setTimeout(
        () => dispatch({ methods, target: plan.target, type: "spin/settle" }),
        SETTLE_MS
      )
    );
  }, [state, reels, ready, v]);

  // Space draws, unless focus is in a control that owns the key.
  useEffect(() => {
    if (state.screen !== "spin") {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.code !== "Space" || !el) {
        return;
      }
      if (
        /^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(el.tagName) ||
        el.getAttribute("role") === "button"
      ) {
        return;
      }
      e.preventDefault();
      spin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.screen, spin]);

  if (phase === "broken") {
    return <SignIn onGuest={startGuest} failure={failure ?? "unreachable"} />;
  }
  if (phase === "signed-out") {
    return <SignIn onGuest={startGuest} />;
  }
  if (phase === "booting") {
    return <div className="shell" />;
  }

  const rotation = methodsOn(state).length;
  const toBuy = state.grocery.filter((g) => !g.acquired).length;
  const expiring = state.pantry.filter((p) => daysLeft(p) <= 3).length;

  const kickers: Record<Screen, string> = {
    add: "Onto the reels",
    list: "Built for you",
    methods: `${rotation} in rotation`,
    pantry: `${state.pantry.length} stocked`,
    plan: "Last seven days",
    setup: "Constraints",
    spin: "Draw a dinner",
  };

  const nav: [Screen, string, number | ""][] = [
    ["spin", "Draw", ""],
    ["pantry", "Pantry", state.pantry.length],
    ["add", "Add ingredient", ""],
    ...(FEATURES.history
      ? ([["plan", "Cooked", state.plan.length]] as [
          Screen,
          string,
          number | "",
        ][])
      : []),
    ["list", "Shopping list", toBuy || ""],
    ["methods", "Cooking methods", rotation],
    ["setup", "Reel rules", ""],
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__title">Slot machine meal planner</div>
          <div className="sidebar__sub">
            {state.pantry.length} in the pantry
          </div>
        </div>
        <nav className="stack" style={{ gap: 6 }} aria-label="Main">
          {nav.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className="nav"
              aria-current={state.screen === key ? "page" : undefined}
              onClick={() => dispatch({ screen: key, type: "screen/go" })}
            >
              <span className="nav__pip" />
              <span className="nav__label">{label}</span>
              <span className="nav__count">{count}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar__foot">
          {saveFailed
            ? "Not saved — check your connection."
            : guest
              ? "Just looking. This pantry goes when the tab closes."
              : "The reels favour whatever is closest to going off."}
          <br />
          <button
            type="button"
            className="nav"
            style={{ marginTop: 10, padding: "8px 0" }}
            onClick={signOut}
          >
            <span className="nav__label">
              {guest ? "Sign in" : (email ?? "Sign out")}
            </span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="topbar__kicker">{kickers[state.screen]}</div>
            <h1 className="topbar__title">{TITLES[state.screen]}</h1>
          </div>
          {ready ? (
            <button
              type="button"
              className="soon-pill"
              onClick={() => dispatch({ screen: "pantry", type: "screen/go" })}
            >
              {expiring} going off soon
            </button>
          ) : (
            <button
              type="button"
              className="soon-pill"
              onClick={() => dispatch({ screen: "pantry", type: "screen/go" })}
            >
              {emptyReels(reels, v).length === v.categories.length
                ? "Nothing stocked"
                : `No ${labelOfCategory(v, emptyReels(reels, v)[0]).toLowerCase()}`}
            </button>
          )}
        </header>

        {state.screen === "spin" && (
          <Draw state={state} dispatch={dispatch} onSpin={spin} />
        )}
        {state.screen === "pantry" && (
          <Pantry state={state} dispatch={dispatch} />
        )}
        {state.screen === "add" && (
          <AddIngredient state={state} dispatch={dispatch} />
        )}
        {state.screen === "plan" && FEATURES.history && (
          <Cooked state={state} />
        )}
        {state.screen === "list" && (
          <ShoppingList state={state} dispatch={dispatch} />
        )}
        {state.screen === "methods" && (
          <CookingMethods state={state} dispatch={dispatch} />
        )}
        {state.screen === "setup" && (
          <ReelRules state={state} dispatch={dispatch} />
        )}
      </main>
    </div>
  );
}
