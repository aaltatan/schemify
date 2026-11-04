/**
 * Schema generators, mirroring `schemify/generators.py`.
 *
 * Python asks the questions one by one, here every answer lives in a `Node` the editor edits,
 * and `generate` turns it into the same JSON Schema. A rejected answer, which Python asks
 * again, becomes an issue keyed by its path and is left out of the schema.
 */

import { KEYWORD } from "./computers.ts";
import meta from "./meta.json";
import type { Schema } from "./models.ts";
import {
  ARRAY_CONSTRAINTS,
  type Constraint,
  checkBounds,
  NUMBER_CONSTRAINTS,
  STRING_CONSTRAINTS,
  toOption,
} from "./validators.ts";

export const SCHEMA_DIALECT = meta.dialect;

export { KEYWORD };

export const STRING_FORMATS = ["none", "email", "uuid"] as const;

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
  | ObjectNode
  | ComputedNode;

export type ObjectNode = { type: "object"; properties: Property[]; extraProperties: boolean };

/** `from` holds the source names in the order they were picked. */
export type ComputedNode = {
  type: "computed";
  fn: string;
  from: string[];
  /** The typed option values by name, an empty one is left out. */
  options: Record<string, string>;
  result: Node;
};

export type Property = {
  id: string;
  name: string;
  label: string;
  description: string;
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
  computed: () => ({
    type: "computed",
    fn: computerGroups()[0]?.[1][0] ?? "", // the first one listed, like the prompt
    from: [],
    options: {},
    result: newNode("string"),
  }),
};

/** The type names Python offers, `computed` is only offered after an earlier property. */
export const TYPES = (Object.keys(FACTORIES) as TypeName[])
  .filter((name) => name !== "computed")
  .sort();

export function newNode(type: TypeName): Node {
  return FACTORIES[type]();
}

export function newProperty(name = ""): Property {
  return {
    id: crypto.randomUUID(),
    name,
    label: "",
    description: "",
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
      return { type: "string", format: "date" };

    case "datetime":
      return { type: "string", format: "date-time" };

    case "enum":
      return generateEnum(node.choices, path, issues);

    case "array":
      return generateArray(node, path, issues);

    case "object":
      return generateObject(node, path, issues);

    case "computed":
      return generateComputed(node, [], path, issues);
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
    return { ...schema, format: node.format };
  }

  let constraints = STRING_CONSTRAINTS;

  if (node.digitsOnly) {
    schema.pattern = String.raw`^\d+$`;
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
    const propertySchema =
      property.node.type === "computed"
        ? generateComputed(property.node, Object.keys(properties), propertyPath, issues)
        : generate(property.node, propertyPath, issues);

    if (!name) {
      issues[`${propertyPath}.name`] = "Enter a property name";
      continue;
    }

    if (name in properties) {
      issues[`${propertyPath}.name`] = `Property '${name}' already exists`;
      continue;
    }

    const annotations = { title: property.label.trim(), description: property.description.trim() };

    properties[name] = {
      ...Object.fromEntries(Object.entries(annotations).filter(([, value]) => value)),
      ...propertySchema,
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

// -----------------------
// computed
// -----------------------

type Computer = (typeof meta.computers)[keyof typeof meta.computers];

export function computerNames(): string[] {
  return Object.keys(meta.computers).sort();
}

export function computer(name: string): Computer | undefined {
  return (meta.computers as Record<string, Computer>)[name];
}

/** The computers under each group in order, the ungrouped ones last under "Other". */
export function computerGroups(): [group: string, names: string[]][] {
  const grouped = new Set(Object.values(meta.groups).flat());
  const other = computerNames().filter((name) => !grouped.has(name));

  return Object.entries({ ...meta.groups, Other: other }).filter(([, names]) => names.length > 0);
}

/** Example options of `fn` once `sources` values fill its first parameters, `null` when none. */
export function optionsExample(fn: string, sources: number): Record<string, unknown> | null {
  const examples = computer(fn)?.examples ?? [];

  return (
    (examples[Math.min(sources, examples.length - 1)] as Record<string, unknown> | null) ?? null
  );
}

/** A property computed from the earlier properties `names`, and the type of its result. */
function generateComputed(
  node: ComputedNode,
  names: string[],
  path: string,
  issues: Issues,
): Schema {
  if (names.length === 0) {
    issues[`${path}.type`] = "A computed property needs an earlier property to compute from";
  }

  if (!computer(node.fn)) {
    issues[`${path}.fn`] =
      `Computer '${node.fn}' is not supported, supported: ${computerNames().join(", ")}`;
  }

  const missing = node.from.filter((source) => !names.includes(source));

  if (missing.length > 0) {
    issues[`${path}.from`] = `Not an earlier property: ${missing.join(", ")}`;
  }

  const spec: Schema = { fn: node.fn };

  if (node.from.length > 0) {
    spec.from = node.from;
  }

  const options: Schema = {};

  for (const [name, example] of Object.entries(optionsExample(node.fn, node.from.length) ?? {})) {
    const text = node.options[name] ?? "";

    if (text !== "") {
      Object.assign(
        options,
        parse(() => ({ [name]: toOption(text, example) }), `${path}.options.${name}`, issues),
      );
    }
  }

  if (Object.keys(options).length > 0) {
    spec.options = options;
  }

  return { ...generate(node.result, `${path}.result`, issues), [KEYWORD]: spec };
}
