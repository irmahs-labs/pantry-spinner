import { defaultServing, servingUnitOf } from "../data/vocab";
import type { Vocab } from "../data/vocab";

interface Props {
  vocab: Vocab;
  unit: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * How much one serving is, for a unit measured by weight or volume. A unit that
 * is its own serving (a piece, a can) has nothing to ask, so this renders
 * nothing — which units ask is the units table's `default_serving`, not code.
 */
export function ServingField({ vocab, unit, value, onChange }: Props) {
  const fallback = defaultServing(vocab, unit);
  if (fallback === null) {
    return null;
  }
  // Sized in the small unit: a serving of rice stocked in kilograms is in grams.
  const small = servingUnitOf(vocab, unit);
  return (
    <label className="serving-field">
      <span className="serving-field__label">Serving</span>
      <input
        aria-label={`One serving, in ${small}`}
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        placeholder={String(fallback)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="serving-field__unit">{small}</span>
    </label>
  );
}
