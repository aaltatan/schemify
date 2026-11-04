// Drift checks: after `pnpm sync`, these fail until the editor supports what Python added.

import { describe, expect, it } from "vitest";
import { TYPES } from "./generators.ts";
import meta from "./meta.json";
import { PARSERS } from "./validators.ts";

describe("meta.json from the schemify package", () => {
  it("has a node for every type", () => {
    expect(TYPES).toEqual(meta.types);
  });

  it("has a parser for every constraint", () => {
    const keywords = Object.values(meta.constraints).flatMap((list) =>
      list.map(([keyword]) => keyword),
    );

    expect(keywords.sort()).toEqual(Object.keys(PARSERS).sort());
  });
});
