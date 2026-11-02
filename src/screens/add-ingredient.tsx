import type { Dispatch } from "react";

import { categoryIcon } from "../components/glyphs";
import { Icon } from "../components/icon";
import { ServingField } from "../components/serving-field";
import { Switch } from "../components/switch";
import { kindsFor, labelOfCategory } from "../data/vocab";
import type { CategoryCode, Method } from "../data/vocab";
import { addDaysISO, daysUntil, todayISO } from "../lib/dates";
import { LOCALES, useCopy, useLanguage } from "../lib/language";
import { kindOfDraft, methodsOn } from "../state/planner";
import type { Action, AddDraft, PlannerState } from "../state/planner";

interface Props {
  state: PlannerState;
  dispatch: Dispatch<Action>;
}

const COPY = {
  en: {
    addTo: (reel: string) => `Add to the ${reel} reel`,
    calls: (method: string, name: string) =>
      `A draw can call it “${method} ${name}”.`,
    clearAll: "Clear all",
    eg: "e.g. Halloumi",
    everyOff: "Every method is switched off in Cooking methods.",
    fromNow: (n: number) => `${n} ${n === 1 ? "day" : "days"} from now`,
    glutenFree: "Gluten-free",
    haveNo: "Goes on the shopping list. Only what is in the pantry ever spins.",
    haveYes: "Goes into the pantry, starts counting down, and can be drawn.",
    howCooked: "How can it be cooked?",
    howMuch: "How much",
    inPantry: "It’s in my pantry now",
    ingredient: "Ingredient",
    nothingProtein:
      "Nothing ticked: its dishes will be named without a method.",
    nothingStarch: "Nothing ticked: fine for most starches.",
    nothingVegetable:
      "Nothing ticked: its dishes use the word its kind comes with.",
    optional: "optional",
    presets: ["3 days", "1 week", "2 weeks", "1 month"],
    serves: (method: string, name: string) =>
      `A draw can serve it “with ${method} ${name}”.`,
    shortHelp:
      "What a dish name calls it. “Chicken Thighs” cooks as “Chicken”. Leave it empty to use the full name.",
    shortName: "Short name",
    tickAll: "Tick all",
    ticked: (n: number) => `${n} ticked.`,
    today: "Use it today.",
    unit: "Unit",
    useBy: "Use by",
    whatKind: "What kind",
    whatType: "What type",
    whichReel: "Which reel?",
  },
  fr: {
    addTo: (reel: string) => `Ajouter au rouleau ${reel}`,
    calls: (method: string, name: string) =>
      `Un tirage peut l’appeler « ${name} ${method} ».`,
    clearAll: "Tout décocher",
    eg: "ex. Halloumi",
    everyOff: "Tous les modes sont désactivés dans Modes de cuisson.",
    fromNow: (n: number) => `dans ${n} ${n > 1 ? "jours" : "jour"}`,
    glutenFree: "Sans gluten",
    haveNo:
      "Va sur la liste de courses. Seul ce qui est dans le garde-manger tourne.",
    haveYes:
      "Va dans le garde-manger, commence le compte à rebours, et peut être tiré.",
    howCooked: "Comment peut-on le cuisiner ?",
    howMuch: "Combien",
    inPantry: "Je l’ai dans mon garde-manger",
    ingredient: "Ingrédient",
    nothingProtein:
      "Rien de coché : ses plats seront nommés sans mode de cuisson.",
    nothingStarch: "Rien de coché : très bien pour la plupart des féculents.",
    nothingVegetable: "Rien de coché : ses plats prennent le mot de son type.",
    optional: "facultatif",
    presets: ["3 jours", "1 semaine", "2 semaines", "1 mois"],
    serves: (method: string, name: string) =>
      `Un tirage peut le servir « avec ${name} ${method} ».`,
    shortHelp:
      "Le nom qu’un plat lui donne. « Hauts de cuisse de poulet » se cuisine en « Poulet ». Laissez vide pour garder le nom complet.",
    shortName: "Nom court",
    tickAll: "Tout cocher",
    ticked: (n: number) => `${n} ${n > 1 ? "cochés" : "coché"}.`,
    today: "À utiliser aujourd’hui.",
    unit: "Unité",
    useBy: "À utiliser avant",
    whatKind: "Quel genre",
    whatType: "Quel type",
    whichReel: "Quel rouleau ?",
  },
};

type Copy = (typeof COPY)["en"];

/** Shortcuts for the use-by date, in days; the chips read from COPY's presets. */
const DATE_PRESETS = [3, 7, 14, 30] as const;

/** The draft field that holds the kind, for the reel being described. */
const kindPatch = (category: CategoryCode, code: string): Partial<AddDraft> => {
  if (category === "protein") {
    return { proteinKind: code };
  }

  if (category === "vegetable") {
    return { vegetableKind: code };
  }

  return { starchKind: code };
};

/** What the ticks under "How can it be cooked?" will do to a dish's name. */
const methodsNote = (d: AddDraft, ticked: Method[], t: Copy): string => {
  const [first] = ticked;
  const name = d.shortName.trim() || d.name.trim() || "…";

  if (d.category === "protein" && first) {
    return t.calls(first.phrase, name);
  }

  if (d.category === "vegetable" && first) {
    return t.serves(first.phrase.toLowerCase(), name.toLowerCase());
  }

  if (ticked.length) {
    return t.ticked(ticked.length);
  }

  if (d.category === "protein") {
    return t.nothingProtein;
  }

  if (d.category === "vegetable") {
    return t.nothingVegetable;
  }

  return t.nothingStarch;
};

/**
 * Describing a new ingredient: its name, which reel it spins on, what kind it is,
 * and the ways it can be cooked. The kind and the ticks are what dish names and
 * diet filters read, which is why they are asked for once here, not guessed later.
 */
export const AddIngredient = ({ state, dispatch }: Props) => {
  const v = state.vocab;
  const d = state.draft;
  const language = useLanguage();
  const t = useCopy(COPY);

  const patch = (p: Partial<AddDraft>) =>
    dispatch({ patch: p, type: "draft/patch" });

  const kinds = kindsFor(v, d.category);
  const current = kindOfDraft(d);
  const hint = kinds.find((k) => k.code === current)?.examples;

  const pickKind = (code: string) => patch(kindPatch(d.category, code));

  // A method switched off in Cooking methods is not offered here at all.
  const shown = methodsOn(state);
  const ticked = shown.filter((m) => d.methods.includes(m.code));
  const allTicked = shown.length > 0 && ticked.length === shown.length;
  const example = methodsNote(d, ticked, t);

  const dateSub =
    d.days === 0
      ? t.today
      : `${new Date(`${addDaysISO(d.days)}T12:00:00`).toLocaleDateString(
          LOCALES[language],
          {
            day: "numeric",
            month: "long",
            weekday: "long",
          }
        )} · ${t.fromNow(d.days)}`;

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
          {t.ingredient}
        </label>
        <input
          id="ing-name"
          className="text-input text-input--name"
          value={d.name}
          placeholder={t.eg}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="ing-short" className="kicker">
          {t.shortName}
        </label>
        <input
          id="ing-short"
          className="text-input"
          value={d.shortName}
          placeholder={d.name.trim() || t.optional}
          onChange={(e) => patch({ shortName: e.target.value })}
        />
        <div className="body-sm">{t.shortHelp}</div>
      </div>

      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a <fieldset> brings its own border, padding and min-width into the .field layout; role="group" gives assistive tech the same group */}
      <div className="field" role="group" aria-labelledby="which-reel">
        <div id="which-reel" className="kicker">
          {t.whichReel}
        </div>
        <div className="cat-cards">
          {v.categories.map((c) => (
            <button
              key={c.code}
              type="button"
              className="cat-card"
              aria-pressed={d.category === c.code}
              onClick={() => patch({ category: c.code })}
            >
              <Icon d={categoryIcon(c.code)} size={32} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a <fieldset> brings its own border, padding and min-width into the .field layout; role="group" gives assistive tech the same group */}
      <div className="field" role="group" aria-labelledby="kind-label">
        <div id="kind-label" className="kicker">
          {d.category === "protein" ? t.whatKind : t.whatType}
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
            {t.glutenFree}
          </button>
        )}
      </div>

      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a <fieldset> brings its own border, padding and min-width into the .field layout; role="group" gives assistive tech the same group */}
      <div className="field" role="group" aria-labelledby="how-label">
        <div className="field__head">
          <div id="how-label" className="kicker">
            {t.howCooked}
          </div>
          {shown.length > 0 && (
            <button
              type="button"
              className="text-btn"
              onClick={() =>
                dispatch({
                  codes: allTicked ? [] : shown.map((m) => m.code),
                  type: "draft/setMethods",
                })
              }
            >
              {allTicked ? t.clearAll : t.tickAll}
            </button>
          )}
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
        <div className="body-sm">{shown.length ? example : t.everyOff}</div>
      </div>

      <button
        type="button"
        className="check-card"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the whole card (tick, title, sub-line) is the control, and an <input type="checkbox"> cannot hold content
        role="checkbox"
        aria-checked={d.have}
        onClick={() => patch({ have: !d.have })}
      >
        <span className={`tick${d.have ? " tick--on" : ""}`}>
          {d.have ? "✓" : ""}
        </span>
        <span style={{ flex: 1 }}>
          <span className="check-card__title">{t.inPantry}</span>
          <span className="body-sm check-card__sub">
            {d.have ? t.haveYes : t.haveNo}
          </span>
        </span>
      </button>

      {d.have && (
        <>
          <div className="field">
            <label htmlFor="ing-date" className="kicker">
              {t.useBy}
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
              {DATE_PRESETS.map((n, i) => (
                <button
                  key={n}
                  type="button"
                  className="chip"
                  aria-pressed={d.days === n}
                  onClick={() => patch({ days: n })}
                >
                  {t.presets[i]}
                </button>
              ))}
            </div>
            <div className="body-sm">{dateSub}</div>
          </div>

          <div className="field">
            <label htmlFor="ing-qty" className="kicker">
              {t.howMuch}
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
                aria-label={t.unit}
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
            <ServingField
              vocab={v}
              unit={d.unit}
              value={d.serving}
              onChange={(serving) => patch({ serving })}
            />
          </div>
        </>
      )}

      <button
        type="submit"
        className={`btn submit${d.name.trim() ? "" : " btn--muted"}`}
        aria-disabled={!d.name.trim()}
      >
        {t.addTo(labelOfCategory(v, d.category).toLowerCase())}
      </button>
      {state.flash && <output className="flash">{state.flash}</output>}
    </form>
  );
};
