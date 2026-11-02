import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { Footer } from "./components/footer";
import { Header } from "./components/header";
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
import { useCopy } from "./lib/language";
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

const COPY = {
  en: {
    goingOff: (n: number) => `${n} going off soon`,
    inPantry: (n: number) => `${n} in the pantry`,
    kickers: {
      add: "Onto the reels",
      list: "Built for you",
      methods: (n: number) => `${n} in rotation`,
      pantry: (n: number) => `${n} stocked`,
      plan: "Last seven days",
      setup: "Constraints",
      spin: "Draw a dinner",
    },
    main: "Main",
    nav: {
      add: "Add ingredient",
      list: "Shopping list",
      methods: "Cooking methods",
      pantry: "Pantry",
      plan: "Cooked",
      setup: "Reel rules",
      spin: "Draw",
    } satisfies Record<Screen, string>,
    no: (category: string) => `No ${category}`,
    notes: {
      guest: "Just looking. This pantry goes when the tab closes.",
      saveFailed: "Not saved — check your connection.",
      usual: "The reels favour whatever is closest to going off.",
    },
    nothingStocked: "Nothing stocked",
    signIn: "Sign in",
    signOut: "Sign out",
    titles: {
      add: "Add an ingredient",
      list: "Shopping list",
      methods: "Cooking methods",
      pantry: "The pantry",
      plan: "What you cooked",
      setup: "Reel rules",
      spin: "Tonight",
    } satisfies Record<Screen, string>,
  },
  fr: {
    goingOff: (n: number) => `${n} bientôt périmé${n > 1 ? "s" : ""}`,
    inPantry: (n: number) => `${n} dans le garde-manger`,
    kickers: {
      add: "Sur les rouleaux",
      list: "Faite pour vous",
      methods: (n: number) => `${n} en rotation`,
      pantry: (n: number) => `${n} en stock`,
      plan: "Les sept derniers jours",
      setup: "Contraintes",
      spin: "Tirer un dîner",
    },
    main: "Principal",
    nav: {
      add: "Ajouter un ingrédient",
      list: "Liste de courses",
      methods: "Modes de cuisson",
      pantry: "Garde-manger",
      plan: "Cuisinés",
      setup: "Règles des rouleaux",
      spin: "Tirage",
    } satisfies Record<Screen, string>,
    no: (category: string) => `Pas de ${category}`,
    notes: {
      guest:
        "Simple visite. Ce garde-manger disparaît à la fermeture de l’onglet.",
      saveFailed: "Non enregistré — vérifiez votre connexion.",
      usual: "Les rouleaux favorisent ce qui va périmer le plus tôt.",
    },
    nothingStocked: "Rien en stock",
    signIn: "Se connecter",
    signOut: "Se déconnecter",
    titles: {
      add: "Ajouter un ingrédient",
      list: "Liste de courses",
      methods: "Modes de cuisson",
      pantry: "Le garde-manger",
      plan: "Ce que vous avez cuisiné",
      setup: "Règles des rouleaux",
      spin: "Ce soir",
    } satisfies Record<Screen, string>,
  },
};

type Copy = (typeof COPY)["en"];

// Space draws, except where focus is in a control that owns the key.
const OWNS_SPACE: ReadonlySet<string> = new Set([
  "INPUT",
  "BUTTON",
  "SELECT",
  "TEXTAREA",
]);

/** The line at the foot of the sidebar: a failed save first, then guest mode. */
const footNote = (saveFailed: boolean, guest: boolean, t: Copy): string => {
  if (saveFailed) {
    return t.notes.saveFailed;
  }

  if (guest) {
    return t.notes.guest;
  }

  return t.notes.usual;
};

// On a phone the nav is a row that scrolls sideways; React hands this the
// pill that has just become current, to scroll it into sight. On a desktop
// the column never scrolls, so it does nothing there.
const keepInSight = (pill: HTMLButtonElement | null) => {
  const row = pill?.parentElement;

  if (!(pill && row)) {
    return;
  }

  const from = row.getBoundingClientRect();
  const at = pill.getBoundingClientRect();

  if (at.left < from.left || at.right > from.right) {
    row.scrollLeft += at.left - from.left - 16;
  }
};

const App = () => {
  const [state, dispatch] = useReducer(
    plannerReducer,
    undefined,
    createInitialState
  );

  const {
    account,
    phase,
    email,
    failure,
    guest,
    saveFailed,
    signOut,
    startGuest,
  } = useRemoteSync(state, dispatch);

  const timers = useRef<number[]>([]);
  const t = useCopy(COPY);

  useEffect(() => {
    const pending = timers.current;

    return () => {
      for (const timer of pending) {
        clearTimeout(timer);
      }
    };
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
    // SAFETY: plan.target is a Triple, one index per reel, so its map is too.
    const picks = plan.target.map((at, k) =>
      reels[k][at]
        ? ingredientOf(state.catalogue, reels[k][at].name)
        : undefined
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
      const el = e.target;

      if (e.code !== "Space" || !(el instanceof HTMLElement)) {
        return;
      }

      if (OWNS_SPACE.has(el.tagName) || el.getAttribute("role") === "button") {
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
    return (
      <>
        <Header />
        <div className="shell" />
      </>
    );
  }

  const rotation = methodsOn(state).length;
  const toBuy = state.grocery.filter((g) => !g.acquired).length;
  const expiring = state.pantry.filter((p) => daysLeft(p) <= 3).length;

  const kickers: Record<Screen, string> = {
    ...t.kickers,
    methods: t.kickers.methods(rotation),
    pantry: t.kickers.pantry(state.pantry.length),
  };

  type NavItem = [Screen, string, number | ""];

  const cooked: NavItem[] = FEATURES.history
    ? [["plan", t.nav.plan, state.plan.length]]
    : [];

  const nav: NavItem[] = [
    ["spin", t.nav.spin, ""],
    ["pantry", t.nav.pantry, state.pantry.length],
    ["add", t.nav.add, ""],
    ...cooked,
    ["list", t.nav.list, toBuy || ""],
    ["methods", t.nav.methods, rotation],
    ["setup", t.nav.setup, ""],
  ];

  return (
    <>
      <Header
        account={account}
        onHome={() => dispatch({ screen: "spin", type: "screen/go" })}
      />
      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar__sub">{t.inPantry(state.pantry.length)}</div>
          <nav className="stack" style={{ gap: 6 }} aria-label={t.main}>
            {nav.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className="nav"
                aria-current={state.screen === key ? "page" : undefined}
                ref={state.screen === key ? keepInSight : undefined}
                onClick={() => dispatch({ screen: key, type: "screen/go" })}
              >
                <span className="nav__pip" />
                <span className="nav__label">{label}</span>
                <span className="nav__count">{count}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar__foot">
            <span>{footNote(saveFailed, guest, t)}</span>
            <button
              type="button"
              className="nav sidebar__account"
              onClick={signOut}
            >
              <span className="nav__label">
                {guest ? t.signIn : (email ?? t.signOut)}
              </span>
            </button>
          </div>
        </aside>

        <div className="column">
          <main className="main">
            <header className="topbar">
              <div>
                <div className="topbar__kicker">{kickers[state.screen]}</div>
                <h1 className="topbar__title">{t.titles[state.screen]}</h1>
              </div>
              {ready ? (
                <button
                  type="button"
                  className="soon-pill"
                  onClick={() =>
                    dispatch({ screen: "pantry", type: "screen/go" })
                  }
                >
                  {t.goingOff(expiring)}
                </button>
              ) : (
                <button
                  type="button"
                  className="soon-pill"
                  onClick={() =>
                    dispatch({ screen: "pantry", type: "screen/go" })
                  }
                >
                  {emptyReels(reels, v).length === v.categories.length
                    ? t.nothingStocked
                    : t.no(
                        labelOfCategory(
                          v,
                          emptyReels(reels, v)[0]
                        ).toLowerCase()
                      )}
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
          <Footer />
        </div>
      </div>
    </>
  );
};

export default App;
