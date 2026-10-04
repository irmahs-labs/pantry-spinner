import * as z from "zod/mini";

/**
 * The app's own API, on the same origin: /api is served beside the app in
 * production and forwarded by Vite in development. Same-origin requests carry
 * the session cookie on their own.
 */

/** An answer that was not 2xx, with the API's short reason when it gave one. */
export class ApiError extends Error {
  override name = "ApiError";
  readonly status: number;
  readonly reason: string;

  constructor(status: number, reason: string) {
    super(`The API answered ${status}: ${reason}`);
    this.status = status;
    this.reason = reason;
  }
}

/** Every error the API sends has this shape; anything else is the network's. */
const errorBody = z.object({ error: z.string() });

const reasonOf = async (response: Response): Promise<string> => {
  const parsed = errorBody.safeParse(await response.json().catch(() => null));
  return parsed.success ? parsed.data.error : response.statusText;
};

export const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new ApiError(response.status, await reasonOf(response));
  }
  // SAFETY: each caller names the shape its own endpoint answers with.
  return (await response.json()) as T;
};

export const putJson = async <T>(path: string, body: T): Promise<void> => {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
  if (!response.ok) {
    throw new ApiError(response.status, await reasonOf(response));
  }
};
