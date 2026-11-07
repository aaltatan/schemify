// The cases of schemify's tests/test_generators.py, as nodes instead of scripted answers.

import { describe, expect, it } from "vitest";
import {
  buildSchema,
  computerGroups,
  generate,
  type Issues,
  KEYWORD,
  type Node,
  newNode,
  newProperty,
  type ObjectNode,
  optionsExample,
  type Property,
  SCHEMA_DIALECT,
  TYPES,
} from "./generators.ts";

function run(node: Node): { schema: unknown; issues: Issues } {
  const issues: Issues = {};

  return { schema: generate(node, "root", issues), issues };
}

function property(name: string, node: Node, extra: Partial<Property> = {}): Property {
  return { ...newProperty(name), node, ...extra };
}

function object(...properties: Property[]): ObjectNode {
  return { type: "object", properties, extraProperties: false };
}

describe("primitives", () => {
  it("has no validators by default", () => {
    expect(run(newNode("string")).schema).toEqual({ type: "string" });
    expect(run(newNode("integer")).schema).toEqual({ type: "integer" });
    expect(run(newNode("number")).schema).toEqual({ type: "number" });
  });

  it("asks no questions", () => {
    expect(run(newNode("boolean")).schema).toEqual({ type: "boolean" });
    expect(run(newNode("date")).schema).toEqual({ type: "string", format: "date" });
    expect(run(newNode("datetime")).schema).toEqual({ type: "string", format: "date-time" });
  });

  it("returns a string format alone", () => {
    const node: Node = { ...newNode("string"), validators: true, format: "email" } as Node;

    expect(run(node).schema).toEqual({ type: "string", format: "email" });
  });

  it("parses string validators and rejects a bad one", () => {
    const answers = { minLength: "x", maxLength: "10", pattern: "^[a-z]+$", not: "root, admin" };
    const node = { ...newNode("string"), validators: true, constraints: answers } as Node;

    expect(run(node)).toEqual({
      schema: {
        type: "string",
        maxLength: 10,
        pattern: "^[a-z]+$",
        not: { enum: ["root", "admin"] },
      },
      issues: { "root.minLength": "'x' is not an integer" },
    });
  });

  it("skips the pattern of digits only strings", () => {
    const answers = { maxLength: "5", pattern: "ignored" };
    const node = { ...newNode("string"), validators: true, digitsOnly: true, constraints: answers };

    expect(run(node as Node).schema).toEqual({
      type: "string",
      pattern: String.raw`^\d+$`,
      maxLength: 5,
    });
  });

  it("rejects a conflicting bound", () => {
    const answers = { minimum: "10", exclusiveMaximum: "1", multipleOf: "0.5" };
    const node: Node = { type: "number", validators: true, constraints: answers };

    expect(run(node)).toEqual({
      schema: { type: "number", minimum: 10, multipleOf: 0.5 },
      issues: { "root.exclusiveMaximum": "minimum (10) must be less than exclusiveMaximum (1)" },
    });
  });

  it("parses enum choices", () => {
    expect(run({ type: "enum", choices: [" red ", "", "green, blue"] }).schema).toEqual({
      type: "string",
      enum: ["red", "green, blue"],
    });
    expect(run({ type: "enum", choices: ["red", " red "] }).issues).toEqual({
      "root.choices.1": "Choice 'red' already exists",
    });
    expect(run({ type: "enum", choices: [""] }).issues).toEqual({
      "root.choices": "Add at least one choice",
    });
  });
});

describe("containers", () => {
  it("builds an array", () => {
    const node: Node = {
      type: "array",
      items: newNode("string"),
      validators: true,
      constraints: { minItems: "1" },
      uniqueItems: true,
    };

    expect(run(node).schema).toEqual({
      type: "array",
      items: { type: "string" },
      minItems: 1,
      uniqueItems: true,
    });
  });

  it("builds an object with a nested array of objects", () => {
    const tag = {
      ...object(property("label", { type: "enum", choices: ["a", "b"] })),
      extraProperties: true,
    };
    const node = object(
      property("name", newNode("string"), { description: "Full name" }),
      property("tags", { ...newNode("array"), items: tag } as Node, {
        label: "Tags",
        required: false,
      }),
    );

    expect(run(node).schema).toEqual({
      type: "object",
      properties: {
        name: { description: "Full name", type: "string" },
        tags: {
          title: "Tags",
          type: "array",
          items: {
            type: "object",
            properties: { label: { type: "string", enum: ["a", "b"] } },
            required: ["label"],
          },
        },
      },
      required: ["name"],
      additionalProperties: false,
    });
  });

  it("reads defaults as JSON, else as text, matching the property schema", () => {
    const node = object(
      property("age", newNode("integer"), { default: "x" }),
      property("code", newNode("string"), { default: "42" }),
      property("tags", newNode("array"), { default: '["a"]' }),
    );
    const { schema, issues } = run(node);

    expect((schema as { properties: object }).properties).toEqual({
      age: { type: "integer" },
      code: { type: "string", default: "42" },
      tags: { type: "array", items: { type: "string" }, default: ["a"] },
    });
    expect(issues).toEqual({ "root.0.default": "'x' is not of type 'integer'" });
  });

  it("needs a property, with unique names", () => {
    expect(run(object()).issues).toEqual({ "root.properties": "Add at least one property" });
    expect(
      run(object(property("a", newNode("boolean")), property(" a ", newNode("boolean")))).issues,
    ).toEqual({
      "root.1.name": "Property 'a' already exists",
    });
  });

  it("builds a computed property", () => {
    const full: Node = {
      type: "computed",
      fn: "join",
      from: ["first", "last"],
      options: { sep: ", " },
      result: newNode("string"),
    };
    const node = object(
      property("first", newNode("string")),
      property("last", newNode("string")),
      property("full", full, { label: "Full name" }),
    );

    expect((run(node).schema as { properties: object }).properties).toMatchObject({
      full: {
        title: "Full name",
        type: "string",
        [KEYWORD]: { fn: "join", from: ["first", "last"], options: { sep: ", " } },
      },
    });
  });

  it("drops options of a computer without any", () => {
    const loud: Node = {
      type: "computed",
      fn: "upper",
      from: ["name"],
      options: { sep: "-" },
      result: newNode("string"),
    };
    const schema = run(object(property("name", newNode("string")), property("loud", loud))).schema;

    expect((schema as { properties: Record<string, object> }).properties.loud).toEqual({
      type: "string",
      [KEYWORD]: { fn: "upper", from: ["name"] },
    });
  });

  it("computes only from earlier properties", () => {
    const first: Node = {
      type: "computed",
      fn: "upper",
      from: [],
      options: {},
      result: newNode("string"),
    };
    const later: Node = {
      type: "computed",
      fn: "upper",
      from: ["b"],
      options: {},
      result: newNode("string"),
    };

    expect(run(object(property("a", first))).issues).toHaveProperty("root.0.type");
    expect(
      run(
        object(
          property("a", newNode("string")),
          property("c", later),
          property("b", newNode("string")),
        ),
      ).issues,
    ).toEqual({
      "root.1.from": "Not an earlier property: b",
    });
  });

  it("builds the schema with its header", () => {
    expect(buildSchema(object(property("done", newNode("boolean"))), "Task").schema).toEqual({
      $schema: SCHEMA_DIALECT,
      title: "Task",
      type: "object",
      properties: { done: { type: "boolean" } },
      required: ["done"],
      additionalProperties: false,
    });
  });
});

describe("computers", () => {
  it("groups them in order, Text first", () => {
    expect(computerGroups()[0]?.[0]).toBe("Text");
  });

  it.each([
    ["join", 2, { sep: " " }],
    ["upper", 1, null],
    ["upper", 0, { value: "value" }],
    ["replace", 1, { old: "text", new: "text" }],
    ["round", 1, { digits: 2 }],
    ["words", 1, { lang: "en", prefix: "", suffix: "" }],
    ["lookup", 1, { map: {}, fallback: "value" }],
    ["expr", 0, { expr: "text" }],
    ["template", 1, {}],
    ["today", 0, null],
    ["join", 9, { sep: " " }],
  ])("gives the options example of %s with %i sources", (name, sources, expected) => {
    expect(optionsExample(name, sources)).toEqual(expected);
  });
});

describe("defaults", () => {
  it("lists types sorted and picks the first computer listed", () => {
    expect(TYPES[0]).toBe("array");
    expect(newNode("computed")).toMatchObject({ fn: "join" });
  });
});

describe("issues", () => {
  it("checks the answers of a property without a name", () => {
    const node: Node = { type: "number", validators: true, constraints: { minimum: "x" } };

    expect(run(object(property("", node))).issues).toEqual({
      "root.0.name": "Enter a property name",
      "root.0.minimum": "'x' is not a number",
    });
  });
});
