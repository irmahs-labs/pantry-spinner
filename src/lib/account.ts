import { getJson } from "./api";

/**
 * Signing in happens at the IrmaHS Labs account service, shared by every
 * irmahs.dev app: this app sends people there and they come back signed in.
 * Who that is, the app asks its own API, which asks the account service.
 */
export const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "https://auth.irmahs.dev";

export interface Account {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export const currentAccount = async (): Promise<Account | null> =>
  (await getJson<{ account: Account | null }>("/api/me")).account;

/** The sign-in page, set to bring the visitor back to this page. */
export const signInUrl = (): string =>
  `${AUTH_URL}/sign-in?redirect=${encodeURIComponent(window.location.href)}`;

/**
 * Signs out of every irmahs.dev app at once: there is one session for all of
 * them. Then reloads, so nothing of the account stays on screen.
 */
export const signOut = async (): Promise<void> => {
  await fetch(`${AUTH_URL}/api/auth/sign-out`, {
    body: "{}",
    credentials: "include",
    headers: { "content-type": "application/json" },
    method: "POST",
  }).catch(() => null);
  window.location.reload();
};
