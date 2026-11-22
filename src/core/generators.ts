/**
 * Schema generators, mirroring `schemify/generators.py`.
 *
 * Python asks the questions one by one, here every answer lives in a `Node` the editor edits,
 * and `generate` turns it into the same JSON Schema. A rejected answer, which Python asks
 * again, becomes an issue keyed by its path and is left out of the schema.
 */

import meta from "./meta.json";
import type { Schema } from "./models.ts";
import {
  ARRAY_CONSTRAINTS,
  type Constraint,
  checkBounds,
  defaultParser,
  NUMBER_CONSTRAINTS,
  STRING_CONSTRAINTS,
} from "./validators.ts";

export const SCHEMA_DIALECT = meta.dialect;

export const STRING_FORMATS = ["none", "email", "uuid"] as const;

const DATE = "[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])";

/**
 * `format` is only an annotation in 2020-12, most validators skip it unless told to check
 * formats, but every one checks `pattern`: ASCII classes, no lookaround, so it reads the same
 * in JS, Python, Go (RE2), Rust, Java and .NET.
 */
// shortcut: dates are not checked against the calendar (02-31 passes), format checking does that
export const FORMAT_PATTERNS: Record<string, string> = {
  date: `^${DATE}$`,
  "date-time": String.raw`^${DATE}[Tt]([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\.[0-9]+)?([Zz]|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$`,
  email: String.raw`^[^@\s]+@[^@\s]+\.[^@\s]+$`,
  uuid: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
};

export const DIGITS_ONLY = "^[0-9]+$";

function formatted(format: string): Schema {
  return { type: "string", format, pattern: FORMAT_PATTERNS[format] };
}

/** Answers to constraint questions by keyword, an empty answer skips it. */
export type Answers = Record<string, string>;

export type Node =
  | {
      type: "string";
      validators: boolean;
      format: (typeof STRING_FORMATS)[number];
      digitsOnly: boolean;
      constraints: Answers;
    }
  | { type: "integer" | "number"; validators: boolean; constraints: Answers }
  | { type: "boolean" | "date" | "datetime" }
  | { type: "enum"; choices: string[] }
  | { type: "array"; items: Node; validators: boolean; constraints: Answers; uniqueItems: boolean }
  | ObjectNode;

export type ObjectNode = { type: "object"; properties: Property[]; extraProperties: boolean };

export type Property = {
  id: string;
  name: string;
  label: string;
  description: string;
  /** Read as JSON, else as text, see `defaultParser`. */
  default: string;
  required: boolean;
  node: Node;
};

export type TypeName = Node["type"];

/** Why answers were rejected, by path: `root.0.minLength` is the first property's `minLength`. */
export type Issues = Record<string, string>;

/** The Python defaults of each type's questions, before any answer. */
const FACTORIES: Record<TypeName, () => Node> = {
  string: () => ({
    type: "string",
    validators: false,
    format: "none",
    digitsOnly: false,
    constraints: {},
  }),
  integer: () => ({ type: "integer", validators: false, constraints: {} }),
  number: () => ({ type: "number", validators: false, constraints: {} }),
  boolean: () => ({ type: "boolean" }),
  date: () => ({ type: "date" }),
  datetime: () => ({ type: "datetime" }),
  enum: () => ({ type: "enum", choices: [""] }),
  array: () => ({
    type: "array",
    items: newNode("string"),
    validators: false,
    constraints: {},
    uniqueItems: false,
  }),
  object: () => ({ type: "object", properties: [], extraProperties: false }),
};

/** The type names Python offers. */
export const TYPES = (Object.keys(FACTORIES) as TypeName[]).sort();

export function newNode(type: TypeName): Node {
  return FACTORIES[type]();
}

export function newProperty(name = ""): Property {
  return {
    id: crypto.randomUUID(),
    name,
    label: "",
    description: "",
    default: "",
    required: true,
    node: newNode("string"),
  };
}

/** The schema of `root` with its `title`, like `ask_schema`, and the rejected answers. */
export function buildSchema(root: ObjectNode, title = ""): { schema: Schema; issues: Issues } {
  const issues: Issues = {};
  const header = title ? { $schema: SCHEMA_DIALECT, title } : { $schema: SCHEMA_DIALECT };

  return { schema: { ...header, ...generate(root, "root", issues) }, issues };
}

/** The schema of `node`, recording rejected answers in `issues` under `path`. */
export function generate(node: Node, path: string, issues: Issues): Schema {
  switch (node.type) {
    case "string":
      return generateString(node, path, issues);

    case "integer":
    case "number":
      return node.validators
        ? { type: node.type, ...askConstraints(NUMBER_CONSTRAINTS, node.constraints, path, issues) }
        : { type: node.type };

    case "boolean":
      return { type: "boolean" };

    case "date":
      return formatted("date");

    case "datetime":
      return formatted("date-time");

    case "enum":
      return generateEnum(node.choices, path, issues);

    case "array":
      return generateArray(node, path, issues);

    case "object":
      return generateObject(node, path, issues);
  }
}

// -----------------------
// utils
// -----------------------

/** A string limited to `choices`, an empty choice is skipped, a repeated one rejected. */
function generateEnum(choices: string[], path: string, issues: Issues): Schema {
  const unique: string[] = [];

  for (const [index, text] of choices.entries()) {
    const choice = text.trim();

    if (unique.includes(choice)) {
      issues[`${path}.choices.${index}`] = `Choice '${choice}' already exists`;
    } else if (choice) {
      unique.push(choice);
    }
  }

  if (unique.length === 0) {
    issues[`${path}.choices`] = "Add at least one choice";

    return { type: "string" };
  }

  return { type: "string", enum: unique };
}

/** Run `fn`, recording its error under `path` and returning `{}` instead. */
function parse(fn: () => Schema, path: string, issues: Issues): Schema {
  try {
    return fn();
  } catch (e) {
    issues[path] = (e as Error).message;

    return {};
  }
}

/** Parse each answered constraint, a conflicting bound is rejected like Python asks it again. */
function askConstraints(
  constraints: Constraint[],
  answers: Answers,
  path: string,
  issues: Issues,
): Schema {
  const schema: Schema = {};

  for (const { keyword, parse: parseAnswer } of constraints) {
    const answer = answers[keyword] ?? "";

    if (!answer.trim()) {
      continue;
    }

    const parsed = parse(() => ({ [keyword]: parseAnswer(answer) }), `${path}.${keyword}`, issues);

    if (!(keyword in parsed)) {
      continue;
    }

    const conflict = checkBounds({ ...schema, ...parsed });

    if (conflict) {
      issues[`${path}.${keyword}`] = conflict;
    } else {
      Object.assign(schema, parsed);
    }
  }

  return schema;
}

// -----------------------
// primitive types
// -----------------------

function generateString(
  node: Extract<Node, { type: "string" }>,
  path: string,
  issues: Issues,
): Schema {
  const schema: Schema = { type: "string" };

  if (!node.validators) {
    return schema;
  }

  if (node.format !== "none") {
    return formatted(node.format);
  }

  let constraints = STRING_CONSTRAINTS;

  if (node.digitsOnly) {
    schema.pattern = DIGITS_ONLY;
    constraints = STRING_CONSTRAINTS.filter((c) => c.keyword !== "pattern");
  }

  return { ...schema, ...askConstraints(constraints, node.constraints, path, issues) };
}

// -----------------------
// container types
// -----------------------

function generateArray(
  node: Extract<Node, { type: "array" }>,
  path: string,
  issues: Issues,
): Schema {
  const schema: Schema = { type: "array", items: generate(node.items, `${path}.items`, issues) };

  if (!node.validators) {
    return schema;
  }

  Object.assign(schema, askConstraints(ARRAY_CONSTRAINTS, node.constraints, path, issues));

  if (node.uniqueItems) {
    schema.uniqueItems = true;
  }

  return schema;
}

/** The label is saved as the JSON Schema `title`, fillers show it instead of the property name. */
function generateObject(node: ObjectNode, path: string, issues: Issues): Schema {
  const properties: Schema = {};
  const required: string[] = [];

  if (node.properties.length === 0) {
    issues[`${path}.properties`] = "Add at least one property";
  }

  for (const [index, property] of node.properties.entries()) {
    const name = property.name.trim();
    const propertyPath = `${path}.${index}`;

    // checked before the name, so a property with a bad name still shows its other issues
    const propertySchema = generate(property.node, propertyPath, issues);

    if (!name) {
      issues[`${propertyPath}.name`] = "Enter a property name";
      continue;
    }

    if (name in properties) {
      issues[`${propertyPath}.name`] = `Property '${name}' already exists`;
      continue;
    }

    const annotations = { title: property.label.trim(), description: property.description.trim() };

    const fallback = property.default.trim()
      ? parse(
          () => ({ default: defaultParser(propertySchema)(property.default) }),
          `${propertyPath}.default`,
          issues,
        )
      : {};

    properties[name] = {
      ...Object.fromEntries(Object.entries(annotations).filter(([, value]) => value)),
      ...propertySchema,
      ...fallback,
    };

    if (property.required) {
      required.push(name);
    }
  }

  const schema: Schema = { type: "object", properties };

  if (required.length > 0) {
    schema.required = required;
  }

  if (!node.extraProperties) {
    schema.additionalProperties = false;
  }

  return schema;
}
