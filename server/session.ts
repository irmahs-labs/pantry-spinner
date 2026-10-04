import { z } from "zod";

import { env } from "./env";

/** What the account service says about a session, as far as this app reads it. */
const sessionAnswer = z
  .object({
    user: z.object({
      email: z.string(),
      id: z.uuid(),
      image: z.string().nullish(),
      name: z.string().optional(),
    }),
  })
  .nullable();

export interface Account {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface SessionAnswer {
  account: Account | null;
  // Better Auth may extend the session as it answers; these carry the renewed
  // cookie back to the browser so it does not expire before the session does.
  setCookies: string[];
}

/**
 * Who sent this request, asked of the IrmaHS Labs account service with the
 * browser's own cookie. The answer is the only place an account id comes
 * from: nothing the browser sends in a body or a URL is taken as one.
 */
export const whoIs = async (
  cookie: string | undefined
): Promise<SessionAnswer> => {
  if (!cookie) {
    return { account: null, setCookies: [] };
  }
  const response = await fetch(`${env.authUrl}/api/auth/get-session`, {
    headers: { cookie },
  });
  if (!response.ok) {
    throw new Error(`The account service answered ${response.status}`);
  }
  // Anything that is not a session we recognise is treated as no session.
  const parsed = sessionAnswer.safeParse(await response.json());
  const user = parsed.success ? parsed.data?.user : undefined;
  return {
    account: user
      ? {
          email: user.email,
          id: user.id,
          image: user.image ?? null,
          name: user.name ?? "",
        }
      : null,
    setCookies: response.headers.getSetCookie(),
  };
};
