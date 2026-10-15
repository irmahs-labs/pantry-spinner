import type { MouseEvent, ReactNode } from "react";

import { APP_NAME } from "../lib/brand";
import { PantryIcon } from "./app-icon";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  /** Opens the app's home screen; without it the brand reloads the page. */
  onHome?: () => void;
  /** Anything to show before the theme toggle. */
  children?: ReactNode;
}

/**
 * Cute Matcha's app Header: the icon, the app's name with "by Irma HS"
 * under it, and the theme toggle at the end.
 */
export const Header = ({ onHome, children }: HeaderProps) => {
  const goHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onHome) {
      event.preventDefault();
      onHome();
    }
  };

  return (
    <header className="app-header">
      <a href="/" className="app-header__home" onClick={goHome}>
        <PantryIcon />
        <span>
          <span className="app-header__name">{APP_NAME}</span>
          <span className="app-header__by">by Irma HS</span>
        </span>
      </a>
      <div className="app-header__end">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
};
