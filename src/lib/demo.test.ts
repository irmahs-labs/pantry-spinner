import { describe, expect, it } from "vitest";

import type { Ingredient } from "../data/model";
import { toVocab } from "../data/vocab";
import type { RawVocab } from "../data/vocab";
import {
  canSpin,
  chooseMethods,
  dishName,
  emptyReels,
  ingredientOf,
  reelsFrom,
} from "../engine/reel";
import type { Triple } from "../engine/reel";
import rawDemo from "../test/demo.json";
import rawVocab from "../test/vocab.json";
import { toDemo } from "./demo";
import type { RawDemo } from "./demo";

// Both fixtures come straight from the migrations — see scripts/vocab-fixture.sh.
// SAFETY: vocab.json is that script's dump of every reference table, one array
// of rows per table, which is the shape RawVocab names.
const vocab = toVocab(rawVocab as RawVocab);
const today = "2026-09-23";
const addDays = (n: number) => {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
// SAFETY: demo.json is the same script's dump of the four demo tables, one
// array of rows per table, which is the shape RawDemo names.
const demo = toDemo(rawDemo as RawDemo, vocab, addDays);

describe("the demo seed", () => {
  it("can be drawn from the moment it opens", () => {
    const reels = reelsFrom(demo.pantry, demo.catalogue, vocab);
    expect(emptyReels(reels, vocab)).toEqual([]);
    expect(canSpin(reels, vocab)).toBe(true);
  });

  it("only stocks ingredients it describes", () => {
    for (const item of demo.pantry) {
      expect(ingredientOf(demo.catalogue, item.name), item.name).toBeDefined();
    }
    for (const item of demo.grocery) {
      expect(ingredientOf(demo.catalogue, item.name), item.name).toBeDefined();
    }
  });

  it("turns days left into dates on the day it opens", () => {
    const spinach = demo.pantry.find((p) => p.name === "Baby Spinach");
    expect(spinach?.expiresOn).toBe("2026-09-24");
  });

  it("gives every kind and unit a code the vocabulary knows", () => {
    for (const i of demo.catalogue) {
      expect(i.kind, i.name).not.toBe("");
    }
    const units = new Set(vocab.units.map((u) => u.code));
    for (const p of demo.pantry) {
      expect(units.has(p.unit), p.name).toBe(true);
    }
  });

  it("shows both halves of dish naming: a ticked method, and a kind word for nothing ticked", () => {
    const chicken = ingredientOf(demo.catalogue, "Chicken Thighs");
    const spinach = ingredientOf(demo.catalogue, "Baby Spinach");
    const rice = ingredientOf(demo.catalogue, "Jasmine Rice");
    expect(chicken?.methods.length).toBeGreaterThan(0);
    expect(spinach?.methods).toEqual([]);

    const picks: Triple<Ingredient | undefined> = [chicken, spinach, rice];
    const methods = chooseMethods(
      picks,
      [],
      [false, false, false],
      null,
      () => 0
    );
    expect(dishName(picks, methods, vocab)).toBe(
      "Pan-fried Chicken Rice Bowl with wilted spinach"
    );
  });

  it("keeps the rest of a guest snapshot empty", () => {
    expect(demo.plan).toEqual([]);
    expect(demo.methodsOff).toEqual([]);
  });
});
