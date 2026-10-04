import type {
  GroceryItem,
  Ingredient,
  PantryItem,
  PlanEntry,
} from "../data/model";
import {
  EMPTY_VOCAB,
  defaultServing,
  defaultUnit,
  formatQuantity,
  labelOfCategory,
  methodOf,
  servingInUnit,
} from "../data/vocab";
import type { CategoryCode, Vocab } from "../data/vocab";
import {
  dishName,
  ingredientOf,
  pickedNames,
  reelsFrom,
  settledIdx,
  styleOf,
} from "../engine/reel";
import type { SpinPlan, Triple } from "../engine/reel";
import { FEATURES } from "../features";
import { addDaysISO, todayISO } from "../lib/dates";
import type { Snapshot } from "../data/snapshot";

export type Screen =
  | "spin"
  | "pantry"
  | "add"
  | "plan"
  | "list"
  | "methods"
  | "setup";

/** The Add ingredient form: one ingredient being described. */
export interface AddDraft {
  name: string;
  shortName: string;
  category: CategoryCode;
  /** One per category, so switching reels does not lose what was already picked. */
  proteinKind: string;
  vegetableKind: string;
  starchKind: string;
  glutenFree: boolean;
  /** The ways it can be cooked, as method codes. */
  methods: string[];
  days: number;
  qty: string;
  unit: string;
  /** Straight into the pantry, or onto the shopping list. */
  have: boolean;
  /** How much a serving is, typed; only asked for in a unit with a serving size. */
  serving: string;
}

/** The pantry's own add row: an ingredient you already have, being stocked. */
export interface StockDraft {
  name: string;
  qty: string;
  unit: string;
  /** How much a serving is, typed; only asked for in a unit with a serving size. */
  serving: string;
  days: number;
}

export interface PlannerState {
  /** Every word the app uses, from the reference tables. Empty until loaded. */
  vocab: Vocab;
  screen: Screen;
  catalogue: Ingredient[];
  pantry: PantryItem[];
  plan: PlanEntry[];
  grocery: GroceryItem[];
  /** Method codes switched off. Absence means on, so a new account has all of them. */
  methodsOff: string[];
  idx: Triple<number>;
  locks: Triple<boolean>;
  dur: Triple<string>;
  spinning: boolean;
  picked: Triple<string | null> | null;
  /** The method each pick is cooked with, one per reel; null where none was ticked. */
  methods: Triple<string | null> | null;
  /** Diet rule codes that are on. */
  diets: string[];
  weighting: boolean;
  pantryFilter: CategoryCode | "all";
  draft: AddDraft;
  stock: StockDraft;
  flash: string;
}

const DRAFT0: AddDraft = {
  category: "protein",
  days: 7,
  glutenFree: false,
  have: true,
  methods: [],
  name: "",
  proteinKind: "",
  qty: "",
  serving: "",
  shortName: "",
  starchKind: "",
  unit: "",
  vegetableKind: "",
};

const STOCK0: StockDraft = {
  days: 7,
  name: "",
  qty: "1",
  serving: "",
  unit: "",
};

export function createInitialState(): PlannerState {
  return {
    catalogue: [],
    diets: [],
    draft: DRAFT0,
    dur: ["0s", "0s", "0s"],
    flash: "",
    grocery: [],
    idx: [0, 0, 0],
    locks: [false, false, false],
    methods: null,
    methodsOff: [],
    pantry: [],
    pantryFilter: "all",
    picked: null,
    plan: [],
    screen: "spin",
    spinning: false,
    stock: STOCK0,
    vocab: EMPTY_VOCAB,
    weighting: true,
  };
}

export function snapshotOf(state: PlannerState): Snapshot {
  return {
    catalogue: state.catalogue,
    grocery: state.grocery,
    methodsOff: state.methodsOff,
    pantry: state.pantry,
    plan: state.plan,
  };
}

export const kindOfDraft = (d: AddDraft): string =>
  d.category === "protein"
    ? d.proteinKind
    : d.category === "vegetable"
      ? d.vegetableKind
      : d.starchKind;

export type Action =
  | { type: "vocab/load"; vocab: Vocab }
  | { type: "state/hydrate"; snapshot: Snapshot }
  | { type: "screen/go"; screen: Screen }
  | { type: "reel/toggleLock"; reel: number }
  | { type: "spin/start"; plan: SpinPlan }
  | {
      type: "spin/settle";
      target: Triple<number>;
      methods: Triple<string | null>;
    }
  | { type: "dish/cook" }
  | { type: "draft/patch"; patch: Partial<AddDraft> }
  | { type: "draft/toggleMethod"; code: string }
  | { type: "draft/setMethods"; codes: string[] }
  | { type: "ingredient/setMethods"; name: string; codes: string[] }
  | { type: "draft/submit" }
  | { type: "stock/patch"; patch: Partial<StockDraft> }
  | { type: "stock/submit" }
  | { type: "pantry/remove"; name: string }
  | { type: "pantry/filter"; filter: CategoryCode | "all" }
  | { type: "grocery/add"; name: string; qty?: string; unit?: string }
  | { type: "grocery/toggle"; name: string }
  | { type: "grocery/remove"; name: string }
  | { type: "grocery/stock"; name: string }
  | { type: "method/toggle"; code: string }
  | { type: "rules/toggleDiet"; code: string }
  | { type: "rules/toggleWeighting" }
  | { type: "flash/clear" };

/** The serving box starts on the unit's default, or empty for a unit that is its own serving. */
const servingText = (v: Vocab, unit: string): string =>
  String(defaultServing(v, unit) ?? "");

/**
 * How much one serving is, in `unit`'s serving unit (grams for kilograms). A
 * unit that is its own serving (a piece, a can) is always 1; otherwise what was
 * typed, or the unit's default.
 */
export function servingOf(v: Vocab, unit: string, typed: string): number {
  const fallback = defaultServing(v, unit);
  if (fallback === null) {
    return 1;
  }
  const value = Number(typed);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Keeps sums like 0.3 − 0.1 from leaving a trailing 0.19999999999999998. */
const tidy = (n: number) => Math.round(n * 1e6) / 1e6;

/** A blank or nonsense entry means one of the thing, not NaN. */
function parseQuantity(typed: string): number {
  const value = Number(typed);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const STOCKED_WINDOW = 6;

export function plannerReducer(
  state: PlannerState,
  action: Action
): PlannerState {
  switch (action.type) {
    case "vocab/load": {
      // Defaults for the forms come from the vocabulary too: the first kind of
      // each category, and whichever unit the units table marks as the default.
      const v = action.vocab;
      const unit = defaultUnit(v);
      const starch = v.starchKinds[0];
      return {
        ...state,
        draft: {
          ...state.draft,
          glutenFree: starch?.glutenFree ?? false,
          proteinKind:
            state.draft.proteinKind || (v.proteinKinds[0]?.code ?? ""),
          serving: state.draft.unit
            ? state.draft.serving
            : servingText(v, unit),
          starchKind: state.draft.starchKind || (starch?.code ?? ""),
          unit: state.draft.unit || unit,
          vegetableKind:
            state.draft.vegetableKind || (v.vegetableKinds[0]?.code ?? ""),
        },
        stock: state.stock.unit
          ? state.stock
          : { ...state.stock, serving: servingText(v, unit), unit },
        vocab: v,
      };
    }

    case "state/hydrate": {
      return {
        ...state,
        catalogue: action.snapshot.catalogue,
        grocery: action.snapshot.grocery,
        methodsOff: action.snapshot.methodsOff,
        pantry: action.snapshot.pantry,
        plan: action.snapshot.plan,
      };
    }

    case "screen/go": {
      return { ...state, flash: "", screen: action.screen };
    }

    case "reel/toggleLock": {
      const locks = [...state.locks] as Triple<boolean>;
      locks[action.reel] = !locks[action.reel];
      return { ...state, locks };
    }

    case "spin/start": {
      return {
        ...state,
        dur: action.plan.dur,
        flash: "",
        idx: action.plan.idx,
        picked: null,
        spinning: true,
      };
    }

    case "spin/settle": {
      // The pantry can change while the reels turn, so read the targets back
      // against the reels as they are now rather than as they were planned.
      const reels = reelsFrom(state.pantry, state.catalogue, state.vocab);
      const target = action.target.map((t, k) =>
        reels[k].length ? t % reels[k].length : 0
      ) as Triple<number>;
      const picked = pickedNames(target, reels);
      // A method only survives if the ingredient that landed still has it ticked.
      const methods = action.methods.map((code, k) => {
        const ingredient = picked[k]
          ? ingredientOf(state.catalogue, picked[k]!)
          : undefined;
        return code && ingredient?.methods.includes(code) ? code : null;
      }) as Triple<string | null>;
      return {
        ...state,
        dur: ["0s", "0s", "0s"],
        idx: settledIdx(target, reels),
        methods,
        picked,
        spinning: false,
      };
    }

    case "dish/cook": {
      if (!state.picked) {
        return state;
      }
      const names = state.picked.filter((n): n is string => n !== null);
      if (!names.length) {
        return state;
      }

      const picks = state.picked.map((n) =>
        n ? ingredientOf(state.catalogue, n) : undefined
      ) as Triple<Ingredient | undefined>;
      const methods = state.methods ?? [null, null, null];
      // Cooking uses one serving of everything drawn. The last serving (or what
      // is left of one) takes the item out of the pantry altogether.
      const pantry = state.pantry.flatMap((item) => {
        if (!names.includes(item.name)) {
          return [item];
        }
        // The serving is sized in the small unit (grams for a kilogram item).
        const left = tidy(
          item.qty - servingInUnit(state.vocab, item.unit, item.serving)
        );
        return left > 0 ? [{ ...item, qty: left }] : [];
      });
      const usage = names.map((name) => {
        const item = pantry.find((p) => p.name === name);
        return item
          ? `${name}: ${formatQuantity(state.vocab, item.qty, item.unit)} left`
          : `${name}: used up`;
      });

      // The meal is recorded either way; that is what "Yesterday you ate …"
      // reads. Only landing on the Cooked screen waits on FEATURES.history.
      const method = methodOf(state.vocab, methods[0]);
      return {
        ...state,
        flash: FEATURES.history ? "" : `${usage.join(" · ")}.`,
        methods: null,
        pantry,
        picked: null,
        plan: [
          {
            cookedOn: todayISO(),
            dish: dishName(picks, methods, state.vocab),
            id: crypto.randomUUID(),
            ingredients: names,
            method: methods[0],
            note: method
              ? `Just drawn · ${method.label.toLowerCase()}`
              : "Just drawn",
            style: styleOf(picks[2], state.vocab)?.code ?? "",
          },
          ...state.plan,
        ],
        screen: FEATURES.history ? "plan" : state.screen,
      };
    }

    case "draft/patch": {
      const draft = { ...state.draft, ...action.patch };
      // Choosing a starch kind carries its gluten default across, unless the
      // same patch said otherwise.
      if (
        action.patch.starchKind !== undefined &&
        action.patch.glutenFree === undefined
      ) {
        draft.glutenFree =
          state.vocab.starchKinds.find(
            (k) => k.code === action.patch.starchKind
          )?.glutenFree ?? false;
      }
      // A new unit brings its own serving size, unless the same patch set one.
      if (
        action.patch.unit !== undefined &&
        action.patch.serving === undefined
      ) {
        draft.serving = servingText(state.vocab, action.patch.unit);
      }
      return { ...state, draft, flash: "" };
    }

    case "draft/setMethods": {
      return { ...state, draft: { ...state.draft, methods: action.codes } };
    }

    case "ingredient/setMethods": {
      // In the table's order, like a new ingredient's, whatever order they were tapped in.
      const codes = state.vocab.methods
        .map((m) => m.code)
        .filter((c) => action.codes.includes(c));
      return {
        ...state,
        catalogue: state.catalogue.map((i) =>
          same(i.name, action.name) ? { ...i, methods: codes } : i
        ),
      };
    }

    case "draft/toggleMethod": {
      const on = state.draft.methods.includes(action.code);
      return {
        ...state,
        draft: {
          ...state.draft,
          methods: on
            ? state.draft.methods.filter((c) => c !== action.code)
            : [...state.draft.methods, action.code],
        },
      };
    }

    case "draft/submit": {
      const d = state.draft;
      const name = d.name.trim();
      if (!name) {
        return state;
      }

      // Keep the table's order rather than the order the chips were tapped in,
      // and only the methods the form showed: a switched-off one is hidden there.
      const methods = methodsOn(state)
        .map((m) => m.code)
        .filter((c) => d.methods.includes(c));
      const ingredient: Ingredient = {
        category: d.category,
        glutenFree: d.category === "starch" ? d.glutenFree : null,
        kind: kindOfDraft(d),
        methods,
        name,
        shortName: d.shortName.trim() || null,
      };
      const reel = labelOfCategory(state.vocab, d.category).toLowerCase();

      return {
        ...state,
        catalogue: [
          ...state.catalogue.filter((i) => !same(i.name, name)),
          ingredient,
        ],
        draft: { ...d, days: 7, methods: [], name: "", qty: "", shortName: "" },
        flash: `${name} is on the ${reel} reel${d.have ? " and in the pantry." : ", and on the shopping list."}`,
        grocery: d.have
          ? state.grocery.filter((g) => !same(g.name, name))
          : [
              {
                acquired: false,
                name,
                note: `New on the ${reel} reel`,
                qty: parseQuantity(d.qty),
                unit: d.unit,
              },
              ...state.grocery.filter((g) => !same(g.name, name)),
            ],
        pantry: d.have
          ? [
              {
                expiresOn: addDaysISO(d.days),
                name,
                qty: parseQuantity(d.qty),
                serving: servingOf(state.vocab, d.unit, d.serving),
                unit: d.unit,
              },
              ...state.pantry.filter((p) => !same(p.name, name)),
            ]
          : state.pantry.filter((p) => !same(p.name, name)),
      };
    }

    case "stock/patch": {
      const stock = { ...state.stock, ...action.patch };
      if (
        action.patch.unit !== undefined &&
        action.patch.serving === undefined
      ) {
        stock.serving = servingText(state.vocab, action.patch.unit);
      }
      return { ...state, stock };
    }

    case "stock/submit": {
      const name = state.stock.name.trim();
      if (!name || !state.catalogue.some((i) => i.name === name)) {
        return state;
      }
      return {
        ...state,
        grocery: state.grocery.filter((g) => g.name !== name),
        pantry: [
          {
            expiresOn: addDaysISO(state.stock.days),
            name,
            qty: parseQuantity(state.stock.qty),
            serving: servingOf(
              state.vocab,
              state.stock.unit || defaultUnit(state.vocab),
              state.stock.serving
            ),
            unit: state.stock.unit || defaultUnit(state.vocab),
          },
          ...state.pantry.filter((p) => p.name !== name),
        ],
        stock: {
          ...STOCK0,
          serving: servingText(state.vocab, defaultUnit(state.vocab)),
          unit: defaultUnit(state.vocab),
        },
      };
    }

    case "pantry/remove": {
      return {
        ...state,
        pantry: state.pantry.filter((p) => p.name !== action.name),
      };
    }

    case "pantry/filter": {
      return { ...state, pantryFilter: action.filter };
    }

    case "grocery/add": {
      const name = action.name.trim();
      if (!name || state.grocery.some((g) => same(g.name, name))) {
        return state;
      }
      // Only something you have described can go on the list, since the pantry
      // and the reels both need to know its category.
      if (!state.catalogue.some((i) => i.name === name)) {
        return state;
      }
      return {
        ...state,
        grocery: [
          {
            acquired: false,
            name,
            note: "Added by you",
            qty: parseQuantity(action.qty ?? ""),
            unit: action.unit || defaultUnit(state.vocab),
          },
          ...state.grocery,
        ],
      };
    }

    case "grocery/toggle": {
      return {
        ...state,
        grocery: state.grocery.map((g) =>
          g.name === action.name ? { ...g, acquired: !g.acquired } : g
        ),
      };
    }

    case "grocery/remove": {
      return {
        ...state,
        grocery: state.grocery.filter((g) => g.name !== action.name),
      };
    }

    case "grocery/stock": {
      const bought = state.grocery.find((g) => g.name === action.name);
      return {
        ...state,
        grocery: state.grocery.filter((g) => g.name !== action.name),
        pantry: [
          {
            expiresOn: addDaysISO(STOCKED_WINDOW),
            name: action.name,
            qty: bought?.qty ?? 1,
            serving:
              defaultServing(
                state.vocab,
                bought?.unit ?? defaultUnit(state.vocab)
              ) ?? 1,
            unit: bought?.unit ?? defaultUnit(state.vocab),
          },
          ...state.pantry.filter((p) => p.name !== action.name),
        ],
      };
    }

    case "method/toggle": {
      return {
        ...state,
        methodsOff: state.methodsOff.includes(action.code)
          ? state.methodsOff.filter((c) => c !== action.code)
          : [...state.methodsOff, action.code],
      };
    }

    case "rules/toggleDiet": {
      return {
        ...state,
        diets: state.diets.includes(action.code)
          ? state.diets.filter((d) => d !== action.code)
          : [...state.diets, action.code],
      };
    }

    case "rules/toggleWeighting": {
      return { ...state, weighting: !state.weighting };
    }

    case "flash/clear": {
      return { ...state, flash: "" };
    }
  }
}

/** The diet rules switched on, as rows. */
export const activeRules = (state: PlannerState) =>
  state.vocab.dietRules.filter((r) => state.diets.includes(r.code));

/** Methods switched on in the Cooking methods screen. */
/** The last dish sent into the pot yesterday, if there was one. The plan is newest first. */
export const yesterdaysMeal = (state: PlannerState): PlanEntry | undefined =>
  state.plan.find((entry) => entry.cookedOn === addDaysISO(-1));

export const methodsOn = (state: PlannerState) =>
  state.vocab.methods.filter((m) => !state.methodsOff.includes(m.code));
