import { useState } from "react";

import type { LoadFailure } from "../data/vocab";
import { sendMagicLink } from "../lib/supabase/auth";
import { isConfigured } from "../lib/supabase/client";

interface Status {
  tone: "idle" | "error";
  message: string;
}

interface Props {
  onGuest: () => void | Promise<void>;
  /** The reference tables could not be read, so there is no app to open. */
  failure?: LoadFailure;
}

const FAILURE_TEXT: Record<LoadFailure, string> = {
  missing:
    "The database answered, but its tables aren’t there yet — the migrations haven’t been applied to this Supabase project. Every word the app uses lives in those tables.",
  refused:
    "The database turned this copy away. Check that its Supabase URL and anon key belong to the same project.",
  unreachable:
    "The database didn’t answer, and every word the app uses lives there. Check your connection and reload.",
};

export default function SignIn({ onGuest, failure }: Props) {
  const [opening, setOpening] = useState(false);
  const connected = isConfigured && !failure;
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<Status>({ message: "", tone: "idle" });

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) {
      return;
    }

    setSending(true);
    const { error } = await sendMagicLink(address);
    setSending(false);
    setStatus(
      error
        ? { message: error, tone: "error" }
        : {
            message: `Link sent to ${address}. Open it on this device.`,
            tone: "idle",
          }
    );
  }

  return (
    <div className="signin">
      <h1 className="signin-brand">Slot machine meal planner</h1>
      <p className="signin-blurb">
        {isConfigured
          ? failure
            ? FAILURE_TEXT[failure]
            : "Your pantry and your list live under your email address. Enter it and we’ll send a sign-in link — no password to remember."
          : "This copy isn’t connected to its database. Everything the app says — every reel, kind and cooking method — is read from there, so there is nothing to open without it."}
      </p>
      <form className="signin-form" onSubmit={send}>
        <input
          className="signin-input"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-label="Email address"
          disabled={!connected}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          className="signin-send"
          disabled={sending || !connected}
        >
          {sending ? "Sending…" : "Send link"}
        </button>
      </form>
      <p className="signin-status" data-tone={status.tone} aria-live="polite">
        {status.message}
      </p>

      <div className="signin-or">
        <button
          type="button"
          className="signin-guest"
          disabled={!connected || opening}
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
}
