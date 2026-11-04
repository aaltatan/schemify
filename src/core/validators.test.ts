// Parsers accept what their Python counterparts in schemify/validators.py accept.

import { describe, expect, it } from "vitest";
import { checkBounds, toInt, toNumber, toOptions, toRegex } from "./validators.ts";

describe("parsers", () => {
  it("parses integers like int()", () => {
    expect([" 42 ", "+5", "-3", "1_000"].map(toInt)).toEqual([42, 5, -3, 1000]);
    expect(() => toInt("4.2")).toThrow("'4.2' is not an integer");
    expect(() => toInt("1__0")).toThrow();
  });

  it("parses finite numbers like float()", () => {
    expect(["4.2", ".5", "5.", "1e3", "-2E-2"].map(toNumber)).toEqual([4.2, 0.5, 5, 1000, -0.02]);
    expect(() => toNumber("inf")).toThrow("'inf' is not a finite number");
    expect(() => toNumber("1e999")).toThrow("not a finite number");
    expect(() => toNumber("abc")).toThrow("'abc' is not a number");
    expect(() => toNumber(".")).toThrow();
  });

  it("checks regexes and options", () => {
    expect(() => toRegex("(")).toThrow("Invalid regular expression");
    expect(toOptions('{"a": 1}')).toEqual({ a: 1 });
    expect(() => toOptions("[]")).toThrow("Options must be a JSON object");
  });

  it("checks bounds", () => {
    expect(checkBounds({ minLength: 2, maxLength: 2 })).toBeNull();
    expect(checkBounds({ minimum: 2, exclusiveMaximum: 2 })).toBe(
      "minimum (2) must be less than exclusiveMaximum (2)",
    );
  });
});
