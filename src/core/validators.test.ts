// Parsers accept what their Python counterparts in schemify/validators.py accept.

import { describe, expect, it } from "vitest";
import {
  checkBounds,
  checkValue,
  toDate,
  toDatetime,
  toInt,
  toNumber,
  toOption,
  toRegex,
} from "./validators.ts";

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
    expect(toOption("1", " ")).toBe("1");
    expect(toOption("2", 4)).toBe(2);
    expect(toOption('{"a": 1}', {})).toEqual({ a: 1 });
    expect(() => toOption("x", 4)).toThrow("Invalid JSON");
    expect(toOption("2", "value")).toBe(2);
    expect(toOption("abc", "value")).toBe("abc");
  });

  it("checks bounds", () => {
    expect(checkBounds({ minLength: 2, maxLength: 2 })).toBeNull();
    expect(checkBounds({ minimum: 2, exclusiveMaximum: 2 })).toBe(
      "minimum (2) must be less than exclusiveMaximum (2)",
    );
  });
});

describe("dates", () => {
  it("parses dates like to_date", () => {
    expect(toDate("2026-11-04")).toBe("2026-11-04");
    expect(toDate("2028-02-29")).toBe("2028-02-29");
    expect(() => toDate("2026-13-01")).toThrow();
    expect(() => toDate("2026-02-29")).toThrow();
  });

  it("adds the local offset like to_datetime", () => {
    expect(toDatetime("2026-11-04T10:30:00+03:00")).toBe("2026-11-04T10:30:00+03:00");
    expect(toDatetime("2026-11-04T10:30:00Z")).toBe("2026-11-04T10:30:00+00:00");
    expect("+-").toContain(toDatetime("2026-11-04T10:30:00").at(-6));
    expect(() => toDatetime("noon")).toThrow();
  });
});

describe("checkValue", () => {
  it("checks like check_value, in its words", () => {
    const schema = { type: "string", minLength: 2 };

    expect(checkValue(schema, "ab")).toBeNull();
    expect(checkValue(schema, "a")).toBe("'a' is too short");
    expect(checkValue({ format: "email" }, "nope")).toBe("'nope' is not a 'email'");
    expect(checkValue({ format: "date" }, "2026-02-30")).not.toBeNull();
    expect(checkValue({ type: "object", properties: { a: { type: "integer" } } }, { a: "x" })).toBe(
      "'x' is not of type 'integer'",
    );
    expect(checkValue({ type: "string", "x-compute": { fn: "upper" } }, "A")).toBeNull();
  });
});
