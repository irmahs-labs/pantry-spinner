import { env } from "./env";

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

const isAccount = (value: unknown): value is Account =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  typeof value.id === "string" &&
  "email" in value &&
  typeof value.email === "string";

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
  const body: unknown = await response.json();
  const user =
    typeof body === "object" && body !== null && "user" in body
      ? body.user
      : null;
  return {
    account: isAccount(user)
      ? {
          email: user.email,
          id: user.id,
          image: typeof user.image === "string" ? user.image : null,
          name: typeof user.name === "string" ? user.name : "",
        }
      : null,
    setCookies: response.headers.getSetCookie(),
  };
};
