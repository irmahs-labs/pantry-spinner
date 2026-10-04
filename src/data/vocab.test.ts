import { describe, expect, it } from "vitest";

import { ApiError } from "../lib/api";
import { whyLoadFailed } from "./vocab";

describe("whyLoadFailed", () => {
  it("reads the API's 'missing' as migrations not applied", () => {
    expect(whyLoadFailed(new ApiError(503, "missing"))).toBe("missing");
  });

  it("reads anything else, a failed fetch included, as unreachable", () => {
    expect(whyLoadFailed(new ApiError(500, "unreachable"))).toBe(
      "unreachable"
    );
    expect(whyLoadFailed(new ApiError(502, "Bad Gateway"))).toBe(
      "unreachable"
    );
    expect(whyLoadFailed(new TypeError("Failed to fetch"))).toBe(
      "unreachable"
    );
    expect(whyLoadFailed("not even an error")).toBe("unreachable");
  });
});
