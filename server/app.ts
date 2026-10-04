import { Hono } from "hono";
import type { Context } from "hono";

import { inTransaction } from "./db";
import { env } from "./env";
import { loadVocab, readDemo, readVocab } from "./reference";
import { whoIs } from "./session";
import type { Account } from "./session";
import { loadSnapshot, saveSnapshot, UnknownCode } from "./snapshot";
import { parseSnapshot } from "./validate";

/**
 * The API the app talks to, under /api. The shared tables are open to anyone;
 * an account's own rows only to that account, named by the session cookie
 * and never by anything else in the request.
 */
export const api = new Hono().basePath("/api");

// Answers carry account data or change with every write; nothing here is
// worth a cache between the browser and the database.
api.use("*", async (c, next) => {
  await next();
  c.header("cache-control", "no-store");
});

// Writes only from the app's own pages. Browsers send Origin on every
// cross-origin request and on same-origin writes, so a page on another
// irmahs.dev subdomain, which the shared cookie would otherwise vouch for,
// cannot save into your pantry.
api.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.header("origin") !== env.appOrigin) {
    return c.json({ error: "Writes are only accepted from the app itself." }, 403);
  }
  await next();
});

/** The signed-in account, or a 401 answer to return instead. */
const requireAccount = async (
  c: Context
): Promise<{ account: Account } | { denied: Response }> => {
  const { account } = await whoIs(c.req.header("cookie"));
  return account
    ? { account }
    : { denied: c.json({ error: "Sign in to see your own pantry." }, 401) };
};

api.get("/vocab", async (c) => c.json(await readVocab()));
api.get("/demo", async (c) => c.json(await readDemo()));

api.get("/me", async (c) => {
  const { account, setCookies } = await whoIs(c.req.header("cookie"));
  for (const cookie of setCookies) {
    c.header("set-cookie", cookie, { append: true });
  }
  return c.json({ account });
});

api.get("/snapshot", async (c) => {
  const who = await requireAccount(c);
  if ("denied" in who) {
    return who.denied;
  }
  const snapshot = await inTransaction(async (db) =>
    loadSnapshot(db, who.account.id, await loadVocab(db))
  );
  return c.json(snapshot);
});

api.put("/snapshot", async (c) => {
  const who = await requireAccount(c);
  if ("denied" in who) {
    return who.denied;
  }
  const parsed = parseSnapshot(await c.req.json().catch(() => null));
  if (!parsed.ok) {
    return c.json({ error: "That is not a pantry.", issues: parsed.issues }, 400);
  }
  try {
    await inTransaction(async (db) =>
      saveSnapshot(db, who.account.id, parsed.snapshot, await loadVocab(db))
    );
  } catch (error) {
    if (error instanceof UnknownCode) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
  return c.body(null, 204);
});

api.onError((error, c) => {
  console.error(`${c.req.method} ${c.req.path} failed`, error);
  // Postgres says 42P01 when a table is missing: the migrations have not run.
  const missing =
    typeof error === "object" && error !== null && "code" in error && error.code === "42P01";
  return c.json(
    { error: missing ? "missing" : "unreachable" },
    missing ? 503 : 500
  );
});
