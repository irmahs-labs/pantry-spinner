import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { api } from "./app";
import { env } from "./env";

const app = new Hono();
app.get("/healthz", (c) => c.text("ok"));
app.route("/", api);

// Production: the built app from the same origin as the API, so the session
// cookie and every request stay first-party. Any path that is not a file is
// the app itself, which has no routes of its own.
if (env.staticDir) {
  const root = env.staticDir;
  app.use("/assets/*", (c, next) => {
    // Vite puts a content hash in every asset's name, so a cached copy is never stale.
    c.header("cache-control", "public, max-age=31536000, immutable");
    return next();
  });
  app.use("*", serveStatic({ root }));
  app.get("*", serveStatic({ path: "index.html", root }));
}

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`sleepy-spinner listening on :${info.port}`);
});
