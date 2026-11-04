/**
 * Read a JSON Schema back into the editor's nodes, the reverse of `buildSchema`.
 *
 * A schema the nodes cannot hold (an unknown keyword, a type Python does not ask for) is
 * rejected instead of losing part of it: the nodes must build the same schema again.
 */

import {
  buildSchema,
  KEYWORD,
  type Node,
  newNode,
  newProperty,
  type ObjectNode,
  STRING_FORMATS,
} from "./generators.ts";
import type { Schema } from "./models.ts";
import { ARRAY_CONSTRAINTS, NUMBER_CONSTRAINTS, STRING_CONSTRAINTS } from "./validators.ts";

const DIGITS_ONLY = String.raw`^\d+$`;

/** The root object and title of the schema in `text`, or throws an `Error` saying why not. */
export function readSchema(text: string): { root: ObjectNode; title: string } {
  let input: unknown;

  try {
    input = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }

  const schema = asSchema(input);
  let root: Node;

  try {
    root = readNode(schema);
  } catch (e) {
    throw new Error(`Cannot edit this schema: ${(e as Error).message}`);
  }

  if (root.type !== "object") {
    throw new Error("Cannot edit this schema: the root must be an object");
  }

  const title = asText(schema.title);
  const { $schema: _, ...rebuilt } = buildSchema(root, title.trim()).schema;
  const { $schema: __, ...expected } = schema;
  const path = difference(expected, rebuilt, "");

  if (path !== null) {
    throw new Error(`Cannot edit this schema: '${path.slice(1) || "root"}' is not supported`);
  }

  return { root, title };
}

function asSchema(value: unknown): Schema {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("A schema must be a JSON object");
  }

  return value as Schema;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The answers to `keywords` found in `schema`, as the text a user would type. */
function answers(schema: Schema, keywords: { keyword: string }[]): Record<string, string> {
  const found: Record<string, string> = {};

  for (const { keyword } of keywords) {
    const value = schema[keyword];

    if (value === undefined) {
      continue;
    }

    // `not` is typed as comma separated choices, see `PARSERS`
    found[keyword] =
      keyword === "not"
        ? ((value as { enum?: unknown[] }).enum ?? []).join(", ")
        : typeof value === "string"
          ? value
          : JSON.stringify(value);
  }

  return found;
}

function readNode(schema: Schema): Node {
  if (KEYWORD in schema) {
    const { [KEYWORD]: spec, ...result } = schema;
    const { fn, from, options } = asSchema(spec);

    return {
      type: "computed",
      fn: asText(fn),
      from: Array.isArray(from) ? from.map(String) : [],
      options: Object.fromEntries(
        Object.entries(options ? asSchema(options) : {}).map(([name, value]) => [
          name,
          typeof value === "string" ? value : JSON.stringify(value),
        ]),
      ),
      result: readNode(result),
    };
  }

  switch (schema.type) {
    case "string":
      return readString(schema);

    case "integer":
    case "number": {
      const constraints = answers(schema, NUMBER_CONSTRAINTS);

      return { type: schema.type, validators: Object.keys(constraints).length > 0, constraints };
    }

    case "boolean":
      return newNode("boolean");

    case "array": {
      const constraints = answers(schema, ARRAY_CONSTRAINTS);
      const uniqueItems = schema.uniqueItems === true;

      return {
        type: "array",
        items: readNode(asSchema(schema.items)),
        validators: uniqueItems || Object.keys(constraints).length > 0,
        constraints,
        uniqueItems,
      };
    }

    case "object":
      return readObject(schema);

    default:
      throw new Error(`type ${JSON.stringify(schema.type)} is not supported`);
  }
}

function readString(schema: Schema): Node {
  if (schema.format === "date") {
    return newNode("date");
  }

  if (schema.format === "date-time") {
    return newNode("datetime");
  }

  if (Array.isArray(schema.enum)) {
    return { type: "enum", choices: schema.enum.map(String) };
  }

  const format = STRING_FORMATS.find((name) => name !== "none" && name === schema.format);

  if (format) {
    return { ...newNode("string"), validators: true, format } as Node;
  }

  const digitsOnly = schema.pattern === DIGITS_ONLY;
  const constraints = answers(schema, STRING_CONSTRAINTS);

  if (digitsOnly) {
    delete constraints.pattern;
  }

  return {
    type: "string",
    validators: digitsOnly || Object.keys(constraints).length > 0,
    format: "none",
    digitsOnly,
    constraints,
  };
}

function readObject(schema: Schema): ObjectNode {
  const required = Array.isArray(schema.required) ? schema.required : [];

  const properties = Object.entries(asSchema(schema.properties ?? {})).map(([name, value]) => {
    const { title, description, default: fallback, ...rest } = asSchema(value);

    return {
      ...newProperty(name),
      label: asText(title),
      description: asText(description),
      default:
        fallback === undefined
          ? ""
          : typeof fallback === "string"
            ? fallback
            : JSON.stringify(fallback),
      required: required.includes(name),
      node: readNode(rest),
    };
  });

  return { type: "object", properties, extraProperties: schema.additionalProperties !== false };
}

/** The path of the first value that differs, `null` when none, `required` in any order. */
function difference(a: unknown, b: unknown, path: string): string | null {
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return JSON.stringify(a) === JSON.stringify(b) ? null : path;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return path;
  }

  const [x, y] = [a as Record<string, unknown>, b as Record<string, unknown>];

  for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const sorted = key === "required" && Array.isArray(x[key]) && Array.isArray(y[key]);
    const [left, right] = sorted
      ? [[...(x[key] as string[])].sort(), [...(y[key] as string[])].sort()]
      : [x[key], y[key]];
    const found = difference(left, right, `${path}.${key}`);

    if (found !== null) {
      return found;
    }
  }

  return null;
}
