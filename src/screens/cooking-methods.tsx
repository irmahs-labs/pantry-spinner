import type { Dispatch } from "react";

import { Switch } from "../components/switch";
import type { Action, PlannerState } from "../state/planner";

interface Props {
  state: PlannerState;
  dispatch: Dispatch<Action>;
}

/**
 * The methods come from meal_planner_cooking_methods, each with the phrase its
 * dish name uses. Which ones an ingredient can be cooked with is ticked on the
 * ingredient; this screen switches a method off for everything at once.
 */
export const CookingMethods = ({ state, dispatch }: Props) => {
  const v = state.vocab;

  const usedBy = (code: string) =>
    state.catalogue.filter((i) => i.methods.includes(code)).length;

  return (
    <div className="page-narrow">
      <p className="intro">
        Each ingredient says which of these it can be cooked with, ticked when
        you add it. A draw picks one of those ticks for each pick — and anything
        switched off here is left out, whatever was ticked.
      </p>
      <ul className="rows">
        {v.methods.map((m) => {
          const enabled = !state.methodsOff.includes(m.code);
          const count = usedBy(m.code);

          return (
            <li key={m.code} className={`lrow${enabled ? "" : " lrow--done"}`}>
              <span className="lrow__main" style={{ cursor: "default" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="lrow__name">{m.label}</span>
                  <span className="lrow__why">
                    “{m.phrase} …” · ticked on {count}{" "}
                    {count === 1 ? "ingredient" : "ingredients"}
                  </span>
                </span>
              </span>
              <button
                type="button"
                className="method-toggle"
                role="switch"
                aria-checked={enabled}
                aria-label={m.label}
                onClick={() =>
                  dispatch({ code: m.code, type: "method/toggle" })
                }
              >
                {enabled ? "On" : "Off"}
                <Switch on={enabled} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
