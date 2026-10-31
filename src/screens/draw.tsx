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
import { useCopy, useLanguage } from "../lib/language";
import { yesterdaysMeal } from "../state/planner";
import type { Action, PlannerState } from "../state/planner";

interface DrawProps {
  state: PlannerState;
  dispatch: Dispatch<Action>;
  onSpin: () => void;
}

const COPY = {
  en: {
    add: (category: string) => `add ${category}`,
    again: "Again",
    and: "and",
    days: (n: number) => (n === 1 ? "1 day" : `${n} days`),
    dish: "Tonight's dish",
    draw: "Draw three",
    empty: (category: string) => `${category} reel, empty`,
    held: "held",
    hold: "Hold this column",
    holdHint: "Click a column to hold it, then draw again.",
    intoPot: "Into the pot",
    method: (label: string) => `Method · ${label}`,
    nothing: "nothing stocked",
    nothingStocked: "Nothing stocked",
    orPress: "— or press",
    overdue: "overdue",
    question: "what will we be cooking tonight?",
    reel: (category: string) => `${category} reel`,
    reels: "Reels",
    release: "Release this column",
    stock: (missing: string) => `Stock ${missing} to draw.`,
    stocked: "stocked",
    thisEvening: "This evening",
    today: "today",
    tomorrow: "tomorrow",
    turning: "Turning over…",
    useFirst: "Use these first",
    useItUp: " · use it up",
    whatHolds: "what the pantry holds",
    yesterday: "Yesterday you ate",
  },
  fr: {
    add: (category: string) => `ajouter ${category}`,
    again: "Encore",
    and: "et",
    days: (n: number) => (n === 1 ? "1 jour" : `${n} jours`),
    dish: "Le plat du soir",
    draw: "Tirer trois",
    empty: (category: string) => `Rouleau ${category}, vide`,
    held: "bloqué",
    hold: "Bloquer cette colonne",
    holdHint: "Cliquez une colonne pour la bloquer, puis tirez à nouveau.",
    intoPot: "À la casserole",
    method: (label: string) => `Cuisson · ${label}`,
    nothing: "rien en stock",
    nothingStocked: "Rien en stock",
    orPress: "— ou appuyez sur",
    overdue: "périmé",
    question: "qu’allons-nous cuisiner ce soir ?",
    reel: (category: string) => `Rouleau ${category}`,
    reels: "Rouleaux",
    release: "Débloquer cette colonne",
    stock: (missing: string) => `Stockez ${missing} pour tirer.`,
    stocked: "en stock",
    thisEvening: "Ce soir",
    today: "aujourd’hui",
    tomorrow: "demain",
    turning: "Ça tourne…",
    useFirst: "À utiliser en premier",
    useItUp: " · à finir",
    whatHolds: "ce que contient le garde-manger",
    yesterday: "Hier, vous avez mangé",
  },
};

type Copy = (typeof COPY)["en"];

const listOf = (words: string[], t: Copy) =>
  words.length === 1
    ? words[0]
    : `${words.slice(0, -1).join(", ")} ${t.and} ${words.at(-1)}`;

/** The line under the draw button: what is missing, what is happening, or what to do next. */
const hintFor = (
  ready: boolean,
  spinning: boolean,
  settled: boolean,
  missing: string[],
  t: Copy
): string => {
  if (!ready) {
    return t.stock(listOf(missing, t) ?? "");
  }

  if (spinning) {
    return t.turning;
  }

  if (settled) {
    return t.holdHint;
  }

  return t.draw;
};

const reelTitle = (empty: boolean, locked: boolean, t: Copy): string => {
  if (empty) {
    return t.nothingStocked;
  }

  return locked ? t.release : t.hold;
};

/** How long an item on a reel has left, in the reel's short note. */
const keepsFor = (left: number, t: Copy): string => {
  if (left > 30) {
    return t.stocked;
  }

  if (left < 0) {
    return t.overdue;
  }

  if (left === 0) {
    return t.today;
  }

  return t.days(left);
};

/** When an item running out should be used, in the "use these first" list. */
const eatBy = (left: number, t: Copy): string => {
  if (left <= 0) {
    return t.today;
  }

  return left === 1 ? t.tomorrow : t.days(left);
};

export const Draw = ({ state, dispatch, onSpin }: DrawProps) => {
  const v = state.vocab;
  const language = useLanguage();
  const t = useCopy(COPY);

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

  const hint = hintFor(ready, state.spinning, settled, missing, t);

  return (
    <div className="draw">
      <section className="draw__left" aria-label={t.reels}>
        <div className="day-head">
          <div className="day-head__day">{todayWeekday(language)}</div>
          <h2 className="day-head__title">{t.whatHolds}</h2>
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
                aria-label={empty ? t.empty(label) : t.reel(label)}
                title={reelTitle(empty, locked, t)}
                onClick={() => dispatch({ reel: k, type: "reel/toggleLock" })}
              >
                <div className="reel__fade" />
                {empty ? (
                  <div className="cell reel__empty">
                    <div className="cell__name">{t.nothing}</div>
                    <div className="note tone-buy">
                      {t.add(label.toLowerCase())}
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
                              {keepsFor(left, t)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
                <div className="reel__foot">{locked ? t.held : label}</div>
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
            {t.draw}
          </button>
          <div className="hint" aria-live="polite">
            <span>{hint}</span>
            {ready && !state.spinning && !settled && (
              <span className="hint__key">
                {t.orPress} <kbd className="kbd">SPACE</kbd>
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="stack" style={{ gap: 18 }} aria-label={t.dish}>
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
                <div className="kicker">{t.thisEvening}</div>
                <h3 className="recipe__dish">{dishName(picks, methods, v)}</h3>
                <div className="chip-row">
                  {lead && (
                    <span className="tag tone-green">
                      {t.method(lead.label)}
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
                        {soon ? t.useItUp : ""}
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
                    {t.intoPot}
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={onSpin}
                  >
                    {t.again}
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
              <div className="recipe__question">{t.question}</div>
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
              <div className="kicker">{t.yesterday}</div>
              <div className="yesterday__dish">{yesterday.dish}</div>
            </div>
          </div>
        )}

        {state.flash && <output className="flash">{state.flash}</output>}

        {expiring.length > 0 && (
          <div className="soon-list">
            <div className="kicker">{t.useFirst}</div>
            <div className="chip-row">
              {expiring.map((p) => {
                const left = daysLeft(p);

                return (
                  <span key={p.name} className="soon-chip">
                    {p.name} · {eatBy(left, t)}
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
