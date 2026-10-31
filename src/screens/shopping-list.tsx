import { useState } from "react";
import type { Dispatch } from "react";

import { defaultUnit, formatQuantity } from "../data/vocab";
import { ingredientOf } from "../engine/reel";
import { useCopy } from "../lib/language";
import type { Action, PlannerState } from "../state/planner";

const COPY = {
  en: {
    add: "Add",
    addTo: "Add to the list",
    addToOne: "Add to the list…",
    allOn: "Everything is on the list",
    gone: " · no longer in your ingredients",
    howMuch: "How much",
    intoPantry: "Into pantry",
    intro: [
      "What to pick up. ",
      "Into pantry",
      " moves something across, and only what is in the pantry can be drawn.",
    ],
    nothing: "Nothing to buy. The pantry has it covered.",
    remove: (name: string) => `Remove ${name}`,
    unit: "Unit",
  },
  fr: {
    add: "Ajouter",
    addTo: "Ajouter à la liste",
    addToOne: "Ajouter à la liste…",
    allOn: "Tout est sur la liste",
    gone: " · ne fait plus partie de vos ingrédients",
    howMuch: "Combien",
    intoPantry: "Au garde-manger",
    intro: [
      "Ce qu’il faut acheter. ",
      "Au garde-manger",
      " le range, et seul ce qui est dans le garde-manger peut être tiré.",
    ],
    nothing: "Rien à acheter. Le garde-manger est bien rempli.",
    remove: (name: string) => `Retirer ${name}`,
    unit: "Unité",
  },
};

interface Props {
  state: PlannerState;
  dispatch: Dispatch<Action>;
}

export const ShoppingList = ({ state, dispatch }: Props) => {
  const v = state.vocab;
  const t = useCopy(COPY);
  const [chosen, setChosen] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("");

  const addable = state.catalogue
    .filter((i) => !state.grocery.some((g) => g.name === i.name))
    .toSorted((a, b) => a.name.localeCompare(b.name));

  const add = () => {
    if (!chosen) {
      return;
    }

    dispatch({
      name: chosen,
      qty,
      type: "grocery/add",
      unit: unit || defaultUnit(v),
    });
    setChosen("");
    setQty("1");
  };

  return (
    <div className="page-narrow">
      <p className="intro">
        {t.intro[0]}
        <strong>{t.intro[1]}</strong>
        {t.intro[2]}
      </p>
      <div className="add-row add-row--wrap">
        <select
          aria-label={t.addTo}
          className="unit-select"
          style={{ flex: "1 1 220px", minWidth: 0 }}
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
        >
          <option value="">{addable.length ? t.addToOne : t.allOn}</option>
          {v.categories.map((c) => {
            const items = addable.filter((i) => i.category === c.code);

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
          aria-label={t.howMuch}
          className="text-input"
          style={{ width: 72 }}
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <select
          aria-label={t.unit}
          className="unit-select"
          value={unit || defaultUnit(v)}
          onChange={(e) => setUnit(e.target.value)}
        >
          {v.units.map((u) => (
            <option key={u.code} value={u.code}>
              {u.code}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`btn${chosen ? "" : " btn--muted"}`}
          onClick={add}
          aria-disabled={!chosen}
        >
          {t.add}
        </button>
      </div>
      {state.grocery.length === 0 && <p className="intro">{t.nothing}</p>}
      <ul className="rows">
        {state.grocery.map((g) => (
          <li key={g.name} className={`lrow${g.acquired ? " lrow--done" : ""}`}>
            <button
              type="button"
              className="lrow__main"
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the whole row (tick, name, note) is the control, and an <input type="checkbox"> cannot hold content
              role="checkbox"
              aria-checked={g.acquired}
              onClick={() => dispatch({ name: g.name, type: "grocery/toggle" })}
            >
              <span className={`tick${g.acquired ? " tick--on" : ""}`}>
                {g.acquired ? "✓" : ""}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="lrow__name">{g.name}</span>
                <span className="lrow__why">
                  {g.note}
                  {ingredientOf(state.catalogue, g.name) ? "" : t.gone}
                  {" · "}
                  {formatQuantity(v, g.qty, g.unit)}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="stock-btn"
              onClick={() => dispatch({ name: g.name, type: "grocery/stock" })}
            >
              {t.intoPantry}
            </button>
            <button
              type="button"
              className="icon-x"
              aria-label={t.remove(g.name)}
              onClick={() => dispatch({ name: g.name, type: "grocery/remove" })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
