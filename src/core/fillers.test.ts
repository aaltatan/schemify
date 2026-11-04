// Mirrors `tests/test_fillers.py`, same cases: a Python answer typed again is a draft fixed here.

import { describe, expect, test } from "vitest";
import { type Draft, fill, kind, newDraft, readData, readList } from "./fillers.ts";
import type { Issues } from "./generators.ts";
import type { Schema } from "./models.ts";

const text = (value: string): Draft => ({ kind: "text", text: value });

const object = (properties: Record<string, Draft>, added = true): Draft => ({
  kind: "object",
  added,
  properties,
});

/** The value and issues of one field, like Python's `fill(schema, label)`. */
function fillOne(schema: Schema, draft: Draft, required = true) {
  const issues: Issues = {};

  return { value: fill(schema, draft, "field", required, issues), issues };
}

describe("kind", () => {
  test.each<[Schema, string]>([
    [{ type: "string" }, "string"],
    [{ type: "string", format: "date" }, "date"],
    [{ type: "string", format: "email" }, "string"],
    [{ type: "integer", enum: [1, 2] }, "enum"],
    [{ $ref: "#/x" }, "None"],
  ])("%j is %s", (schema, expected) => {
    expect(kind(schema)).toBe(expected);
  });

  test("unsupported names the path", () => {
    const schema = { type: "object", properties: { x: { oneOf: [] } } };

    expect(readData(schema, newDraft(schema)).issues.x).toMatch(/^Can not fill 'x'/);
  });
});

describe("leaves", () => {
  test.each<[Schema, string[], unknown]>([
    [{ type: "string", minLength: 2 }, ["a", "ab"], "ab"],
    [{ type: "string", format: "email" }, ["nope", "a@b.c"], "a@b.c"],
    [{ type: "integer", minimum: 18 }, ["x", "17", "18"], 18],
    [{ type: "number", exclusiveMaximum: 1 }, ["1", "0.5"], 0.5],
    [{ type: "string", format: "date" }, ["2026-02-30", "2026-02-28"], "2026-02-28"],
    [
      { type: "string", format: "date-time" },
      ["noon", "2026-11-04T12:00:00+00:00"],
      "2026-11-04T12:00:00+00:00",
    ],
  ])("%j rejects until valid", (schema, answers, expected) => {
    const rejected = answers.slice(0, -1);

    for (const answer of rejected) {
      expect(fillOne(schema, text(answer)).issues.field).toBeDefined();
    }

    expect(fillOne(schema, text(answers.at(-1) ?? ""))).toEqual({ value: expected, issues: {} });
  });

  test("optional text can be skipped", () => {
    const schema = { type: "object", properties: { age: { type: "integer" } } };

    expect(readData(schema, object({ age: text("") }))).toEqual({ data: {}, issues: {} });
  });

  test("required string can be empty when the schema allows", () => {
    expect(fillOne({ type: "string" }, text("")).value).toBe("");
  });

  test("boolean and enum", () => {
    expect(fillOne({ type: "boolean" }, { kind: "boolean", added: true, value: true }).value).toBe(
      true,
    );
    expect(fillOne({ enum: [1, 2] }, { kind: "enum", added: true, index: 1 }).value).toBe(2);
  });

  test("an optional choice can be left out", () => {
    const schema = { type: "object", properties: { ok: { type: "boolean" } } };
    const draft = object({ ok: { kind: "boolean", added: false, value: true } });

    expect(readData(schema, draft).data).toEqual({});
  });
});

describe("containers", () => {
  test("array respects unique items", () => {
    const schema = {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 2,
      uniqueItems: true,
    };
    const draft: Draft = { kind: "array", added: true, items: [text("a"), text("a"), text("b")] };
    const { value, issues } = fillOne(schema, draft);

    expect(value).toEqual(["a", "b"]);
    expect(issues).toEqual({ "field[1]": "'a' is already in 'field'" });
  });

  test("a new array has minItems items", () => {
    const draft = newDraft({ type: "array", items: { type: "string" }, minItems: 2 });

    expect(draft).toEqual({ kind: "array", added: true, items: [text(""), text("")] });
  });

  test("object skips missing optional", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
        address: { type: "object", properties: { city: { type: "string", minLength: 2 } } },
      },
      required: ["name"],
    };
    const draft = object({
      name: text("Rama"),
      age: text(""),
      address: object({ city: text("Homs") }),
    });

    expect(readData(schema, draft)).toEqual({
      data: { name: "Rama", address: { city: "Homs" } },
      issues: {},
    });

    // a nested issue is keyed by its path
    const bad = object({ name: text("Rama"), address: object({ city: text("H") }) });

    expect(readData(schema, bad).issues).toEqual({ "address.city": "'H' is too short" });
  });
});

describe("readData", () => {
  test("the whole schema is checked", () => {
    const schema = {
      type: "object",
      properties: { a: { type: "string" } },
      required: ["a"],
      minProperties: 2,
    };

    expect(readData(schema, object({ a: text("x") })).issues[""]).toBeDefined();
  });

  test("round trip", () => {
    // the schema `test_round_trip` builds with `ask_schema`
    const schema = {
      title: "Person",
      type: "object",
      properties: {
        name: { title: "Full name", type: "string", minLength: 2 },
        born: { type: "string", format: "date" },
        role: { type: "string", enum: ["admin", "user"] },
      },
      required: ["name", "born"],
      additionalProperties: false,
    };
    const draft = object({
      name: text("Rawaa"),
      born: text("1993-01-01"),
      role: { kind: "enum", added: true, index: 1 },
    });

    expect(readData(schema, draft)).toEqual({
      data: { name: "Rawaa", born: "1993-01-01", role: "user" },
      issues: {},
    });
  });

  test("computed properties are not asked", () => {
    const schema = {
      type: "object",
      properties: {
        first: { type: "string" },
        last: { type: "string" },
        full: {
          type: "string",
          minLength: 5,
          "x-compute": { fn: "join", from: ["first", "last"] },
        },
      },
    };

    expect(Object.keys((newDraft(schema) as { properties: object }).properties)).toEqual([
      "first",
      "last",
    ]);
    expect(readData(schema, object({ first: text("Rama"), last: text("Ali") })).data).toEqual({
      first: "Rama",
      last: "Ali",
      full: "Rama Ali",
    });

    // the computed value is checked against its schema too
    expect(readData(schema, object({ first: text("A"), last: text("B") })).issues[""]).toMatch(
      /too short/,
    );
  });

  test("compute error", () => {
    const schema = {
      type: "object",
      properties: {
        born: { type: "string" },
        age: { type: "integer", "x-compute": { fn: "age", from: ["born"] } },
      },
    };

    expect(readData(schema, object({ born: text("not a date") })).issues[""]).toMatch(
      /Can not compute 'age'/,
    );
  });
});

describe("readList", () => {
  test("items are computed and checked on their own", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2 },
        upper: { type: "string", "x-compute": { fn: "upper", from: ["$.name"] } },
      },
    };
    const drafts = [object({ name: text("Rama") }), object({ name: text("R") })];

    expect(readList(schema, drafts).issues).toEqual([{}, { name: "'R' is too short" }]);
    expect(readList(schema, [drafts[0] as Draft, object({ name: text("Ali") })]).data).toEqual([
      { name: "Rama", upper: "RAMA" },
      { name: "Ali", upper: "ALI" },
    ]);
  });
});
