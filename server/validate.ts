import { z } from "zod";

import type { Snapshot } from "../src/data/snapshot";

/**
 * What a saved snapshot may look like. The browser is not trusted to send
 * clean data, so the shape is checked here before anything reaches a query;
 * codes are then checked against the reference tables as they are written.
 */
const isoDate = z.iso.date();
const name = z.string().trim().min(1).max(200);
const code = z.string().min(1).max(64);
const amount = z.number().finite().nonnegative().max(1_000_000);

const snapshotSchema = z.strictObject({
  catalogue: z
    .array(
      z.strictObject({
        category: z.enum(["protein", "vegetable", "starch"]),
        glutenFree: z.boolean().nullable(),
        kind: code,
        methods: z.array(code).max(50),
        name,
        shortName: name.nullable(),
      })
    )
    .max(2000),
  grocery: z
    .array(
      z.strictObject({
        acquired: z.boolean(),
        name,
        note: z.string().max(500),
        qty: amount,
        unit: code,
      })
    )
    .max(2000),
  methodsOff: z.array(code).max(50),
  pantry: z
    .array(
      z.strictObject({
        expiresOn: isoDate,
        name,
        qty: amount,
        serving: amount.positive(),
        unit: code,
      })
    )
    .max(2000),
  plan: z
    .array(
      z.strictObject({
        cookedOn: isoDate,
        dish: z.string().min(1).max(500),
        id: z.uuid(),
        ingredients: z.array(name).max(50),
        method: code.nullable(),
        note: z.string().max(1000),
        style: z.string().max(64),
      })
    )
    .max(10_000),
});

/** The body as a Snapshot, or the reasons it is not one. */
export const parseSnapshot = (
  body: unknown
): { ok: true; snapshot: Snapshot } | { ok: false; issues: string[] } => {
  const result = snapshotSchema.safeParse(body);
  return result.success
    ? { ok: true, snapshot: result.data }
    : {
        issues: result.error.issues
          .slice(0, 10)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        ok: false,
      };
};
