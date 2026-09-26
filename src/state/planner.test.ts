import { describe, expect, it } from "vitest";

import { toVocab } from "../data/vocab";
import type { RawVocab } from "../data/vocab";
import { FEATURES } from "../features";
import { addDaysISO, todayISO } from "../lib/dates";
import raw from "../test/vocab.json";
import {
  createInitialState,
  plannerReducer,
  servingOf,
  yesterdaysMeal,
} from "./planner";
import type { PlannerState } from "./planner";

/**
 * The cook action with history switched off: the draw clears and the use-by
 * dates move, but nothing is recorded. These assertions follow the flag, so
 * they keep meaning something when it is turned on.
 */
const vocab = toVocab(raw as RawVocab);
const loaded = plannerReducer(createInitialState(), {
  type: "vocab/load",
  vocab,
});

const drawn: PlannerState = {
  ...loaded,
  catalogue: [
    {
      category: "protein",
      glutenFree: null,
      kind: "poultry",
      methods: ["air_fry"],
      name: "Chicken Thighs",
      shortName: "Chicken",
    },
    {
      category: "vegetable",
      glutenFree: null,
      kind: "brassica",
      methods: [],
      name: "Broccoli",
      shortName: null,
    },
    {
      category: "starch",
      glutenFree: true,
      kind: "grain",
      methods: [],
      name: "Jasmine Rice",
      shortName: "Rice",
    },
  ],
  methods: ["air_fry", null, null],
  pantry: [
    {
      expiresOn: "2026-09-25",
      name: "Chicken Thighs",
      qty: 600,
      serving: 200,
      unit: "g",
    },
    {
      expiresOn: "2026-09-28",
      name: "Broccoli",
      qty: 1,
      serving: 1,
      unit: "piece",
    },
    {
      expiresOn: "2026-12-22",
      name: "Jasmine Rice",
      qty: 0.3,
      serving: 0.1,
      unit: "kg",
    },
  ],
  picked: ["Chicken Thighs", "Broccoli", "Jasmine Rice"],
};

describe("into the pot", () => {
  const after = plannerReducer(drawn, { type: "dish/cook" });

  it("clears the draw either way", () => {
    expect(after.picked).toBeNull();
  });

  it("uses one serving of each drawn item", () => {
    const chicken = after.pantry.find((p) => p.name === "Chicken Thighs");
    const rice = after.pantry.find((p) => p.name === "Jasmine Rice");
    expect(chicken?.qty).toBe(400);
    // 0.3 − 0.1 in floating point is 0.19999999999999998; kept tidy.
    expect(rice?.qty).toBe(0.2);
    // Use-by dates are left alone: cooking does not make food last longer.
    expect(chicken?.expiresOn).toBe("2026-09-25");
  });

  it("takes an item out of the pantry when its last serving is cooked", () => {
    expect(after.pantry.some((p) => p.name === "Broccoli")).toBe(false);
  });

  it("removes what is left of a serving too", () => {
    const low: PlannerState = {
      ...drawn,
      pantry: drawn.pantry.map((p) =>
        p.name === "Chicken Thighs" ? { ...p, qty: 150 } : p
      ),
    };
    const cooked = plannerReducer(low, { type: "dish/cook" });
    expect(cooked.pantry.some((p) => p.name === "Chicken Thighs")).toBe(false);
  });

  it("records the meal whether or not the Cooked screen is on", () => {
    expect(after.plan).toHaveLength(1);
    expect(after.plan[0].dish).toBe(
      "Air-fried Chicken Rice Bowl with charred broccoli"
    );
    expect(after.plan[0].cookedOn).toBe(todayISO());
    if (FEATURES.history) {
      expect(after.screen).toBe("plan");
    } else {
      expect(after.screen).toBe("spin");
      expect(after.flash).toBe(
        "Chicken Thighs: 400 g left · Broccoli: used up · Jasmine Rice: 0.2 kg left."
      );
    }
  });

  it("does nothing without a draw", () => {
    const state = { ...drawn, picked: null };
    expect(plannerReducer(state, { type: "dish/cook" })).toBe(state);
  });
});

describe("the vocabulary sets the form defaults", () => {
  it("starts each kind on the first row of its table, and the unit on the default one", () => {
    expect(loaded.draft.proteinKind).toBe(vocab.proteinKinds[0].code);
    expect(loaded.draft.starchKind).toBe(vocab.starchKinds[0].code);
    expect(loaded.draft.unit).toBe(vocab.units.find((u) => u.isDefault)?.code);
  });
});

describe("serving sizes", () => {
  it("is 1 for a unit that is its own serving, whatever was typed", () => {
    expect(servingOf(vocab, "piece", "3")).toBe(1);
  });

  it("is what was typed for a weight or volume, or the unit's default", () => {
    expect(servingOf(vocab, "g", "180")).toBe(180);
    expect(servingOf(vocab, "g", "")).toBe(150);
    expect(servingOf(vocab, "l", "nonsense")).toBe(0.25);
  });

  it("follows the unit on the stock form, and is saved with the item", () => {
    let s = plannerReducer(loaded, {
      patch: { name: "Chicken Thighs", unit: "g" },
      type: "stock/patch",
    });
    expect(s.stock.serving).toBe("150");
    s = { ...s, catalogue: drawn.catalogue };
    s = plannerReducer(s, {
      patch: { qty: "900", serving: "300" },
      type: "stock/patch",
    });
    s = plannerReducer(s, { type: "stock/submit" });
    const chicken = s.pantry.find((p) => p.name === "Chicken Thighs");
    expect(chicken).toMatchObject({ qty: 900, serving: 300, unit: "g" });
  });
});

describe("adding to the shopping list", () => {
  it("keeps the quantity and unit chosen", () => {
    const s = plannerReducer(drawn, {
      name: "Jasmine Rice",
      qty: "2",
      type: "grocery/add",
      unit: "kg",
    });
    expect(s.grocery[0]).toMatchObject({
      name: "Jasmine Rice",
      qty: 2,
      unit: "kg",
    });
  });
});

describe("yesterday's meal", () => {
  const entry = (id: string, cookedOn: string) => ({
    cookedOn,
    dish: `Dish ${id}`,
    id,
    ingredients: [],
    method: null,
    note: "",
    style: "bowl",
  });

  it("is the newest dish cooked yesterday", () => {
    const state = {
      ...loaded,
      plan: [
        entry("tonight", todayISO()),
        entry("late", addDaysISO(-1)),
        entry("early", addDaysISO(-1)),
        entry("before", addDaysISO(-2)),
      ],
    };
    expect(yesterdaysMeal(state)?.id).toBe("late");
  });

  it("is nothing when yesterday went unrecorded", () => {
    const state = {
      ...loaded,
      plan: [entry("tonight", todayISO()), entry("before", addDaysISO(-2))],
    };
    expect(yesterdaysMeal(state)).toBeUndefined();
  });
});

describe("ticking methods on a new ingredient", () => {
  it("stores them in the table order, whatever order they were tapped", () => {
    let s = { ...loaded, draft: { ...loaded.draft, name: "Halloumi" } };
    s = plannerReducer(s, { code: "grill", type: "draft/toggleMethod" });
    s = plannerReducer(s, { code: "pan_fry", type: "draft/toggleMethod" });
    s = plannerReducer(s, { type: "draft/submit" });
    expect(s.catalogue.find((i) => i.name === "Halloumi")?.methods).toEqual([
      "pan_fry",
      "grill",
    ]);
    expect(s.draft.methods).toEqual([]);
  });

  it("ticks every method at once, and a switched-off one still is not saved", () => {
    let s = { ...loaded, draft: { ...loaded.draft, name: "Halloumi" } };
    s = plannerReducer(s, { code: "grill", type: "method/toggle" });
    const on = vocab.methods.map((m) => m.code).filter((c) => c !== "grill");
    s = plannerReducer(s, { codes: on, type: "draft/setMethods" });
    s = plannerReducer(s, { type: "draft/submit" });
    expect(s.catalogue.find((i) => i.name === "Halloumi")?.methods).toEqual(on);
    s = plannerReducer(s, { codes: [], type: "draft/setMethods" });
    expect(s.draft.methods).toEqual([]);
  });

  it("keeps no tick for a method switched off since it was tapped", () => {
    let s = { ...loaded, draft: { ...loaded.draft, name: "Halloumi" } };
    s = plannerReducer(s, { code: "grill", type: "draft/toggleMethod" });
    s = plannerReducer(s, { code: "pan_fry", type: "draft/toggleMethod" });
    s = plannerReducer(s, { code: "grill", type: "method/toggle" });
    s = plannerReducer(s, { type: "draft/submit" });
    expect(s.catalogue.find((i) => i.name === "Halloumi")?.methods).toEqual([
      "pan_fry",
    ]);
  });

  it("can change an existing ingredient's methods, kept in table order", () => {
    const s = plannerReducer(drawn, {
      codes: ["grill", "roast"],
      name: "chicken thighs",
      type: "ingredient/setMethods",
    });
    const chicken = s.catalogue.find((i) => i.name === "Chicken Thighs");
    expect(chicken?.methods).toEqual(["roast", "grill"]);
    // Only that ingredient changes.
    expect(s.catalogue.find((i) => i.name === "Broccoli")).toBe(
      drawn.catalogue.find((i) => i.name === "Broccoli")
    );
  });

  it("drops a method at settle if the ingredient that landed does not have it", () => {
    const settled = plannerReducer(
      { ...drawn, picked: null, spinning: true },
      {
        methods: ["bake", "roast", null],
        target: [0, 0, 0],
        type: "spin/settle",
      }
    );
    // Chicken is ticked for air-fry only; broccoli for nothing.
    expect(settled.methods).toEqual([null, null, null]);
  });
});
