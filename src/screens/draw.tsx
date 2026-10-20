import { useMemo } from "react";
import type { Dispatch } from "react";

import { COOK_ICONS, dishIcon } from "../components/glyphs";
import { Icon } from "../components/icon";
import type { Ingredient } from "../data/model";
import { labelOfCategory, methodOf } from "../data/vocab";
import {
  CELL_H,
  STRIP_REPEATS,
  canSpin,
  daysLeft,
  dishName,
  emptyReels,
  ingredientOf,
  reelsFrom,
  styleOf,
} from "../engine/reel";
import type { Triple } from "../engine/reel";
import { todayWeekday } from "../lib/dates";
import { yesterdaysMeal } from "../state/planner";
import type { Action, PlannerState } from "../state/planner";

interface DrawProps {
  state: PlannerState;
  dispatch: Dispatch<Action>;
  onSpin: () => void;
}

const listOf = (words: string[]) =>
  words.length === 1
    ? words[0]
    : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;

/** The line under the draw button: what is missing, what is happening, or what to do next. */
const hintFor = (
  ready: boolean,
  spinning: boolean,
  settled: boolean,
  missing: string[]
): string => {
  if (!ready) {
    return `Stock ${listOf(missing)} to draw.`;
  }

  if (spinning) {
    return "Turning over…";
  }

  if (settled) {
    return "Click a column to hold it, then draw again.";
  }

  return "Draw three — or press";
};

const reelTitle = (empty: boolean, locked: boolean): string => {
  if (empty) {
    return "Nothing stocked";
  }

  return locked ? "Release this column" : "Hold this column";
};

/** How long an item on a reel has left, in the reel's short note. */
const keepsFor = (left: number): string => {
  if (left > 30) {
    return "stocked";
  }

  if (left < 0) {
    return "overdue";
  }

  if (left === 0) {
    return "today";
  }

  return left === 1 ? "1 day" : `${left} days`;
};

/** When an item running out should be used, in the "use these first" list. */
const eatBy = (left: number): string => {
  if (left <= 0) {
    return "today";
  }

  return left === 1 ? "tomorrow" : `${left} days`;
};

export const Draw = ({ state, dispatch, onSpin }: DrawProps) => {
  const v = state.vocab;

  const reels = useMemo(
    () => reelsFrom(state.pantry, state.catalogue, v),
    [state.pantry, state.catalogue, v]
  );

  const ready = canSpin(reels, v);
  const settled = state.picked !== null && !state.spinning;

  // SAFETY: picked is a Triple, or three nulls before the first draw, so its
  // map has one entry per reel too.
  const picks = (state.picked ?? [null, null, null]).map((name) =>
    name ? ingredientOf(state.catalogue, name) : undefined
  ) as Triple<Ingredient | undefined>;

  const methods = state.methods ?? [null, null, null];
  const style = styleOf(picks[2], v);
  const lead = methodOf(v, methods[0]);

  const yesterday = yesterdaysMeal(state);

  const expiring = state.pantry
    .filter((p) => daysLeft(p) <= 3)
    .toSorted((a, b) => daysLeft(a) - daysLeft(b));

  const missing = emptyReels(reels, v).map((c) =>
    labelOfCategory(v, c).toLowerCase()
  );

  const hint = hintFor(ready, state.spinning, settled, missing);

  return (
    <div className="draw">
      <section className="draw__left" aria-label="Reels">
        <div className="day-head">
          <div className="day-head__day">{todayWeekday()}</div>
          <h2 className="day-head__title">what the pantry holds</h2>
          <div className="day-head__rule" />
        </div>

        <div className="reels">
          <div className="payline" />
          {reels.map((list, k) => {
            const label = v.categories[k]?.label ?? "";
            const locked = state.locks[k];
            const empty = list.length === 0;

            return (
              <button
                type="button"
                key={v.categories[k]?.code ?? k}
                className="reel"
                disabled={empty}
                aria-pressed={locked}
                aria-label={empty ? `${label} reel, empty` : `${label} reel`}
                title={reelTitle(empty, locked)}
                onClick={() => dispatch({ reel: k, type: "reel/toggleLock" })}
              >
                <div className="reel__fade" />
                {empty ? (
                  <div className="cell reel__empty">
                    <div className="cell__name">nothing stocked</div>
                    <div className="note tone-buy">
                      add {label.toLowerCase()}
                    </div>
                  </div>
                ) : (
                  <div
                    className="reel__strip"
                    style={{
                      transform: `translateY(${-state.idx[k] * CELL_H}px)`,
                      transitionDuration: state.dur[k],
                    }}
                  >
                    {Array.from({ length: STRIP_REPEATS }, (_, r) =>
                      list.map((item, i) => {
                        const left = daysLeft(item);

                        return (
                          <div key={`${r}:${i}`} className="cell">
                            <div className="cell__name">{item.name}</div>
                            <div
                              className={`note tone-${left <= 3 ? "soon" : "fresh"}`}
                            >
                              {keepsFor(left)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
                <div className="reel__foot">{locked ? "held" : label}</div>
              </button>
            );
          })}
        </div>

        <div className="draw__cta">
          <button
            type="button"
            className={`btn draw__btn${ready ? "" : " btn--muted"}`}
            onClick={onSpin}
            aria-disabled={!ready}
            disabled={state.spinning || !ready}
          >
            Draw three
          </button>
          <div className="hint" aria-live="polite">
            <span>{hint}</span>
            {ready && !state.spinning && !settled && (
              <kbd className="kbd">SPACE</kbd>
            )}
          </div>
        </div>
      </section>

      <section
        className="stack"
        style={{ gap: 18 }}
        aria-label="Tonight's dish"
      >
        <div className="recipe">
          <span className="legend" aria-hidden="true">
            dinner.txt
          </span>
          {settled ? (
            <>
              <div className="recipe__art">
                <div className="recipe__disc">
                  <Icon
                    d={dishIcon(style?.code)}
                    size={64}
                    style={{ color: "var(--ink)" }}
                  />
                </div>
                <div className="recipe__kind">{style?.label}</div>
              </div>
              <div className="recipe__body">
                <div className="kicker">This evening</div>
                <h3 className="recipe__dish">{dishName(picks, methods, v)}</h3>
                <div className="chip-row">
                  {lead && (
                    <span className="tag tone-green">
                      Method · {lead.label}
                    </span>
                  )}
                  {picks.map((ingredient, k) => {
                    if (!ingredient) {
                      return null;
                    }

                    const stocked = state.pantry.find(
                      (p) => p.name === ingredient.name
                    );

                    const soon =
                      stocked !== undefined && daysLeft(stocked) <= 3;

                    // The protein's method is the lead tag; the others ride on their own tag.
                    const how =
                      k > 0
                        ? methodOf(v, methods[k])?.phrase.toLowerCase()
                        : undefined;

                    return (
                      <span
                        key={ingredient.name}
                        className={`tag tone-${soon ? "soon" : "fresh"}`}
                      >
                        {ingredient.name}
                        {how ? ` · ${how}` : ""}
                        {soon ? " · use it up" : ""}
                      </span>
                    );
                  })}
                </div>
                <div className="recipe__actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => dispatch({ type: "dish/cook" })}
                  >
                    Into the pot
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={onSpin}
                  >
                    Again
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="recipe__empty">
              <div className="loader" aria-hidden="true">
                {COOK_ICONS.map((d, i) => (
                  <Icon
                    key={i}
                    d={d}
                    size={52}
                    style={{
                      animationDelay: `${(i * 0.75).toFixed(2)}s`,
                      color: "var(--ink)",
                    }}
                  />
                ))}
              </div>
              <div className="recipe__question">
                what will we be cooking tonight?
              </div>
              <div className="progress" />
            </div>
          )}
        </div>

        {yesterday && (
          <div className="yesterday">
            <Icon
              className="yesterday__icon"
              d={dishIcon(yesterday.style)}
              size={36}
            />
            <div>
              <div className="kicker">Yesterday you ate</div>
              <div className="yesterday__dish">{yesterday.dish}</div>
            </div>
          </div>
        )}

        {state.flash && <output className="flash">{state.flash}</output>}

        {expiring.length > 0 && (
          <div className="soon-list">
            <div className="kicker">Use these first</div>
            <div className="chip-row">
              {expiring.map((p) => {
                const left = daysLeft(p);

                return (
                  <span key={p.name} className="soon-chip">
                    {p.name} · {eatBy(left)}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
