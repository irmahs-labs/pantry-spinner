import type { Ingredient, PantryItem } from "../data/model";
import { categoryCodes } from "../data/vocab";
import type { CategoryCode, DietRule, Vocab } from "../data/vocab";
import { daysUntil } from "../lib/dates";

/** Height of one reel cell in px. Drives all of the spin maths. */
export const CELL_H = 84;
export const STRIP_REPEATS = 10;
export const SETTLE_MS = 2500;

export type Triple<T> = [T, T, T];
/** One reel per category, in the order the categories table gives. */
export type Reels = Triple<PantryItem[]>;

const mod = (a: number, n: number) => ((a % n) + n) % n;

export const ingredientOf = (
  catalogue: Ingredient[],
  name: string
): Ingredient | undefined => catalogue.find((i) => i.name === name);

/**
 * The reels are the pantry, sliced by the category of each item's ingredient.
 * Nothing you have not stocked can spin. Soonest to go off sits at the top.
 */
export const reelsFrom = (
  pantry: PantryItem[],
  catalogue: Ingredient[],
  vocab: Vocab
): Reels =>
  // SAFETY: one list per category, and the categories are the three
  // CATEGORY_CODES the schema fixes. Until the vocabulary loads there are none
  // and this is empty, which is why emptyReels reads `reels[k] ?? []` and
  // canSpin will not spin.
  categoryCodes(vocab).map((code) =>
    pantry
      .filter((item) => ingredientOf(catalogue, item.name)?.category === code)
      .toSorted((a, b) => a.expiresOn.localeCompare(b.expiresOn))
  ) as Reels;

export const emptyReels = (reels: Reels, vocab: Vocab): CategoryCode[] =>
  categoryCodes(vocab).filter((_, k) => (reels[k] ?? []).length === 0);

export const canSpin = (reels: Reels, vocab: Vocab) =>
  vocab.categories.length > 0 && emptyReels(reels, vocab).length === 0;

export const daysLeft = (item: PantryItem) => daysUntil(item.expiresOn);

/** The payline is the middle of three visible cells, i.e. strip index idx + 1. */
export const paylineOf = (idx: number, len: number) =>
  len === 0 ? 0 : mod(idx + 1, len);

/**
 * Whether an ingredient survives the active diet rules. Each rule is a row
 * describing what it excludes in terms of kind columns, so this applies any rule
 * the table holds without knowing one by name.
 */
export const allowed = (
  ingredient: Ingredient | undefined,
  rules: DietRule[],
  vocab: Vocab
): boolean => {
  if (!ingredient || !rules.length) {
    return true;
  }

  if (ingredient.category === "protein") {
    const kind = vocab.proteinKinds.find((k) => k.code === ingredient.kind);
    if (kind) {
      if (rules.some((r) => r.excludesDiets.includes(kind.diet))) {
        return false;
      }
      if (kind.redMeat && rules.some((r) => r.excludesRedMeat)) {
        return false;
      }
    }
  }

  if (
    ingredient.category === "starch" &&
    rules.some((r) => r.requiresGlutenFree)
  ) {
    const kind = vocab.starchKinds.find((k) => k.code === ingredient.kind);
    if (!(ingredient.glutenFree ?? kind?.glutenFree ?? false)) {
      return false;
    }
  }

  return true;
};

/** Everything on a reel is in the pantry, so weight is purely about urgency. */
export const weightOf = (item: PantryItem, weighting: boolean): number => {
  if (!weighting) {
    return 1;
  }
  const left = daysLeft(item);
  if (left <= 2) {
    return 6;
  }
  if (left <= 4) {
    return 3;
  }
  if (left <= 10) {
    return 1.6;
  }
  return 1;
};

export interface PickContext {
  catalogue: Ingredient[];
  rules: DietRule[];
  weighting: boolean;
  vocab: Vocab;
}

/**
 * Weighted pick within one reel, after diet filtering. A filter that empties the
 * reel falls back to the unfiltered list rather than failing to draw.
 */
export const pickIndex = (
  list: PantryItem[],
  ctx: PickContext,
  random: () => number = Math.random
): number => {
  if (!list.length) {
    return -1;
  }

  const pool = list.filter((item) =>
    allowed(ingredientOf(ctx.catalogue, item.name), ctx.rules, ctx.vocab)
  );
  const source = pool.length ? pool : list;
  let r =
    random() *
    source.reduce((sum, item) => sum + weightOf(item, ctx.weighting), 0);
  for (const item of source) {
    r -= weightOf(item, ctx.weighting);
    if (r <= 0) {
      return list.indexOf(item);
    }
  }
  // Rounding can leave r a hair above zero after the loop; the last item takes it.
  const last = source.at(-1);
  return last ? list.indexOf(last) : -1;
};

export interface SpinPlan {
  idx: Triple<number>;
  dur: Triple<string>;
  target: Triple<number>;
}

/**
 * Unlocked reels run four full turns plus one extra per reel for stagger and
 * land their pick on the payline; a locked reel keeps what it already holds.
 */
export const planSpin = (
  idx: Triple<number>,
  locks: Triple<boolean>,
  reels: Reels,
  ctx: PickContext,
  random: () => number = Math.random
): SpinPlan => {
  const out: SpinPlan = {
    dur: ["0s", "0s", "0s"],
    idx: [...idx],
    target: [0, 0, 0],
  };

  for (const [k, list] of reels.entries()) {
    const len = list.length;
    const cur = paylineOf(idx[k], len);
    if (locks[k] || len === 0) {
      out.target[k] = cur;
      continue;
    }
    const chosen = pickIndex(list, ctx, random);
    out.idx[k] = cur + len - 1 + 4 * len + k * len + mod(chosen - cur, len);
    out.dur[k] = `${(1.5 + k * 0.42).toFixed(2)}s`;
    out.target[k] = chosen;
  }

  return out;
};

export const settledIdx = (
  target: Triple<number>,
  reels: Reels
): Triple<number> =>
  // SAFETY: map keeps the length of the Triple it is called on.
  target.map((c, k) => c + Math.max(reels[k].length, 1) - 1) as Triple<number>;

export const pickedNames = (
  target: Triple<number>,
  reels: Reels
): Triple<string | null> =>
  // SAFETY: map keeps the length of the Triple it is called on.
  target.map((c, k) => reels[k][c]?.name ?? null) as Triple<string | null>;

/** The methods an ingredient may be cooked with right now: ticked, and in rotation. */
export const methodsFor = (
  ingredient: Ingredient | undefined,
  methodsOff: string[]
): string[] =>
  (ingredient?.methods ?? []).filter((code) => !methodsOff.includes(code));

/**
 * One method per pick, from what was ticked for that ingredient and is switched
 * on. A held reel keeps the method it already had, so holding a column holds
 * everything about it. An ingredient with nothing ticked gets no method.
 */
export const chooseMethods = (
  picks: Triple<Ingredient | undefined>,
  methodsOff: string[],
  held: Triple<boolean>,
  previous: Triple<string | null> | null,
  random: () => number = Math.random
): Triple<string | null> =>
  // SAFETY: map keeps the length of the Triple it is called on.
  picks.map((ingredient, k) => {
    const options = methodsFor(ingredient, methodsOff);
    const kept = previous?.[k] ?? null;
    if (held[k] && kept && options.includes(kept)) {
      return kept;
    }
    return options.length
      ? options[Math.floor(random() * options.length)]
      : null;
  }) as Triple<string | null>;

export const styleOf = (starch: Ingredient | undefined, vocab: Vocab) => {
  const kind = vocab.starchKinds.find((k) => k.code === starch?.kind);
  return vocab.dishStyles.find((s) => s.id === kind?.styleId);
};

/** The name a dish uses for an ingredient: its short name, if it has one. */
const shortName = (i: Ingredient) => i.shortName || i.name;

/**
 * Fills a template from meal_planner_dish_styles. A placeholder with nothing to
 * fill it disappears with its spare space, and the first letter is capitalised.
 * This is the whole of the app's part in naming a dish: the wording is the row.
 */
export const fillTemplate = (
  template: string,
  values: Record<string, string>
): string => {
  const filled = template
    .replaceAll(/\{(?<key>\w+)\}/gu, (_, key: string) => values[key] ?? "")
    .replaceAll(/\s+/gu, " ")
    .replace(/\s+[,&]\s*$/u, "")
    .trim();
  return filled.charAt(0).toUpperCase() + filled.slice(1);
};

export const dishName = (
  picks: Triple<Ingredient | undefined>,
  methods: Triple<string | null>,
  vocab: Vocab
): string => {
  const [protein, vegetable, starch] = picks;
  const present = picks.filter((i): i is Ingredient => i !== undefined);
  if (!present.length) {
    return "";
  }

  const style = styleOf(starch, vocab);
  if (!protein || !vegetable || !starch || !style) {
    return present.map((i) => i.name).join(" & ");
  }

  const phrase = (code: string | null) =>
    vocab.methods.find((m) => m.code === code)?.phrase ?? "";
  const vegKindWord =
    vocab.vegetableKinds.find((k) => k.code === vegetable.kind)?.word ?? "";

  return fillTemplate(style.template, {
    method: phrase(methods[0]),
    protein: shortName(protein),
    starch: shortName(starch),
    starch_method: phrase(methods[2]).toLowerCase(),
    vegetable: shortName(vegetable).toLowerCase(),
    vegetable_method: (phrase(methods[1]) || vegKindWord).toLowerCase(),
  });
};

export const daysNote = (days: number): string => {
  if (days > 30) {
    return "keeps for months";
  }
  if (days < 0) {
    return "past its date";
  }
  if (days === 0) {
    return "use today";
  }
  if (days === 1) {
    return "use tomorrow";
  }
  return `use within ${days} days`;
};
