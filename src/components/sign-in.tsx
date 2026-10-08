import { useState } from "react";

import type { LoadFailure } from "../data/vocab";
import { signInUrl } from "../lib/account";

interface Props {
  onGuest: () => void | Promise<void>;
  /** The reference tables could not be read, so there is no app to open. */
  failure?: LoadFailure;
}

const FAILURE_TEXT: Record<LoadFailure, string> = {
  missing:
    "The database answered, but its tables aren’t there yet — the migrations haven’t been applied. Every word the app uses lives in those tables.",
  unreachable:
    "The app’s server didn’t answer, and every word the app uses comes from its database. Check your connection and reload.",
};

const GoogleMark = () => (
  <svg aria-hidden="true" height="18" viewBox="0 0 48 48" width="18">
    <path
      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"
      fill="#FFC107"
    />
    <path
      d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      fill="#FF3D00"
    />
    <path
      d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      fill="#4CAF50"
    />
    <path
      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      fill="#1976D2"
    />
  </svg>
);

/**
 * The way in. Signing in happens on the IrmaHS Labs account page, which every
 * irmahs.dev app shares, and comes back here signed in; looking around needs
 * no account at all.
 */
const SignIn = ({ onGuest, failure }: Props) => {
  const [opening, setOpening] = useState(false);

  return (
    <div className="signin">
      <h1 className="signin-brand">What’s in my pantry?</h1>
      <p className="signin-blurb">
        {failure
          ? FAILURE_TEXT[failure]
          : "Your pantry and your list live under your IrmaHS Labs account — the same one for every irmahs.dev app. Sign in with Google; there’s no password to remember."}
      </p>
      {failure ? null : (
        <a className="signin-google" href={signInUrl()}>
          <GoogleMark />
          Continue with Google
        </a>
      )}

      <div className="signin-or">
        <button
          type="button"
          className="signin-guest"
          disabled={Boolean(failure) || opening}
          onClick={async () => {
            setOpening(true);
            await onGuest();
            setOpening(false);
          }}
        >
          {opening ? "Opening…" : "Have a look around"}
        </button>
        <p className="signin-guestNote">
          No account. A demo pantry to play with, and nothing is kept — close
          the tab and it’s gone.
        </p>
      </div>
    </div>
  );
};

export default SignIn;
