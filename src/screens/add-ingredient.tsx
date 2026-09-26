import type { Dispatch } from "react";

import { categoryIcon } from "../components/glyphs";
import { Icon } from "../components/icon";
import { Switch } from "../components/switch";
import { kindsFor, labelOfCategory } from "../data/vocab";
import type { CategoryCode } from "../data/vocab";
import { addDaysISO, daysUntil, todayISO } from "../lib/dates";
import { kindOfDraft, methodsOn } from "../state/planner";
import type { Action, AddDraft, PlannerState } from "../state/planner";

interface Props {
  state: PlannerState;
  dispatch: Dispatch<Action>;
}

/** Shortcuts for the use-by date. Days, and how the chip reads. */
const DATE_PRESETS: [number, string][] = [
  [3, "3 days"],
  [7, "1 week"],
  [14, "2 weeks"],
  [30, "1 month"],
];

/**
 * Describing a new ingredient: its name, which reel it spins on, what kind it is,
 * and the ways it can be cooked. The kind and the ticks are what dish names and
 * diet filters read, which is why they are asked for once here, not guessed later.
 */
export function AddIngredient({ state, dispatch }: Props) {
  const v = state.vocab;
  const d = state.draft;
  const patch = (p: Partial<AddDraft>) =>
    dispatch({ patch: p, type: "draft/patch" });
  const kinds = kindsFor(v, d.category);
  const current = kindOfDraft(d);
  const hint = kinds.find((k) => k.code === current)?.examples;

  const pickKind = (code: string) =>
    patch(
      d.category === "protein"
        ? { proteinKind: code }
        : d.category === "vegetable"
          ? { vegetableKind: code }
          : { starchKind: code }
    );

  // A method switched off in Cooking methods is not offered here at all.
  const shown = methodsOn(state);
  const ticked = shown.filter((m) => d.methods.includes(m.code));
  const example =
    d.category === "protein" && ticked[0]
      ? `A draw can call it “${ticked[0].phrase} ${d.shortName.trim() || d.name.trim() || "…"}”.`
      : d.category === "vegetable" && ticked[0]
        ? `A draw can serve it “with ${ticked[0].phrase.toLowerCase()} ${(d.shortName.trim() || d.name.trim() || "…").toLowerCase()}”.`
        : ticked.length
          ? `${ticked.length} ticked.`
          : d.category === "protein"
            ? "Nothing ticked: its dishes will be named without a method."
            : d.category === "vegetable"
              ? "Nothing ticked: its dishes use the word its kind comes with."
              : "Nothing ticked: fine for most starches.";

  const dateSub =
    d.days === 0
      ? "Use it today."
      : `${new Date(`${addDaysISO(d.days)}T12:00:00`).toLocaleDateString(
          "en-GB",
          {
            day: "numeric",
            month: "long",
            weekday: "long",
          }
        )} · ${d.days} ${d.days === 1 ? "day" : "days"} from now`;

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        dispatch({ type: "draft/submit" });
      }}
    >
      <div className="field">
        <label htmlFor="ing-name" className="kicker">
          Ingredient
        </label>
        <input
          id="ing-name"
          className="text-input text-input--name"
          value={d.name}
          placeholder="e.g. Halloumi"
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="ing-short" className="kicker">
          Short name
        </label>
        <input
          id="ing-short"
          className="text-input"
          value={d.shortName}
          placeholder={d.name.trim() || "optional"}
          onChange={(e) => patch({ shortName: e.target.value })}
        />
        <div className="body-sm">
          What a dish name calls it. “Chicken Thighs” cooks as “Chicken”. Leave
          it empty to use the full name.
        </div>
      </div>

      <div className="field" role="group" aria-labelledby="which-reel">
        <div id="which-reel" className="kicker">
          Which reel?
        </div>
        <div className="cat-cards">
          {v.categories.map((c) => (
            <button
              key={c.code}
              type="button"
              className="cat-card"
              aria-pressed={d.category === c.code}
              onClick={() => patch({ category: c.code as CategoryCode })}
            >
              <Icon d={categoryIcon(c.code)} size={32} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field" role="group" aria-labelledby="kind-label">
        <div id="kind-label" className="kicker">
          {d.category === "protein" ? "What kind" : "What type"}
        </div>
        <div className="chip-row">
          {kinds.map((k) => (
            <button
              key={k.code}
              type="button"
              className="chip"
              title={k.examples}
              aria-pressed={current === k.code}
              onClick={() => pickKind(k.code)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="body-sm">{hint}</div>
        {d.category === "starch" && (
          <button
            type="button"
            className="gf-toggle"
            role="switch"
            aria-checked={d.glutenFree}
            onClick={() => patch({ glutenFree: !d.glutenFree })}
          >
            <Switch on={d.glutenFree} />
            Gluten-free
          </button>
        )}
      </div>

      <div className="field" role="group" aria-labelledby="how-label">
        <div id="how-label" className="kicker">
          How can it be cooked?
        </div>
        <div className="chip-row">
          {shown.map((m) => (
            <button
              key={m.code}
              type="button"
              className="chip"
              aria-pressed={d.methods.includes(m.code)}
              onClick={() =>
                dispatch({ code: m.code, type: "draft/toggleMethod" })
              }
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="body-sm">
          {shown.length
            ? example
            : "Every method is switched off in Cooking methods."}
        </div>
      </div>

      <button
        type="button"
        className="check-card"
        role="checkbox"
        aria-checked={d.have}
        onClick={() => patch({ have: !d.have })}
      >
        <span className={`tick${d.have ? " tick--on" : ""}`}>
          {d.have ? "✓" : ""}
        </span>
        <span style={{ flex: 1 }}>
          <span className="check-card__title">It’s in my pantry now</span>
          <span className="body-sm check-card__sub">
            {d.have
              ? "Goes into the pantry, starts counting down, and can be drawn."
              : "Goes on the shopping list. Only what is in the pantry ever spins."}
          </span>
        </span>
      </button>

      {d.have && (
        <>
          <div className="field">
            <label htmlFor="ing-date" className="kicker">
              Use by
            </label>
            <div className="date-row">
              <input
                id="ing-date"
                type="date"
                className="text-input text-input--date"
                value={addDaysISO(d.days)}
                min={todayISO()}
                onChange={(e) => {
                  if (e.target.value) {
                    patch({ days: Math.max(0, daysUntil(e.target.value)) });
                  }
                }}
              />
              {DATE_PRESETS.map(([n, label]) => (
                <button
                  key={n}
                  type="button"
                  className="chip"
                  aria-pressed={d.days === n}
                  onClick={() => patch({ days: n })}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="body-sm">{dateSub}</div>
          </div>

          <div className="field">
            <label htmlFor="ing-qty" className="kicker">
              How much
            </label>
            <div className="qty-row">
              <input
                id="ing-qty"
                className="text-input"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="250"
                value={d.qty}
                onChange={(e) => patch({ qty: e.target.value })}
              />
              <select
                aria-label="Unit"
                className="unit-select"
                value={d.unit}
                onChange={(e) => patch({ unit: e.target.value })}
              >
                {v.units.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      <button
        type="submit"
        className={`btn submit${d.name.trim() ? "" : " btn--muted"}`}
        aria-disabled={!d.name.trim()}
      >
        Add to the {labelOfCategory(v, d.category).toLowerCase()} reel
      </button>
      {state.flash && (
        <div className="flash" role="status">
          {state.flash}
        </div>
      )}
    </form>
  );
}
