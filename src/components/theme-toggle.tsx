import { chooseTheme, useTheme } from "../lib/theme";
import { Icon } from "./icon";

const SUN =
  "M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8z|M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4";
const MOON = "M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z";

/** The header's sun/moon pill: names and shows the theme it switches to. */
export const ThemeToggle = () => {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="header-pill"
      aria-label={`Switch to ${next} mode`}
      onClick={() => chooseTheme(next)}
    >
      <Icon d={next === "dark" ? MOON : SUN} size={16} />
      {next}
    </button>
  );
};
