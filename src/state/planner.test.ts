import { describe, expect, it } from "vitest";

import { toVocab } from "../data/vocab";
import type { RawVocab } from "../data/vocab";
import { FEATURES } from "../features";
import raw from "../test/vocab.json";
import { createInitialState, plannerReducer } from "./planner";
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
    { expiresOn: "2026-09-25", name: "Chicken Thighs", qty: 600, unit: "g" },
    { expiresOn: "2026-09-28", name: "Broccoli", qty: 1, unit: "bunch" },
    { expiresOn: "2026-12-22", name: "Jasmine Rice", qty: 1.5, unit: "kg" },
  ],
  picked: ["Chicken Thighs", "Broccoli", "Jasmine Rice"],
};

describe("into the pot", () => {
  const after = plannerReducer(drawn, { type: "dish/cook" });

  it("clears the draw either way", () => {
    expect(after.picked).toBeNull();
  });

  it("pushes the drawn items back without bringing any date forward", () => {
    const rice = after.pantry.find((p) => p.name === "Jasmine Rice");
    const chicken = after.pantry.find((p) => p.name === "Chicken Thighs");
    // December is further out than two weeks, so it is left alone.
    expect(rice?.expiresOn).toBe("2026-12-22");
    expect(chicken?.expiresOn).not.toBe("2026-09-25");
  });

  it("records the meal only when history is on", () => {
    if (FEATURES.history) {
      expect(after.plan).toHaveLength(1);
      expect(after.plan[0].dish).toBe(
        "Air-fried Chicken Rice Bowl with charred broccoli"
      );
      expect(after.screen).toBe("plan");
    } else {
      expect(after.plan).toHaveLength(0);
      expect(after.screen).toBe("spin");
      expect(after.flash).toContain("another two weeks");
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
