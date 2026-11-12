import { useCopy } from "../lib/language";

const COPY = {
  en: { more: "more apps at" },
  fr: { more: "plus d’apps sur" },
};

/**
 * Cute Matcha's Footer, as every irmahs.dev app ends: the Header already
 * names the app and says "by Irma HS", so this says where to find more
 */
export const Footer = () => {
  const t = useCopy(COPY);

  return (
    <footer className="footer">
      {t.more} <a href="https://irmahs.dev">irmahs.dev</a>
    </footer>
  );
};
