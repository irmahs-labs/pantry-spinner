import type { Dispatch } from "react";

import { Switch } from "../components/switch";
import type { Action, PlannerState } from "../state/planner";

interface Props {
  state: PlannerState;
  dispatch: Dispatch<Action>;
}

export function ReelRules({ state, dispatch }: Props) {
  return (
    <div className="rules">
      <div className="rcard">
        <div className="kicker">What stays off the reels</div>
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
        <p className="body-sm">
          Each rule is a row in meal_planner_diet_rules saying what it keeps
          off, read against each ingredient’s kind — so a rule works on anything
          you add, and a new one is a new row.
        </p>
      </div>

      <button
        type="button"
        className="weight-card"
        role="switch"
        aria-checked={state.weighting}
        onClick={() => dispatch({ type: "rules/toggleWeighting" })}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="weight-card__title">Weight the reels by expiry</span>
          <span className="weight-card__body">
            Anything with two days left comes up about four times as often.
          </span>
        </span>
        <Switch on={state.weighting} large />
      </button>

      <p className="footnote">
        Rules apply to the next draw. A held column is never overridden.
      </p>
    </div>
  );
}
