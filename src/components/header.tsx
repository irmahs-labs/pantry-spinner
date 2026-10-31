import type { MouseEvent, ReactNode } from "react";

import type { Account } from "../lib/account";
import { APP_NAME } from "../lib/brand";
import { useCopy } from "../lib/language";
import { AccountButton } from "./account-button";
import { PantryIcon } from "./app-icon";
import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";

const COPY = {
  en: { by: "by Irma HS" },
  fr: { by: "par Irma HS" },
};

interface HeaderProps {
  /** Who is signed in: null for nobody, undefined while still asking. */
  account?: Account | null;
  /** Opens the app's home screen; without it the brand reloads the page. */
  onHome?: () => void;
  /** Anything to show before the theme toggle. */
  children?: ReactNode;
}

/**
 * Cute Matcha's app Header: the icon, the app's name with "by Irma HS"
 * under it, then the language pill, the theme toggle and the account pill
 * at the end.
 */
export const Header = ({ account, onHome, children }: HeaderProps) => {
  const t = useCopy(COPY);

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
          <span className="app-header__by">{t.by}</span>
        </span>
      </a>
      <div className="app-header__end">
        {children}
        <LanguageToggle />
        <ThemeToggle />
        <AccountButton account={account} />
      </div>
    </header>
  );
};
