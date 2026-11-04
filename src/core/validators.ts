/**
 * Parsers and checks for the editor's answers, mirroring `schemify/validators.py`.
 *
 * A parser turns an answer into a value, or throws an `Error` with a readable message.
 */

import meta from "./meta.json";
import type { Schema } from "./models.ts";

export type Parser = (text: string) => unknown;

export type Constraint = { keyword: string; question: string; parse: Parser };

// -----------------------
// parsers
// -----------------------

const INT = /^[+-]?\d+(?:_\d+)*$/;
const DIGITS = String.raw`\d+(?:_\d+)*`;
const FLOAT = new RegExp(
  String.raw`^[+-]?(?:${DIGITS}(?:\.(?:${DIGITS})?)?|\.${DIGITS})(?:[eE][+-]?${DIGITS})?$`,
);
const NOT_FINITE = /^[+-]?(?:inf|infinity|nan)$/i;

/** Parse an integer: `"42"`, accepting what Python's `int()` does (signs, `1_000`). */
export function toInt(text: string): number {
  const trimmed = text.trim();

  if (!INT.test(trimmed)) {
    throw new Error(`'${text}' is not an integer`);
  }

  return Number(trimmed.replaceAll("_", ""));
}

/** Parse a finite number: `"42"`, `"4.2"`, `"1e3"`. */
export function toNumber(text: string): number {
  const trimmed = text.trim();

  if (NOT_FINITE.test(trimmed)) {
    throw new Error(`'${text}' is not a finite number`);
  }

  if (!FLOAT.test(trimmed)) {
    throw new Error(`'${text}' is not a number`);
  }

  const number = Number(trimmed.replaceAll("_", ""));

  if (!Number.isFinite(number)) {
    throw new Error(`'${text}' is not a finite number`);
  }

  return number;
}

/** Parse an integer that is 0 or more, like a length. */
export function toNonNegativeInt(text: string): number {
  const number = toInt(text);

  if (number < 0) {
    throw new Error(`'${text}' must be 0 or more`);
  }

  return number;
}

/** Parse a number greater than 0, like `multipleOf`. */
export function toPositiveNumber(text: string): number {
  const number = toNumber(text);

  if (number <= 0) {
    throw new Error(`'${text}' must be greater than 0`);
  }

  return number;
}

/** Check `text` compiles as a regular expression and return it unchanged. */
export function toRegex(text: string): string {
  try {
    new RegExp(text);
  } catch (e) {
    throw new Error(`Invalid regular expression: ${(e as Error).message}`);
  }

  return text;
}

/** Parse comma separated choices: `"red, green"` -> `["red", "green"]`. */
export function toChoices(text: string): string[] {
  const choices = text
    .split(",")
    .map((choice) => choice.trim())
    .filter(Boolean);

  if (choices.length === 0) {
    throw new Error("Enter at least one choice");
  }

  if (new Set(choices).size !== choices.length) {
    throw new Error("Choices must be unique");
  }

  return choices;
}

/** Parse computer options, a JSON object: `{"sep": ", "}`. */
export function toOptions(text: string): Record<string, unknown> {
  let options: unknown;

  try {
    options = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }

  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new Error("Options must be a JSON object");
  }

  return options as Record<string, unknown>;
}

// -----------------------
// constraints
// -----------------------

/** The parser of each constraint keyword, the questions come from Python through `meta.json`. */
export const PARSERS: Record<string, Parser> = {
  minLength: toNonNegativeInt,
  maxLength: toNonNegativeInt,
  pattern: toRegex,
  not: (text) => ({ enum: toChoices(text) }),
  exclusiveMinimum: toNumber,
  minimum: toNumber,
  exclusiveMaximum: toNumber,
  maximum: toNumber,
  multipleOf: toPositiveNumber,
  minItems: toNonNegativeInt,
  maxItems: toNonNegativeInt,
};

function constraints(kind: keyof typeof meta.constraints): Constraint[] {
  return meta.constraints[kind].map(([keyword = "", question = ""]) => ({
    keyword,
    question,
    parse: PARSERS[keyword] ?? unsupported(keyword),
  }));
}

/** A keyword added in Python with no parser here yet, `meta.test.ts` fails until one is added. */
function unsupported(keyword: string): Parser {
  return () => {
    throw new Error(`'${keyword}' is not supported by the editor yet`);
  };
}

export const STRING_CONSTRAINTS = constraints("string");

export const NUMBER_CONSTRAINTS = constraints("number");

export const ARRAY_CONSTRAINTS = constraints("array");

const BOUNDS: [low: string, high: string, equalOk: boolean][] = [
  ["minLength", "maxLength", true],
  ["minItems", "maxItems", true],
  ["minimum", "maximum", true],
  ["minimum", "exclusiveMaximum", false],
  ["exclusiveMinimum", "maximum", false],
  ["exclusiveMinimum", "exclusiveMaximum", false],
];

/** Return why no value can satisfy the bounds of `schema`, or `null` when they can. */
export function checkBounds(schema: Schema): string | null {
  for (const [low, high, equalOk] of BOUNDS) {
    if (!(low in schema && high in schema)) {
      continue;
    }

    const [lowValue, highValue] = [schema[low] as number, schema[high] as number];

    if (lowValue > highValue || (!equalOk && lowValue === highValue)) {
      return `${low} (${lowValue}) must be less than ${high} (${highValue})`;
    }
  }

  return null;
}
