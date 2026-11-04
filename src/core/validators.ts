/**
 * Parsers and checks for the editor's answers, mirroring `schemify/validators.py`.
 *
 * A parser turns an answer into a value, or throws an `Error` with a readable message.
 */

import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { pyRepr } from "./computers.ts";
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

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DATETIME =
  /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,6})?)?)?(Z|[+-]\d{2}:\d{2})?$/;

function isDate(text: string): boolean {
  const [, y, m, d] = (DATE.exec(text) ?? []).map(Number);

  if (!y || !m || !d) {
    return false;
  }

  const days = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;

  return d <= days;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Parse an ISO date, returned as an ISO string: `"2026-11-04"`. */
export function toDate(text: string): string {
  const trimmed = text.trim();

  if (!isDate(trimmed)) {
    throw new Error(`Invalid isoformat string: '${trimmed}'`);
  }

  return trimmed;
}

/**
 * Parse an ISO datetime, returned as an RFC 3339 string.
 * A datetime without offset is taken as local time, RFC 3339 requires the offset.
 */
export function toDatetime(text: string): string {
  const trimmed = text.trim();
  const match = DATETIME.exec(trimmed);
  const [, day = "", h = "00", mi = "00", s = "00", fraction = "", zone] = match ?? [];

  if (!match || !isDate(day) || Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) {
    throw new Error(`Invalid isoformat string: '${trimmed}'`);
  }

  const micro = fraction ? `.${fraction.slice(1).padEnd(6, "0")}` : "";
  const offset = zone === "Z" ? "+00:00" : (zone ?? localOffset(`${day}T${h}:${mi}:${s}`));

  return `${day}T${h}:${mi}:${s}${micro}${offset}`;
}

function localOffset(naive: string): string {
  const minutes = -new Date(naive).getTimezoneOffset();
  const two = (n: number) => String(Math.floor(n)).padStart(2, "0");

  return `${minutes >= 0 ? "+" : "-"}${two(Math.abs(minutes) / 60)}:${two(Math.abs(minutes) % 60)}`;
}

/**
 * Parse one computer option typed in its own input, typed by its example value:
 * a string or `null` example keeps the text, a number, boolean, list or object one parses JSON,
 * and Python's `"value"` placeholder (an `Any` parameter) parses JSON, else keeps the text.
 */
export function toOption(text: string, example: unknown): unknown {
  if (example === "value") {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  if (typeof example === "string" || example === null) {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }
}

/**
 * Build a parser for a default value of `schema`, like `default_parser`.
 *
 * The answer is read as JSON (`42`, `true`, `["a"]`), else as text, the first matching `schema`
 * is kept: `42` is a number for an integer and the text `"42"` for a string.
 */
export function defaultParser(schema: Schema): Parser {
  return (text) => {
    const candidates: unknown[] = [text.trim()];

    try {
      candidates.unshift(JSON.parse(text));
    } catch {
      // not JSON, only the text is tried
    }

    const errors = candidates.map((candidate) => checkValue(schema, candidate));
    const index = errors.indexOf(null);

    if (index === -1) {
      throw new Error(errors[0] ?? "");
    }

    return candidates[index];
  };
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

// -----------------------
// json schema
// -----------------------

// the formats Python's jsonschema checks without extras, email only needs an `@` there too
const ajv = addFormats(new Ajv2020({ strict: false, verbose: true, addUsedSchema: false }), [
  "date",
  "time",
  "ipv4",
  "ipv6",
  "regex",
  "uuid",
]).addFormat("email", (text: string) => text.includes("@"));

ajv.addFormat("idn-email", (text: string) => text.includes("@"));

const compiled = new WeakMap<Schema, ValidateFunction>();

/** Return why `value` does not match `schema`, or `null` when it does, like `check_value`. */
export function checkValue(schema: Schema, value: unknown): string | null {
  let validate = compiled.get(schema);

  try {
    validate ??= ajv.compile(schema);
  } catch (e) {
    return (e as Error).message;
  }

  compiled.set(schema, validate);

  const error = validate(value) ? undefined : validate.errors?.[0];

  return error ? message(error, value) : null;
}

/** Ajv's first error in jsonschema's words: `'R' is too short`. */
function message(error: ErrorObject, root: unknown): string {
  const value = error.instancePath
    .split("/")
    .slice(1)
    .reduce<unknown>(
      (at, key) => (at as Record<string, unknown>)[key.replaceAll("~1", "/").replaceAll("~0", "~")],
      root,
    );
  const params = error.params as Record<string, unknown>;
  const schema = error.schema;
  const v = pyRepr(value);

  switch (error.keyword) {
    case "type":
      return `${v} is not of type ${pyRepr(schema)}`;
    case "minLength":
    case "minItems":
      return `${v} is too short`;
    case "maxLength":
    case "maxItems":
      return `${v} is too long`;
    case "minimum":
      return `${v} is less than the minimum of ${pyRepr(schema)}`;
    case "maximum":
      return `${v} is greater than the maximum of ${pyRepr(schema)}`;
    case "exclusiveMinimum":
      return `${v} is less than or equal to the minimum of ${pyRepr(schema)}`;
    case "exclusiveMaximum":
      return `${v} is greater than or equal to the maximum of ${pyRepr(schema)}`;
    case "multipleOf":
      return `${v} is not a multiple of ${pyRepr(schema)}`;
    case "format":
      return `${v} is not a ${pyRepr(params.format)}`;
    case "pattern":
      return `${v} does not match ${pyRepr(schema)}`;
    case "enum":
      return `${v} is not one of ${pyRepr(schema)}`;
    case "required":
      return `${pyRepr(params.missingProperty)} is a required property`;
    case "additionalProperties":
      return `Additional properties are not allowed (${pyRepr(params.additionalProperty)} was unexpected)`;
    case "uniqueItems":
      return `${v} has non-unique elements`;
    case "not":
      return `${v} should not be valid under ${pyRepr(schema)}`;
    default:
      return `${v} ${error.message ?? "is not valid"}`;
  }
}
