import { APP_NAME } from "../lib/brand";
import { useCopy } from "../lib/language";
import { PantryIcon } from "./app-icon";

const COPY = {
  en: { by: "by Irma HS" },
  fr: { by: "par Irma HS" },
};

/** The page's last line, as every irmahs.dev app ends: the icon, then who made it */
export const Footer = () => {
  const t = useCopy(COPY);

  return (
    <footer className="footer">
      <PantryIcon size={20} /> {APP_NAME} {t.by}
    </footer>
  );
};
