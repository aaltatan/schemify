/**
 * Data fillers, mirroring `schemify/fillers.py`: a value matching a JSON Schema, picked by the
 * schema kind (`enum`, a filler `format` like `date`, else its `type`).
 *
 * Python asks each value in turn, here the answers live in a `Draft` the form edits, and
 * `readData` turns it into the same data. A rejected answer, which Python asks again, becomes
 * an issue keyed by its path (`address.city`, `tags[0]`) and is left out of the data.
 */

import {
  ComputeError,
  compute,
  KEYWORD,
  NotSupportedError,
  pyEquals,
  pyRepr,
  pyStr,
} from "./computers.ts";
import type { Issues } from "./generators.ts";
import type { Schema } from "./models.ts";
import { checkValue, type Parser, toDate, toDatetime, toInt, toNumber } from "./validators.ts";

/** The answers for one value, `added` is whether an optional value is given. */
export type Draft =
  | { kind: "text"; text: string }
  | { kind: "boolean"; added: boolean; value: boolean }
  | { kind: "enum"; added: boolean; index: number }
  | { kind: "array"; added: boolean; items: Draft[] }
  | { kind: "object"; added: boolean; properties: Record<string, Draft> }
  | { kind: "none" };

/** Returned by a filler when an optional value is skipped. */
const MISSING = Symbol("missing");

type FillFn = (
  schema: Schema,
  draft: Draft,
  label: string,
  required: boolean,
  issues: Issues,
) => unknown;

const TEXT_PARSERS: Record<string, Parser> = {
  string: String,
  integer: toInt,
  number: toNumber,
  date: toDate,
  "date-time": toDatetime,
};

const FILLERS: Record<string, FillFn> = {
  ...Object.fromEntries(
    Object.entries(TEXT_PARSERS).map(([name, parse]) => [name, fillText(parse)]),
  ),
  boolean: fillBoolean,
  enum: fillEnum,
  array: fillArray,
  object: fillObject,
};

/** The filler name of `schema`: `enum`, a filler `format`, or its `type`, like `kind`. */
export function kind(schema: Schema): string {
  if ("enum" in schema) {
    return "enum";
  }

  if (typeof schema.format === "string" && schema.format in FILLERS) {
    return schema.format;
  }

  return schema.type === undefined ? "None" : String(schema.type);
}

/**
 * The answers of `schema` before anything is typed, what Python offers: its `default` for a
 * text, boolean or enum value, else empty.
 */
export function newDraft(schema: Schema): Draft {
  const name = kind(schema);

  if (name in TEXT_PARSERS) {
    return { kind: "text", text: "default" in schema ? pyStr(schema.default) : "" };
  }

  switch (name) {
    case "boolean":
      return { kind: "boolean", added: true, value: schema.default === true };
    case "enum": {
      const index = (schema.enum as unknown[]).findIndex((c) => pyEquals(c, schema.default));

      return { kind: "enum", added: true, index: Math.max(index, 0) };
    }
    case "array": {
      const items = (schema.items ?? {}) as Schema;
      const count = Number(schema.minItems ?? 0);

      return {
        kind: "array",
        added: true,
        items: Array.from({ length: count }, () => newDraft(items)),
      };
    }
    case "object":
      return {
        kind: "object",
        added: true,
        properties: Object.fromEntries(
          Object.entries(properties(schema))
            .filter(([, property]) => !(KEYWORD in property))
            .map(([key, property]) => [key, newDraft(property)]),
        ),
      };
    default:
      return { kind: "none" };
  }
}

/** The data `draft` gives for `schema`, computed then checked as a whole, like `ask_data`. */
export function readData(schema: Schema, draft: Draft): { data: unknown; issues: Issues } {
  const issues: Issues = {};
  const value = fill(schema, draft, "", true, issues);
  const data = value === MISSING ? {} : value;

  try {
    compute(schema, data);
  } catch (e) {
    if (!(e instanceof ComputeError || e instanceof NotSupportedError)) {
      throw e;
    }

    issues[""] = e.message;
  }

  // the keywords no filler asks about (like `allOf` or `dependentRequired`), and computed values
  const error = Object.keys(issues).length === 0 ? checkValue(schema, data) : null;

  if (error !== null) {
    issues[""] = error;
  }

  return { data, issues };
}

/** Items each matching `schema`, each computed and checked on its own, like `ask_list`. */
export function readList(schema: Schema, drafts: Draft[]): { data: unknown[]; issues: Issues[] } {
  const items = drafts.map((draft) => readData(schema, draft));

  return { data: items.map((item) => item.data), issues: items.map((item) => item.issues) };
}

/** The value of `schema` from `draft`, with the filler matching its kind, like `fill`. */
export function fill(
  schema: Schema,
  draft: Draft | undefined,
  label: string,
  required: boolean,
  issues: Issues,
): unknown {
  const name = kind(schema);
  const fillFn = FILLERS[name];

  if (!fillFn) {
    const supported = Object.keys(FILLERS).sort().join(", ");

    issues[label] =
      `Can not fill '${label || "data"}': Schema kind '${name}' is not supported, supported: ${supported}`;

    return MISSING;
  }

  return fillFn(schema, draftFor(schema, draft), label, required, issues);
}

/** `draft` when it fits `schema`, else new answers: a draft left from an earlier schema. */
export function draftFor(schema: Schema, draft: Draft | undefined): Draft {
  const fresh = newDraft(schema);

  return draft?.kind === fresh.kind ? draft : fresh;
}

// -----------------------
// utils
// -----------------------

/** The schema `title` when it has one, else the property path. */
export function displayName(schema: Schema, label: string): string {
  return typeof schema.title === "string" && schema.title ? schema.title : label;
}

export function properties(schema: Schema): Record<string, Schema> {
  return (schema.properties ?? {}) as Record<string, Schema>;
}

function skipped(draft: Draft, required: boolean): boolean {
  return !required && "added" in draft && !draft.added;
}

// -----------------------
// typed text
// -----------------------

function fillText(parse: Parser): FillFn {
  return (schema, draft, label, required, issues) => {
    const text = draft.kind === "text" ? draft.text : "";

    if (!required && !text.trim()) {
      return MISSING;
    }

    let value: unknown;

    try {
      value = parse(text);
    } catch (e) {
      issues[label] = (e as Error).message;

      return MISSING;
    }

    const error = checkValue(schema, value);

    if (error !== null) {
      issues[label] = error;

      return MISSING;
    }

    return value;
  };
}

// -----------------------
// choices
// -----------------------

function fillBoolean(_schema: Schema, draft: Draft, _label: string, required: boolean): unknown {
  if (skipped(draft, required)) {
    return MISSING;
  }

  return draft.kind === "boolean" && draft.value;
}

function fillEnum(schema: Schema, draft: Draft, _label: string, required: boolean): unknown {
  if (skipped(draft, required)) {
    return MISSING;
  }

  const choices = schema.enum as unknown[];
  const index = draft.kind === "enum" ? draft.index : 0;

  return choices[Math.min(index, choices.length - 1)];
}

// -----------------------
// containers
// -----------------------

function fillArray(
  schema: Schema,
  draft: Draft,
  label: string,
  required: boolean,
  issues: Issues,
): unknown {
  if (skipped(draft, required) || draft.kind !== "array") {
    return MISSING;
  }

  const itemsSchema = (schema.items ?? {}) as Schema;
  const items: unknown[] = [];

  draft.items.forEach((itemDraft, i) => {
    const path = `${label}[${i}]`;
    const item = fill(itemsSchema, itemDraft, path, true, issues);

    if (item === MISSING) {
      return;
    }

    if (schema.uniqueItems && items.some((other) => pyEquals(other, item))) {
      issues[path] = `${pyRepr(item)} is already in '${displayName(schema, label)}'`;

      return;
    }

    items.push(item);
  });

  return items;
}

function fillObject(
  schema: Schema,
  draft: Draft,
  label: string,
  required: boolean,
  issues: Issues,
): unknown {
  if (skipped(draft, required) || draft.kind !== "object") {
    return MISSING;
  }

  const requiredNames = new Set((schema.required ?? []) as string[]);
  const data: Record<string, unknown> = {};

  for (const [name, propertySchema] of Object.entries(properties(schema))) {
    if (KEYWORD in propertySchema) {
      continue;
    }

    const path = label ? `${label}.${name}` : name;
    const value = fill(
      propertySchema,
      draft.properties[name],
      path,
      requiredNames.has(name),
      issues,
    );

    if (value !== MISSING) {
      data[name] = value;
    }
  }

  return data;
}
