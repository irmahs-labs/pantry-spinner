import type { Dispatch } from "react";

import { Switch } from "../components/switch";
import { useCopy } from "../lib/language";
import type { Action, PlannerState } from "../state/planner";

const COPY = {
  en: {
    explain:
      "Each rule is a row in meal_planner_diet_rules saying what it keeps off, read against each ingredient’s kind — so a rule works on anything you add, and a new one is a new row.",
    footnote:
      "Rules apply to the next draw. A held column is never overridden.",
    keptOff: "What stays off the reels",
    weight: "Weight the reels by expiry",
    weightBody:
      "Anything with two days left comes up about four times as often.",
  },
  fr: {
    explain:
      "Chaque règle est une ligne de meal_planner_diet_rules qui dit ce qu’elle écarte, lue selon le type de chaque ingrédient — une règle s’applique donc à tout ce que vous ajoutez, et une nouvelle règle est une nouvelle ligne.",
    footnote:
      "Les règles s’appliquent au prochain tirage. Une colonne bloquée n’est jamais remplacée.",
    keptOff: "Ce qui reste hors des rouleaux",
    weight: "Pondérer les rouleaux par la date limite",
    weightBody:
      "Ce qui n’a plus que deux jours sort environ quatre fois plus souvent.",
  },
};

interface Props {
  state: PlannerState;
  dispatch: Dispatch<Action>;
}

export const ReelRules = ({ state, dispatch }: Props) => {
  const t = useCopy(COPY);

  return (
    <div className="rules">
      <div className="rcard">
        <div className="kicker">{t.keptOff}</div>
        <div className="chip-row">
          {state.vocab.dietRules.map((rule) => (
            <button
              key={rule.code}
              type="button"
              className="diet-chip"
              aria-pressed={state.diets.includes(rule.code)}
              onClick={() =>
                dispatch({ code: rule.code, type: "rules/toggleDiet" })
              }
            >
              {rule.label}
            </button>
          ))}
        </div>
        <p className="body-sm">{t.explain}</p>
      </div>

      <button
        type="button"
        className="weight-card"
        role="switch"
        aria-checked={state.weighting}
        onClick={() => dispatch({ type: "rules/toggleWeighting" })}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="weight-card__title">{t.weight}</span>
          <span className="weight-card__body">{t.weightBody}</span>
        </span>
        <Switch on={state.weighting} large />
      </button>

      <p className="footnote">{t.footnote}</p>
    </div>
  );
};
