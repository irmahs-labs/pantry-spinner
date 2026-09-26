import { useState } from "react";
import type { Dispatch } from "react";

import { ServingField } from "../components/serving-field";
import {
  formatQuantity,
  labelOfCategory,
  servingFactorOf,
  servingUnitOf,
  servingsLeft,
} from "../data/vocab";
import type { CategoryCode } from "../data/vocab";
import { daysLeft, daysNote, ingredientOf } from "../engine/reel";
import { addDaysISO, daysUntil, todayISO } from "../lib/dates";
import { methodsOn } from "../state/planner";
import type { Action, PlannerState } from "../state/planner";

interface Props {
  state: PlannerState;
  dispatch: Dispatch<Action>;
}

/**
 * The pantry is what the reels draw from. Stocking something picks from the
 * ingredients you have already described — the dropdown is the whole list, minus
 * whatever is in the pantry already.
 */
export function Pantry({ state, dispatch }: Props) {
  const v = state.vocab;
  const ingredient = (name: string) => ingredientOf(state.catalogue, name);

  const rows = state.pantry
    .filter(
      (p) =>
        state.pantryFilter === "all" ||
        ingredient(p.name)?.category === state.pantryFilter
    )
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));

  const stockable = state.catalogue
    .filter((i) => !state.pantry.some((p) => p.name === i.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const s = state.stock;
  const patch = (p: Partial<typeof s>) =>
    dispatch({ patch: p, type: "stock/patch" });
  // The card whose cooking methods are open for editing, by ingredient name.
  const [editing, setEditing] = useState<string | null>(null);
  // As on Add ingredient, a switched-off method is not offered. A tick it
  // already has is kept, not cleared, so switching the method back on restores it.
  const shown = methodsOn(state);
  const setMethods = (name: string, codes: string[]) =>
    dispatch({ codes, name, type: "ingredient/setMethods" });
  // "3 servings of 200 g": the count is in the stock's unit, the size in its
  // serving unit, so a kilogram of rice reads in grams a serving.
  const servingsNote = (p: (typeof state.pantry)[number]) => {
    const n = servingsLeft(p.qty * servingFactorOf(v, p.unit), p.serving);
    return `${n} ${n === 1 ? "serving" : "servings"} of ${formatQuantity(v, p.serving, servingUnitOf(v, p.unit))}`;
  };
  const methodLabels = (codes: string[]) =>
    codes
      .map((c) => v.methods.find((m) => m.code === c)?.label)
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="stack" style={{ gap: 20 }}>
      <form
        className="add-row add-row--wrap"
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "stock/submit" });
        }}
      >
        <select
          aria-label="Ingredient to stock"
          className="unit-select"
          style={{ flex: "1 1 220px", minWidth: 0 }}
          value={s.name}
          onChange={(e) => patch({ name: e.target.value })}
        >
          <option value="">
            {stockable.length
              ? "Stock an ingredient…"
              : "Everything you have is in the pantry"}
          </option>
          {v.categories.map((c) => {
            const items = stockable.filter((i) => i.category === c.code);
            return items.length ? (
              <optgroup key={c.code} label={c.label}>
                {items.map((i) => (
                  <option key={i.name} value={i.name}>
                    {i.name}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
        <input
          aria-label="Quantity"
          className="text-input"
          style={{ width: 72 }}
          type="number"
          min={0}
          step="any"
          value={s.qty}
          onChange={(e) => patch({ qty: e.target.value })}
        />
        <select
          aria-label="Unit"
          className="unit-select"
          value={s.unit}
          onChange={(e) => patch({ unit: e.target.value })}
        >
          {v.units.map((u) => (
            <option key={u.code} value={u.code}>
              {u.code}
            </option>
          ))}
        </select>
        <ServingField
          vocab={v}
          unit={s.unit}
          value={s.serving}
          onChange={(serving) => patch({ serving })}
        />
        <input
          aria-label="Use by date"
          className="text-input text-input--date"
          type="date"
          min={todayISO()}
          value={addDaysISO(s.days)}
          onChange={(e) => {
            if (e.target.value) {
              patch({ days: Math.max(0, daysUntil(e.target.value)) });
            }
          }}
        />
        <button
          type="submit"
          className={`btn${s.name ? "" : " btn--muted"}`}
          aria-disabled={!s.name}
        >
          Stock it
        </button>
      </form>

      <div className="toolbar">
        <button
          type="button"
          className="chip"
          aria-pressed={state.pantryFilter === "all"}
          onClick={() => dispatch({ filter: "all", type: "pantry/filter" })}
        >
          All
        </button>
        {v.categories.map((c) => (
          <button
            key={c.code}
            type="button"
            className="chip"
            aria-pressed={state.pantryFilter === c.code}
            onClick={() =>
              dispatch({
                filter: c.code as CategoryCode,
                type: "pantry/filter",
              })
            }
          >
            {c.label}
          </button>
        ))}
        <div className="toolbar__spacer" />
        <button
          type="button"
          className="btn"
          onClick={() => dispatch({ screen: "add", type: "screen/go" })}
        >
          + New ingredient
        </button>
      </div>

      {state.catalogue.length === 0 && (
        <p className="intro">
          No ingredients yet. <strong>New ingredient</strong> describes one —
          its reel, its kind and the ways it can be cooked — and then it can be
          stocked here.
        </p>
      )}
      {state.catalogue.length > 0 && rows.length === 0 && (
        <p className="intro">
          Nothing stocked here, so the reels have nothing to draw from.
        </p>
      )}

      <div className="pantry-grid">
        {rows.map((p) => {
          const left = daysLeft(p);
          const soon = left <= 3;
          const mid = left <= 10;
          const described = ingredient(p.name);
          const how = methodLabels(described?.methods ?? []);
          return (
            <article
              key={p.name}
              className={`pcard${soon ? " pcard--soon" : ""}`}
            >
              <div className="pcard__head">
                <div className="chip-row" style={{ gap: 6 }}>
                  <span
                    className={`badge ${soon ? "badge--dark" : mid ? "tone-fresh" : "tone-buy"}`}
                  >
                    {soon ? "Use it" : mid ? "Fresh" : "Stocked"}
                  </span>
                  <span className="badge badge--line">
                    {described
                      ? labelOfCategory(v, described.category)
                      : "Unknown"}
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-x"
                  aria-label={`Remove ${p.name}`}
                  onClick={() =>
                    dispatch({ name: p.name, type: "pantry/remove" })
                  }
                >
                  ×
                </button>
              </div>
              <div>
                <div className="pcard__name">{p.name}</div>
                <div className="body-sm pcard__sub">
                  {formatQuantity(v, p.qty, p.unit)}
                  {p.serving === 1 && servingUnitOf(v, p.unit) === p.unit
                    ? ""
                    : ` · ${servingsNote(p)}`}{" "}
                  · {daysNote(left)}
                </div>
                <div className="pcard__how">
                  <span className="body-sm">{how || "No methods ticked"}</span>
                  {described && (
                    <button
                      type="button"
                      className="text-btn"
                      aria-expanded={editing === p.name}
                      onClick={() =>
                        setEditing(editing === p.name ? null : p.name)
                      }
                    >
                      {editing === p.name ? "Done" : "Edit"}
                    </button>
                  )}
                </div>
                {described && editing === p.name && (
                  <div
                    className="chip-row pcard__methods"
                    role="group"
                    aria-label={`How ${p.name} can be cooked`}
                  >
                    {shown.map((m) => {
                      const on = described.methods.includes(m.code);
                      return (
                        <button
                          key={m.code}
                          type="button"
                          className="chip chip--small"
                          aria-pressed={on}
                          onClick={() =>
                            setMethods(
                              p.name,
                              on
                                ? described.methods.filter((c) => c !== m.code)
                                : [...described.methods, m.code]
                            )
                          }
                        >
                          {m.label}
                        </button>
                      );
                    })}
                    {shown.length === 0 && (
                      <span className="body-sm">
                        Every method is switched off in Cooking methods.
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="bar" role="presentation">
                <div
                  style={{
                    width: `${Math.max(6, Math.min(100, Math.round((left / 14) * 100)))}%`,
                  }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
