import { APP_NAME } from "../lib/brand";
import { PantryIcon } from "./app-icon";

/** The page's last line, as every irmahs.dev app ends: the icon, then who made it */
export const Footer = () => (
  <footer className="footer">
    <PantryIcon size={20} /> {APP_NAME} by Irma HS
  </footer>
);
