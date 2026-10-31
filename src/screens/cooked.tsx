import { dishIcon } from "../components/glyphs";
import { Icon } from "../components/icon";
import { dayLabel } from "../lib/dates";
import { useCopy, useLanguage } from "../lib/language";
import type { PlannerState } from "../state/planner";

const COPY = {
  en: {
    drawn: "dishes drawn this week",
    nothing: "Nothing cooked yet. Draw three and send one into the pot.",
    unique: "without a single repeat",
  },
  fr: {
    drawn: "plats tirés cette semaine",
    nothing:
      "Rien de cuisiné pour l’instant. Tirez trois et envoyez-en un à la casserole.",
    unique: "sans une seule répétition",
  },
};

export const Cooked = ({ state }: { state: PlannerState }) => {
  const language = useLanguage();
  const t = useCopy(COPY);

  return (
    <div className="cooked">
      <div className="stack" style={{ gap: 12 }}>
        <div className="stat">
          <div className="stat__num">{state.plan.length}</div>
          <div className="stat__cap">{t.drawn}</div>
        </div>
        <div className="stat stat--fresh">
          <div className="stat__num">
            {new Set(state.plan.map((p) => p.dish)).size}
          </div>
          <div className="stat__cap">{t.unique}</div>
        </div>
      </div>
      <ol className="history">
        {state.plan.length === 0 && <p className="intro">{t.nothing}</p>}
        {state.plan.map((e, i) => (
          <li key={e.id} className={`hrow${i === 0 ? " hrow--latest" : ""}`}>
            <div className="hrow__icon">
              <Icon d={dishIcon(e.style)} size={30} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hrow__dish">{e.dish}</div>
              <div className="body-sm hrow__sub">{e.note}</div>
            </div>
            <div className="hrow__day">{dayLabel(e.cookedOn, language)}</div>
          </li>
        ))}
      </ol>
    </div>
  );
};
