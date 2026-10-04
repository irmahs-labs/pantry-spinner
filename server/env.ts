// Every setting the API reads, checked once at startup so a missing value
// stops the deploy instead of the first request.

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set; see .env.example`);
  }
  return value;
};

export const env = {
  // Where the browser loads the app from. Writes from any other origin are
  // refused, so another *.irmahs.dev site cannot save into your pantry.
  appOrigin: new URL(required("APP_URL")).origin,
  // The account service, as this server reaches it: http://auth:3001 on the
  // server's shared network, http://localhost:3001 locally.
  authUrl: required("AUTH_INTERNAL_URL"),
  databaseUrl: required("DATABASE_URL"),
  port: Number(process.env.PORT ?? 3002),
  // The built app, served beside the API in production. Unset in development,
  // where Vite serves it and forwards /api here.
  staticDir: process.env.STATIC_DIR || undefined,
};
