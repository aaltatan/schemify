import { describe, expect, it } from "vitest";
import { buildSchema, FORMAT_PATTERNS, SCHEMA_DIALECT } from "./generators.ts";
import { readSchema } from "./reader.ts";

const SCHEMA = {
  $schema: SCHEMA_DIALECT,
  title: "Person",
  type: "object",
  properties: {
    name: { title: "Full name", type: "string", minLength: 1, not: { enum: ["root", "admin"] } },
    code: { type: "string", pattern: "^[0-9]+$", maxLength: 6 },
    email: { type: "string", format: "email", pattern: FORMAT_PATTERNS.email, default: "a@b.c" },
    age: { type: "integer", minimum: 0, maximum: 150, default: 30 },
    born: {
      description: "Day of birth",
      type: "string",
      format: "date",
      pattern: FORMAT_PATTERNS.date,
    },
    color: { type: "string", enum: ["red", "green"] },
    tags: { type: "array", items: { type: "string" }, maxItems: 3, uniqueItems: true },
    address: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
  },
  required: ["name", "age"],
  additionalProperties: false,
};

describe("readSchema", () => {
  it("reads a schema the editor builds again", () => {
    const { root, title } = readSchema(JSON.stringify({ ...SCHEMA, required: ["age", "name"] }));
    const { schema, issues } = buildSchema(root, title);

    expect(issues).toEqual({});
    expect(title).toBe("Person");
    expect(root.properties.map((p) => p.required)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(schema).toEqual(SCHEMA);
  });

  it("reads an older schema without format patterns and adds them", () => {
    const older = {
      ...SCHEMA,
      properties: {
        code: { type: "string", pattern: String.raw`^\d+$` },
        born: { type: "string", format: "date" },
      },
      required: ["code"],
    };
    const { root, title } = readSchema(JSON.stringify(older));

    expect(buildSchema(root, title).schema.properties).toEqual({
      code: { type: "string", pattern: "^[0-9]+$" },
      born: { type: "string", format: "date", pattern: FORMAT_PATTERNS.date },
    });
  });

  it("rejects what the editor cannot hold", () => {
    const unknown = { ...SCHEMA, properties: { x: { type: "string", format: "uri" } } };

    expect(() => readSchema(JSON.stringify(unknown))).toThrow("'properties.x.format'");
    expect(() => readSchema('{"type": "oneOf"}')).toThrow("is not supported");
    expect(() => readSchema('{"type": "string"}')).toThrow("the root must be an object");
    expect(() => readSchema("[]")).toThrow("A schema must be a JSON object");
    expect(() => readSchema("{")).toThrow("Invalid JSON");
  });
});
