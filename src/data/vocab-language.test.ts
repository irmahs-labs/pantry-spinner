import { describe, expect, it } from "vitest";

import raw from "../test/vocab.json";
import { toVocab } from "./vocab";
import type { RawVocab } from "./vocab";

// SAFETY: vocab.json is scripts/vocab-fixture.sh's dump of every reference
// table, one array of rows per table, which is the shape RawVocab names.
const rows = raw as RawVocab;

describe("toVocab in each language", () => {
  it("reads the English columns by default", () => {
    const v = toVocab(rows);
    expect(v.categories.map((c) => c.label)).toEqual([
      "Protein",
      "Vegetables",
      "Starch",
    ]);
    expect(v.methods.find((m) => m.code === "steam")?.phrase).toBe("Steamed");
  });

  it("reads every word's French twin in French", () => {
    const v = toVocab(rows, "fr");
    expect(v.categories.map((c) => c.label)).toEqual([
      "Protéines",
      "Légumes",
      "Féculents",
    ]);
    expect(v.methods.find((m) => m.code === "steam")?.phrase).toBe(
      "à la vapeur"
    );
    expect(v.dietRules.find((r) => r.code === "gluten_free")?.label).toBe(
      "Sans gluten"
    );
    expect(v.vegetableKinds.find((k) => k.code === "leafy")?.word).toBe(
      "à l’étuvée"
    );
    // Codes stay the same in both: they're what the data keeps
    expect(v.units.map((u) => u.code)).toEqual(
      toVocab(rows).units.map((u) => u.code)
    );
  });

  it("falls back to English where a French word is missing", () => {
    const [first] = rows.meal_planner_categories;

    const v = toVocab(
      {
        ...rows,
        meal_planner_categories: [{ ...first, label_fr: null }],
      },
      "fr"
    );

    expect(v.categories[0]?.label).toBe("Protein");
  });
});
