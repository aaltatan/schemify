// The cases of schemify's tests/test_generators.py, as nodes instead of scripted answers.

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  buildSchema,
  FORMAT_PATTERNS,
  generate,
  type Issues,
  type Node,
  newNode,
  newProperty,
  type ObjectNode,
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

describe("format patterns", () => {
  // without ajv-formats, like most validators by default, the pattern still checks
  const ajv = new Ajv2020();

  it.each([
    ["date", ["2026-11-04"], ["2026-13-01", "2026-1-01", "hello"]],
    [
      "date-time",
      ["2026-11-04T10:30:00.123456+03:00", "2026-11-04T10:30:00+00:00", "2026-11-04T10:30:00Z"],
      ["2026-11-04 10:30:00Z", "2026-11-04T10:30:00", "2026-11-04T25:00:00Z", "hello"],
    ],
    ["email", ["a@b.co"], ["nope", "a@b", "a b@c.d"]],
    [
      "uuid",
      ["123e4567-e89b-12d3-a456-426614174000"],
      ["123e4567e89b12d3a456426614174000", "hello"],
    ],
  ])("checks %s", (format, valid, invalid) => {
    const validate = ajv.compile({ type: "string", pattern: FORMAT_PATTERNS[format] });

    expect(valid.every((value) => validate(value))).toBe(true);
    expect(invalid.some((value) => validate(value))).toBe(false);
  });
});

describe("primitives", () => {
  it("has no validators by default", () => {
    expect(run(newNode("string")).schema).toEqual({ type: "string" });
    expect(run(newNode("integer")).schema).toEqual({ type: "integer" });
    expect(run(newNode("number")).schema).toEqual({ type: "number" });
  });

  it("asks no questions", () => {
    expect(run(newNode("boolean")).schema).toEqual({ type: "boolean" });
    expect(run(newNode("date")).schema).toEqual({
      type: "string",
      format: "date",
      pattern: FORMAT_PATTERNS.date,
    });
    expect(run(newNode("datetime")).schema).toEqual({
      type: "string",
      format: "date-time",
      pattern: FORMAT_PATTERNS["date-time"],
    });
  });

  it("returns a string format alone", () => {
    const node: Node = { ...newNode("string"), validators: true, format: "email" } as Node;

    expect(run(node).schema).toEqual({
      type: "string",
      format: "email",
      pattern: FORMAT_PATTERNS.email,
    });
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
      pattern: "^[0-9]+$",
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

describe("defaults", () => {
  it("lists types sorted", () => {
    expect(TYPES[0]).toBe("array");
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
