import { describe, expect, it } from "vitest";

import type { Ingredient, PantryItem } from "../data/model";
import { formatQuantity, toVocab } from "../data/vocab";
import type { RawVocab } from "../data/vocab";
import { addDaysISO } from "../lib/dates";
import raw from "../test/vocab.json";
import {
  allowed,
  canSpin,
  chooseMethods,
  dishName,
  emptyReels,
  fillTemplate,
  ingredientOf,
  paylineOf,
  pickIndex,
  planSpin,
  reelsFrom,
  settledIdx,
  styleOf,
  weightOf,
} from "./reel";
import type { PickContext, Triple } from "./reel";

// The vocabulary exactly as the migration seeds it — see scripts/vocab-fixture.sh.
const vocab = toVocab(raw as RawVocab);
const rule = (code: string) => vocab.dietRules.filter((r) => r.code === code);

const ing = (
  name: string,
  category: Ingredient["category"],
  kind: string,
  extra: Partial<Ingredient> = {}
): Ingredient => ({
  category,
  glutenFree: null,
  kind,
  methods: [],
  name,
  shortName: null,
  ...extra,
});

const CATALOGUE: Ingredient[] = [
  ing("Chicken Thighs", "protein", "poultry", {
    methods: ["air_fry", "bake"],
    shortName: "Chicken",
  }),
  ing("Firm Tofu", "protein", "plant", {
    methods: ["pan_fry"],
    shortName: "Tofu",
  }),
  ing("Ground Beef", "protein", "red", { shortName: "Beef" }),
  ing("Salmon Fillet", "protein", "fish", { shortName: "Salmon" }),
  ing("Broccoli", "vegetable", "brassica", { methods: ["roast"] }),
  ing("Baby Spinach", "vegetable", "leafy", { shortName: "spinach" }),
  ing("Jasmine Rice", "starch", "grain", {
    glutenFree: true,
    methods: ["steam"],
    shortName: "Rice",
  }),
  ing("Orzo", "starch", "wholegrain", { glutenFree: false }),
  ing("Corn Tortillas", "starch", "wraps", {
    glutenFree: true,
    shortName: "Tortilla",
  }),
  ing("Sweet Potato", "starch", "tuber", {
    glutenFree: true,
    methods: ["roast"],
  }),
];
const named = (name: string) => ingredientOf(CATALOGUE, name);
const stock = (name: string, days: number): PantryItem => ({
  expiresOn: addDaysISO(days),
  name,
  qty: 1,
  serving: 1,
  unit: "piece",
});

const PANTRY: PantryItem[] = [
  stock("Chicken Thighs", 2),
  stock("Firm Tofu", 6),
  stock("Ground Beef", 40),
  stock("Broccoli", 5),
  stock("Baby Spinach", 1),
  stock("Jasmine Rice", 90),
  stock("Orzo", 8),
];

const reels = reelsFrom(PANTRY, CATALOGUE, vocab);
const ctx: PickContext = {
  catalogue: CATALOGUE,
  rules: [],
  vocab,
  weighting: true,
};

describe("the vocabulary the migration seeds", () => {
  it("has three categories in reel order", () => {
    expect(vocab.categories.map((c) => c.code)).toEqual([
      "protein",
      "vegetable",
      "starch",
    ]);
  });

  it("gives every starch kind a dish style that exists", () => {
    for (const kind of vocab.starchKinds) {
      expect(
        vocab.dishStyles.some((s) => s.id === kind.styleId),
        kind.code
      ).toBe(true);
    }
  });

  it("only uses placeholders the app knows how to fill", () => {
    const known = [
      "method",
      "protein",
      "starch",
      "starch_method",
      "vegetable",
      "vegetable_method",
    ];
    for (const style of vocab.dishStyles) {
      const used = [...style.template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const key of used) {
        expect(known, `${style.code}: {${key}}`).toContain(key);
      }
    }
  });

  it("marks exactly one default unit", () => {
    expect(vocab.units.filter((u) => u.isDefault)).toHaveLength(1);
  });

  it("only excludes diets that protein kinds actually use", () => {
    const diets = new Set(vocab.proteinKinds.map((k) => k.diet));
    for (const r of vocab.dietRules) {
      for (const d of r.excludesDiets)
        expect(diets.has(d), `${r.code}: ${d}`).toBe(true);
    }
  });
});

describe("reels come from the pantry", () => {
  it("slices what is stocked by the category of its ingredient", () => {
    expect(reels.map((r) => r.length)).toEqual([3, 2, 2]);
  });

  it("ignores an ingredient that is described but not stocked", () => {
    expect(reels.flat().map((i) => i.name)).not.toContain("Salmon Fillet");
  });

  it("puts the soonest to go off at the top", () => {
    expect(reels[0].map((i) => i.name)).toEqual([
      "Chicken Thighs",
      "Firm Tofu",
      "Ground Beef",
    ]);
  });

  it("cannot draw from an empty pantry, or before the vocabulary has loaded", () => {
    const none = reelsFrom([], CATALOGUE, vocab);
    expect(canSpin(none, vocab)).toBe(false);
    expect(emptyReels(none, vocab)).toEqual(["protein", "vegetable", "starch"]);
    expect(canSpin(reels, { ...vocab, categories: [] })).toBe(false);
  });
});

describe("diet rules are rows", () => {
  it("keeps meat and fish off for Vegetarian", () => {
    expect(allowed(named("Firm Tofu"), rule("vegetarian"), vocab)).toBe(true);
    expect(allowed(named("Chicken Thighs"), rule("vegetarian"), vocab)).toBe(
      false
    );
    expect(allowed(named("Salmon Fillet"), rule("vegetarian"), vocab)).toBe(
      false
    );
  });

  it("keeps fish but drops meat for Pescatarian", () => {
    expect(allowed(named("Salmon Fillet"), rule("pescatarian"), vocab)).toBe(
      true
    );
    expect(allowed(named("Chicken Thighs"), rule("pescatarian"), vocab)).toBe(
      false
    );
  });

  it("drops red meat by its kind", () => {
    expect(allowed(named("Ground Beef"), rule("no_red_meat"), vocab)).toBe(
      false
    );
    expect(allowed(named("Chicken Thighs"), rule("no_red_meat"), vocab)).toBe(
      true
    );
  });

  it("goes by the ingredient answer for gluten", () => {
    expect(allowed(named("Jasmine Rice"), rule("gluten_free"), vocab)).toBe(
      true
    );
    expect(allowed(named("Orzo"), rule("gluten_free"), vocab)).toBe(false);
  });

  it("applies a rule it has never heard of, from its columns alone", () => {
    const noFish = [
      {
        code: "x",
        excludesDiets: ["fish"],
        excludesRedMeat: false,
        id: 99,
        label: "x",
        requiresGlutenFree: false,
      },
    ];
    expect(allowed(named("Salmon Fillet"), noFish, vocab)).toBe(false);
    expect(allowed(named("Chicken Thighs"), noFish, vocab)).toBe(true);
  });
});

describe("weighting and the spin", () => {
  it("favours what is closest to going off", () => {
    expect([2, 4, 6, 40].map((d) => weightOf(stock("x", d), true))).toEqual([
      6, 3, 1.6, 1,
    ]);
    expect(weightOf(stock("x", 2), false)).toBe(1);
  });

  it("always lands inside the reel", () => {
    for (let r = 0; r < 100; r += 1) {
      const i = pickIndex(reels[0], ctx, () => r / 100);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(reels[0].length);
    }
  });

  it("leaves every target on the payline once the strip settles", () => {
    const plan = planSpin([0, 0, 0], [false, false, false], reels, ctx);
    const rest = settledIdx(plan.target, reels);
    plan.target.forEach((t, k) =>
      expect(paylineOf(rest[k], reels[k].length)).toBe(t)
    );
    expect(plan.dur).toEqual(["1.50s", "1.92s", "2.34s"]);
  });
});

describe("cooking methods come from the ticks", () => {
  const picks = [
    named("Chicken Thighs"),
    named("Broccoli"),
    named("Jasmine Rice"),
  ] as Triple<Ingredient | undefined>;
  const free: Triple<boolean> = [false, false, false];

  it("picks only from what was ticked for each ingredient", () => {
    for (let r = 0; r < 50; r += 1) {
      const [p, v, s] = chooseMethods(picks, [], free, null);
      expect(["air_fry", "bake"]).toContain(p);
      expect(v).toBe("roast");
      expect(s).toBe("steam");
    }
  });

  it("gives no method to an ingredient with nothing ticked", () => {
    const plain = [
      named("Ground Beef"),
      named("Baby Spinach"),
      named("Orzo"),
    ] as Triple<Ingredient | undefined>;
    expect(chooseMethods(plain, [], free, null)).toEqual([null, null, null]);
  });

  it("leaves out anything switched off in Cooking methods", () => {
    for (let r = 0; r < 30; r += 1) {
      expect(chooseMethods(picks, ["air_fry"], free, null)[0]).toBe("bake");
    }
    expect(chooseMethods(picks, ["air_fry", "bake"], free, null)[0]).toBeNull();
  });

  it("keeps the method of a held column", () => {
    for (let r = 0; r < 30; r += 1) {
      expect(
        chooseMethods(picks, [], [true, false, false], ["bake", null, null])[0]
      ).toBe("bake");
    }
  });
});

describe("dish names are filled from the templates table", () => {
  const picks = (p: string, v: string, s: string) =>
    [named(p), named(v), named(s)] as Triple<Ingredient | undefined>;

  it("uses the protein method in front and the vegetable method behind", () => {
    expect(
      dishName(
        picks("Chicken Thighs", "Broccoli", "Jasmine Rice"),
        ["air_fry", "roast", null],
        vocab
      )
    ).toBe("Air-fried Chicken Rice Bowl with roasted broccoli");
  });

  it("falls back to the vegetable kind word when nothing is ticked for it", () => {
    expect(
      dishName(
        picks("Chicken Thighs", "Baby Spinach", "Jasmine Rice"),
        ["bake", null, null],
        vocab
      )
    ).toBe("Baked Chicken Rice Bowl with wilted spinach");
  });

  it("drops the participle cleanly when the protein has no method", () => {
    expect(
      dishName(
        picks("Ground Beef", "Broccoli", "Jasmine Rice"),
        [null, null, null],
        vocab
      )
    ).toBe("Beef Rice Bowl with charred broccoli");
  });

  it("takes the shape from the starch kind", () => {
    expect(styleOf(named("Corn Tortillas"), vocab)?.label).toBe("Tacos");
    expect(
      dishName(
        picks("Firm Tofu", "Broccoli", "Corn Tortillas"),
        ["pan_fry", null, null],
        vocab
      )
    ).toBe("Pan-fried Tofu Tacos with charred broccoli");
  });

  it("can use the starch method where the template asks for it", () => {
    expect(
      dishName(
        picks("Chicken Thighs", "Broccoli", "Sweet Potato"),
        ["bake", "roast", "roast"],
        vocab
      )
    ).toBe("Baked Chicken & roasted Sweet Potato Tray with roasted broccoli");
  });

  it("fills a template it has never seen", () => {
    expect(
      fillTemplate("{method} {protein} over {starch}", {
        protein: "Tofu",
        starch: "Rice",
      })
    ).toBe("Tofu over Rice");
    expect(fillTemplate("{unknown} soup", {})).toBe("Soup");
  });
});

describe("quantities", () => {
  it("reads a count unit as ×n because the units table says so", () => {
    expect(formatQuantity(vocab, 8, "piece")).toBe("×8");
    expect(formatQuantity(vocab, 600, "g")).toBe("600 g");
  });
});
