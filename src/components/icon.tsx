interface Props {
  d: string;
  size: number;
  className?: string;
  style?: React.CSSProperties;
}

/** A 24px Lucide-style glyph at stroke-width 2.75. `d` holds one or more paths separated by "|". */
export const Icon = ({ d, size, className, style }: Props) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    style={style}
  >
    {d.split("|").map((p, i) => (
      <path key={i} d={p} />
    ))}
  </svg>
);
