/**
 * Computers, mirroring `schemify/computers.py`: functions filling a property from other values
 * instead of asking for it, run once the data is entered.
 *
 * Each computer is called like Python calls it, `fn(*values, **options)`: the arguments are
 * bound to its parameters by the Python signature in `meta.json`, so a wrong option fails the
 * same way. Values are JSON, so Python's `int` / `float` difference (`2` vs `2.0`) is lost.
 */

import { toCardinal as arCardinal } from "n2words/ar";
import { toCardinal as enCardinal } from "n2words/en";
import { toCardinal as frCardinal } from "n2words/fr";
export const KEYWORD = "x-compute";

import meta from "./meta.json";
import type { Schema } from "./models.ts";

/** Raised when a computed property can not be computed (bad path, bad value, ...). */
export class ComputeError extends Error {}

/** Raised when a computer name is not registered, like Python's `NotSupportedError`. */
export class NotSupportedError extends Error {}

/** A Python `TypeError` / `ValueError` / ... raised by a computer, caught as a `ComputeError`. */
class PyError extends Error {}

/** A source path has no value in the data, like a skipped optional property. */
class MissingError extends Error {}

const SKIP = Symbol("skip");

type Bound = Record<string, unknown>;

type ComputeFn = (bound: Bound) => unknown;

/** Fill every `x-compute` property of `data` in place, and return it, like `compute`. */
export function compute(schema: Schema, data: unknown, root: unknown = data): unknown {
  if (Array.isArray(data)) {
    for (const item of data) {
      compute((schema.items ?? {}) as Schema, item, root);
    }

    return data;
  }

  if (!isObject(data)) {
    return data;
  }

  const properties = (schema.properties ?? {}) as Record<string, Schema>;

  for (const [name, propertySchema] of Object.entries(properties)) {
    if (Object.hasOwn(data, name) && !(KEYWORD in propertySchema)) {
      compute(propertySchema, data[name], root);
    }
  }

  for (const [name, propertySchema] of Object.entries(properties)) {
    if (!(KEYWORD in propertySchema)) {
      continue;
    }

    const value = apply(propertySchema[KEYWORD] as Schema, name, data, root, properties);

    if (value !== SKIP) {
      data[name] = value;
    }
  }

  // computed properties were added last, put every property back in the schema order
  for (const name of Object.keys(properties)) {
    if (Object.hasOwn(data, name)) {
      const value = data[name];

      delete data[name];
      data[name] = value;
    }
  }

  return data;
}

function apply(
  spec: Schema,
  name: string,
  data: Record<string, unknown>,
  root: unknown,
  properties: Schema,
): unknown {
  const fnName = String(spec.fn);
  const fn = computerFn(fnName);
  const sources = (spec.from ?? []) as string[] | Record<string, string>;
  const options = (spec.options ?? {}) as Record<string, unknown>;
  const paths = Array.isArray(sources) ? sources : Object.values(sources);

  for (const path of paths) {
    const first = path.split(/[.[?]/, 1)[0] ?? "";

    if (!path.startsWith("$") && !Object.hasOwn(properties, first)) {
      throw new ComputeError(`Can not compute '${name}': '${path}' is not a property`);
    }
  }

  let args: unknown[] = [];
  let kwargs: Record<string, unknown> = {};

  try {
    if (Array.isArray(sources)) {
      args = sources.map((path) => resolve(path, data, root));
    } else {
      kwargs = Object.fromEntries(
        Object.entries(sources).map(([alias, path]) => [alias, resolve(path, data, root)]),
      );
    }
  } catch (e) {
    if (e instanceof MissingError) {
      return "default" in spec ? spec.default : SKIP;
    }

    throw e;
  }

  try {
    return fn(args, { ...kwargs, ...options });
  } catch (e) {
    if (e instanceof PyError) {
      throw new ComputeError(`Can not compute '${name}' with '${fnName}': ${e.message}`);
    }

    throw e;
  }
}

const TOKEN = /([^.[\]]+)|\[(\d+|\*)\]/g;

/**
 * The value at `path` in `data`, or from `root` when the path starts with `$.`.
 * Throws a `MissingError` when nothing is there and the path does not end with `?`.
 */
export function resolve(path: string, data: unknown, root: unknown = data): unknown {
  const optional = path.endsWith("?");
  let rest = optional ? path.slice(0, -1) : path;
  let current = data;

  if (rest.startsWith("$")) {
    current = root;
    rest = rest.slice(1).replace(/^\.+/, "");
  }

  let values: unknown[] = [current];
  let spread = false;

  for (const [, name, index] of rest.matchAll(TOKEN)) {
    if (index === "*") {
      values = values.flatMap((value) => (Array.isArray(value) ? value : []));
      spread = true;
      continue;
    }

    const found = values.map((value) => get(value, name ?? Number(index)));

    // a spread path skips the items missing the value, like an optional item price
    values = spread ? found.filter((value) => value !== SKIP) : found;
  }

  if (spread) {
    return values;
  }

  if (values[0] === SKIP) {
    if (optional) {
      return null;
    }

    throw new MissingError(rest);
  }

  return values[0];
}

/** `container[key]` like Python: a list or string by index, a dict by key, else missing. */
function get(container: unknown, key: string | number): unknown {
  if (typeof key === "number") {
    if (Array.isArray(container)) {
      return key < container.length ? container[key] : SKIP;
    }

    if (typeof container === "string") {
      const chars = [...container];

      return key < chars.length ? chars[key] : SKIP;
    }

    return SKIP;
  }

  return isObject(container) && Object.hasOwn(container, key) ? container[key] : SKIP;
}

// -----------------------
// calling like Python
// -----------------------

type Param = { name: string; kind: "positional" | "var" | "keyword" | "varkw"; required: boolean };

/** The parameters of a Python signature: `join(*values: Any, sep: str = ' ') -> str`. */
export function parameters(signature: string): Param[] {
  const inside = signature.slice(signature.indexOf("(") + 1, signature.lastIndexOf(")"));
  const params: Param[] = [];
  let afterVar = false;
  let depth = 0;
  let part = "";

  // split on the top level commas only, `dict[str, Any]` holds one
  for (const char of `${inside},`) {
    depth += "[(".includes(char) ? 1 : ")]".includes(char) ? -1 : 0;

    if (char !== "," || depth > 0) {
      part += char;
      continue;
    }

    const text = part.trim();
    const name = text.split(/[:=]/, 1)[0]?.trim() ?? "";

    part = "";

    if (!text) {
      continue;
    }

    if (name.startsWith("**")) {
      params.push({ name: name.slice(2), kind: "varkw", required: false });
    } else if (name.startsWith("*")) {
      params.push({ name: name.slice(1), kind: "var", required: false });
      afterVar = true;
    } else {
      const kind = afterVar ? "keyword" : "positional";

      params.push({ name, kind, required: !text.includes("=") });
    }
  }

  return params;
}

/** Bind `args` and `kwargs` to `params` like a Python call, or raise its `TypeError`. */
function bind(fnName: string, params: Param[], args: unknown[], kwargs: Bound): Bound {
  const bound: Bound = {};
  const positional = params.filter((param) => param.kind === "positional");
  const varParam = params.find((param) => param.kind === "var");
  const varkw = params.find((param) => param.kind === "varkw");

  if (args.length > positional.length && !varParam) {
    throw new PyError(
      `${fnName}() takes ${positional.length} positional arguments but ${args.length} were given`,
    );
  }

  positional.forEach((param, i) => {
    if (i < args.length) {
      bound[param.name] = args[i];
    }
  });

  if (varParam) {
    bound[varParam.name] = args.slice(positional.length);
  }

  const extra: Bound = {};

  for (const [name, value] of Object.entries(kwargs)) {
    const param = params.find(
      (p) => p.name === name && (p.kind === "positional" || p.kind === "keyword"),
    );

    if (param && name in bound) {
      throw new PyError(`${fnName}() got multiple values for argument '${name}'`);
    }

    if (param) {
      bound[name] = value;
    } else if (varkw) {
      extra[name] = value;
    } else {
      throw new PyError(`${fnName}() got an unexpected keyword argument '${name}'`);
    }
  }

  if (varkw) {
    bound[varkw.name] = extra;
  }

  for (const param of params) {
    if (param.required && !(param.name in bound)) {
      throw new PyError(`${fnName}() missing required argument: '${param.name}'`);
    }
  }

  return bound;
}

type Computer = { signature: string };

/** The computer `name` called like Python, or a `NotSupportedError` naming the known ones. */
function computerFn(name: string): (args: unknown[], kwargs: Bound) => unknown {
  const key = name.toLowerCase();
  const info = (meta.computers as Record<string, Computer>)[key];
  const fn = COMPUTERS[key];

  if (!info || !fn) {
    const supported = Object.keys(meta.computers).sort().join(", ");

    throw new NotSupportedError(`Computer '${name}' is not supported, supported: ${supported}`);
  }

  const params = parameters(info.signature);

  return (args, kwargs) => fn(bind(key, params, args, kwargs));
}

// -----------------------
// Python values
// -----------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Python's `str()` of a JSON value: `True`, `None`, `[1, 'a']`. */
export function pyStr(value: unknown): string {
  return typeof value === "string" ? value : pyRepr(value);
}

/** Python's `repr()` of a JSON value: `'a'`, `True`, `{'k': None}`. */
export function pyRepr(value: unknown): string {
  if (value === null || value === undefined) {
    return "None";
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  if (typeof value === "string") {
    return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
  }

  if (Array.isArray(value)) {
    return `[${value.map(pyRepr).join(", ")}]`;
  }

  if (isObject(value)) {
    const items = Object.entries(value).map(([k, v]) => `${pyRepr(k)}: ${pyRepr(v)}`);

    return `{${items.join(", ")}}`;
  }

  return String(value);
}

/** Python truthiness: `0`, `""`, `[]`, `{}`, `None` and `False` are false. */
export function truthy(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isObject(value)) {
    return Object.keys(value).length > 0;
  }

  return Boolean(value);
}

/** Python `==` of JSON values, where `True == 1`. */
export function pyEquals(a: unknown, b: unknown): boolean {
  const numeric = (v: unknown) => typeof v === "number" || typeof v === "boolean";

  if (numeric(a) && numeric(b)) {
    return Number(a) === Number(b);
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => pyEquals(item, b[i]));
  }

  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);

    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.hasOwn(b, key) && pyEquals(a[key], b[key]))
    );
  }

  return a === b;
}

/** A number for arithmetic, `True` counts as `1`, anything else is Python's `TypeError`. */
function num(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "boolean") {
    return Number(value);
  }

  throw new PyError(`unsupported operand type: ${pyRepr(value)} is not a number`);
}

function int(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new PyError(`'${name}' must be an integer, not ${pyRepr(value)}`);
  }

  return value;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new PyError(`'${name}' must be a string, not ${pyRepr(value)}`);
  }

  return value;
}

function list(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new PyError(`'${name}' must be a list, not ${pyRepr(value)}`);
  }

  return value;
}

/** Spread lists one level, so `sum(a, items[*].price)` sums every value. */
function flat(values: unknown): unknown[] {
  return (values as unknown[]).flatMap((value) => (Array.isArray(value) ? value : [value]));
}

/** Drop `None` and empty strings, like a skipped optional source. */
function present(values: unknown): unknown[] {
  return flat(values).filter((value) => value !== null && value !== "");
}

function divide(a: unknown, b: unknown): number {
  if (num(b) === 0) {
    throw new PyError("division by zero");
  }

  return num(a) / num(b);
}

/** Python's `round`, halves to even. */
// shortcut: rounds `x * 10**digits` in floats, Python rounds the exact decimal; fine for money
export function pyRound(x: number, digits = 0): number {
  const scale = 10 ** digits;
  const scaled = x * scale;
  const rounded = Math.abs(scaled % 1) === 0.5 ? 2 * Math.round(scaled / 2) : Math.round(scaled);

  return rounded / scale;
}

function pyMin(values: unknown[], pick: (a: number, b: number) => boolean): unknown {
  if (values.length === 0) {
    throw new PyError("arg is an empty sequence");
  }

  return values.reduce((best, value) => (pick(num(value), num(best)) ? value : best));
}

// -----------------------
// dates
// -----------------------

type Day = { y: number; m: number; d: number; h: number; mi: number; s: number };

const ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Parse an ISO date or datetime like `datetime.fromisoformat`, its offset is ignored. */
function isoDay(value: unknown): Day {
  const match = ISO.exec(String(value));
  const [y, m, d, h, mi, s] = (match?.slice(1, 7) ?? []).map((part) => Number(part ?? 0));

  if (
    !match ||
    y === undefined ||
    m === undefined ||
    d === undefined ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > daysIn(y, m) ||
    (h ?? 0) > 23 ||
    (mi ?? 0) > 59 ||
    (s ?? 0) > 59
  ) {
    throw new PyError(`Invalid isoformat string: ${pyRepr(value)}`);
  }

  return { y, m, d, h: h ?? 0, mi: mi ?? 0, s: s ?? 0 };
}

/** `isoDay`, computing today's date when there is none, like Python's `_date_or_today`. */
function dayOrToday(value: unknown): Day {
  return isoDay(value || localIso(new Date(), false));
}

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function utc(day: Day): Date {
  const date = new Date(Date.UTC(2000, day.m - 1, day.d, day.h, day.mi, day.s));

  date.setUTCFullYear(day.y); // Date.UTC maps years 0 to 99 to 1900 to 1999

  return date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function localIso(date: Date, time: boolean): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;

  if (!time) {
    return day;
  }

  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const zone = `${sign}${two(Math.floor(Math.abs(offset) / 60))}:${two(Math.abs(offset) % 60)}`;

  return `${day}T${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}${zone}`;
}

function addMonths(value: unknown, months: number): string {
  const day = dayOrToday(value);
  const total = day.m - 1 + months;
  const year = day.y + Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;

  return isoDate(utc({ ...day, y: year, m: month, d: Math.min(day.d, daysIn(year, month)) }));
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Python's `strftime` in the C locale. */
// shortcut: the common codes only, an unknown code is kept as typed; add codes when asked for
function strftime(day: Day, fmt: string): string {
  const two = (n: number) => String(n).padStart(2, "0");
  const date = utc(day);
  const weekday = WEEKDAYS[date.getUTCDay()] ?? "";
  const month = MONTHS[day.m - 1] ?? "";
  const yearDay = Math.round(
    (date.getTime() - utc({ ...day, m: 1, d: 1, h: 0, mi: 0, s: 0 }).getTime()) / 864e5,
  );
  const codes: Record<string, string> = {
    a: weekday.slice(0, 3),
    A: weekday,
    b: month.slice(0, 3),
    B: month,
    d: two(day.d),
    m: two(day.m),
    y: two(day.y % 100),
    Y: String(day.y).padStart(4, "0"),
    H: two(day.h),
    I: two(day.h % 12 || 12),
    p: day.h < 12 ? "AM" : "PM",
    M: two(day.mi),
    S: two(day.s),
    j: String(yearDay + 1).padStart(3, "0"),
    "%": "%",
  };

  return fmt.replace(/%(.)/g, (code, letter: string) => codes[letter] ?? code);
}

// -----------------------
// expr
// -----------------------

const MAX_EXPONENT = 1000;

const FUNCTIONS: Record<string, (args: unknown[]) => unknown> = {
  round: ([x, digits]) => pyRound(num(x), digits === undefined ? 0 : num(digits)),
  min: (args) => pyMin(args.length === 1 ? list(args[0], "min") : args, (a, b) => a < b),
  max: (args) => pyMin(args.length === 1 ? list(args[0], "max") : args, (a, b) => a > b),
  abs: ([x]) => Math.abs(num(x)),
  sum: ([values]) => list(values, "sum").reduce((total: number, v) => total + num(v), 0),
};

const EXPR_TOKEN =
  /\s*(?:(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|([A-Za-z_]\w*)|(\*\*|\/\/|==|!=|<=|>=|[-+*/%<>()[\],.:]))/y;

type Token = { kind: "number" | "string" | "name" | "op"; text: string };

/**
 * Evaluate a safe expression of the named sources: `"round(qty * price * 1.15, 2)"`, the same
 * grammar Python's `expr` allows. Anything else is an error, nothing is `eval`ed.
 */
function expr(source: string, names: Bound): unknown {
  const tokens: Token[] = [];

  EXPR_TOKEN.lastIndex = 0;

  while (EXPR_TOKEN.lastIndex < source.trimEnd().length) {
    const match = EXPR_TOKEN.exec(source);

    if (!match) {
      throw new PyError(`Invalid expression '${source}': invalid syntax`);
    }

    const [, number, string, name, op] = match;

    if (number !== undefined) {
      tokens.push({ kind: "number", text: number });
    } else if (string !== undefined) {
      tokens.push({ kind: "string", text: string });
    } else if (name !== undefined) {
      tokens.push({ kind: "name", text: name });
    } else {
      tokens.push({ kind: "op", text: op ?? "" });
    }
  }

  let at = 0;
  const peek = () => tokens[at]?.text;
  const notAllowed = (): never => {
    throw new PyError(`'${source}' is not allowed in an expression`);
  };
  const expect = (text: string) => {
    if (tokens[at]?.text !== text) {
      throw new PyError(`Invalid expression '${source}': invalid syntax`);
    }

    at += 1;
  };

  // each level returns a thunk, so `a if c else b` and `and` / `or` only run the branch they need
  type Lazy = () => unknown;

  const test = (): Lazy => {
    const body = orExpr();

    if (peek() !== "if") {
      return body;
    }

    at += 1;

    const condition = orExpr();

    expect("else");

    const otherwise = test();

    return () => (truthy(condition()) ? body() : otherwise());
  };

  const orExpr = (): Lazy => {
    const parts = [andExpr()];

    while (peek() === "or") {
      at += 1;
      parts.push(andExpr());
    }

    return parts.length === 1 ? (parts[0] as Lazy) : () => parts.some((part) => truthy(part()));
  };

  const andExpr = (): Lazy => {
    const parts = [notExpr()];

    while (peek() === "and") {
      at += 1;
      parts.push(notExpr());
    }

    return parts.length === 1 ? (parts[0] as Lazy) : () => parts.every((part) => truthy(part()));
  };

  const notExpr = (): Lazy => {
    if (peek() === "not") {
      at += 1;

      const operand = notExpr();

      return () => !truthy(operand());
    }

    return comparison();
  };

  const COMPARE: Record<string, (a: unknown, b: unknown) => boolean> = {
    "==": pyEquals,
    "!=": (a, b) => !pyEquals(a, b),
    "<": (a, b) => order(a, b) < 0,
    "<=": (a, b) => order(a, b) <= 0,
    ">": (a, b) => order(a, b) > 0,
    ">=": (a, b) => order(a, b) >= 0,
  };

  const comparison = (): Lazy => {
    const parts = [arith()];
    const ops: string[] = [];

    while (peek() !== undefined && (peek() as string) in COMPARE) {
      ops.push(peek() as string);
      at += 1;
      parts.push(arith());
    }

    if (ops.length === 0) {
      return parts[0] as Lazy;
    }

    return () => {
      const values = parts.map((part) => part());

      return ops.every((op, i) => COMPARE[op]?.(values[i], values[i + 1]));
    };
  };

  const binary = (next: () => Lazy, ops: string[]) => (): Lazy => {
    let left = next();

    while (ops.includes(peek() ?? "")) {
      const op = peek() as string;

      at += 1;

      const [a, b] = [left, next()];

      left = () => arithmetic(op, a(), b());
    }

    return left;
  };

  const unary = (): Lazy => {
    const op = peek();

    if (op === "-" || op === "+") {
      at += 1;

      const operand = unary();

      return () => (op === "-" ? -num(operand()) : num(operand()));
    }

    return power();
  };

  const term = binary(unary, ["*", "/", "//", "%"]);

  const arith = binary(term, ["+", "-"]);

  const power = (): Lazy => {
    const base = atom();

    if (peek() !== "**") {
      return base;
    }

    at += 1;

    const exponent = unary(); // right associative, `-2 ** 2` is `-(2 ** 2)`

    return () => {
      const value = exponent();

      if (Math.abs(num(value)) > MAX_EXPONENT) {
        throw new PyError(`Exponent ${pyStr(value)} is too large`);
      }

      return arithmetic("**", base(), value);
    };
  };

  const items = (close: string): Lazy[] => {
    const parts: Lazy[] = [];

    while (peek() !== close) {
      parts.push(test());

      if (peek() !== close) {
        expect(",");
      }
    }

    at += 1;

    return parts;
  };

  const atom = (): Lazy => {
    const token = tokens[at];

    at += 1;

    if (!token) {
      throw new PyError(`Invalid expression '${source}': unexpected end`);
    }

    let value: Lazy;

    if (token.kind === "number") {
      const number = Number(token.text);

      value = () => number;
    } else if (token.kind === "string") {
      const escapes: Record<string, string> = { n: "\n", t: "\t" };
      const string = token.text
        .slice(1, -1)
        .replace(/\\(.)/g, (_, char: string) => escapes[char] ?? char);

      value = () => string;
    } else if (token.kind === "name" && peek() === "(") {
      const fn = FUNCTIONS[token.text] ?? notAllowed();

      at += 1;

      const args = items(")");

      value = () => {
        try {
          return fn(args.map((arg) => arg()));
        } catch (e) {
          throw e instanceof PyError ? e : new PyError((e as Error).message);
        }
      };
    } else if (token.kind === "name" && Object.hasOwn(names, token.text)) {
      const name = token.text;

      value = () => names[name];
    } else if (token.text === "(") {
      const parts = items(")");

      value = parts.length === 1 ? (parts[0] as Lazy) : () => parts.map((part) => part());
    } else if (token.text === "[") {
      const parts = items("]");

      value = () => parts.map((part) => part());
    } else {
      return notAllowed();
    }

    // attributes, subscripts and calls of a value are not allowed
    if (peek() === "." || peek() === "[" || peek() === "(") {
      notAllowed();
    }

    return value;
  };

  const tree = test();

  if (at < tokens.length) {
    // a keyword like `for` or `lambda`, or a stray token
    if (tokens[at]?.kind === "name" || tokens[at]?.text === ":") {
      notAllowed();
    }

    throw new PyError(`Invalid expression '${source}': invalid syntax`);
  }

  return tree();
}

function order(a: unknown, b: unknown): number {
  if (typeof a === "string" && typeof b === "string") {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  return num(a) - num(b);
}

function arithmetic(op: string, a: unknown, b: unknown): unknown {
  if (op === "+" && typeof a === "string" && typeof b === "string") {
    return a + b;
  }

  const [x, y] = [num(a), num(b)];

  switch (op) {
    case "+":
      return x + y;
    case "-":
      return x - y;
    case "*":
      return x * y;
    case "/":
      return divide(x, y);
    case "//":
      return Math.floor(divide(x, y));
    case "%":
      if (y === 0) {
        throw new PyError("integer modulo by zero");
      }

      return x - y * Math.floor(x / y); // Python's sign follows the divisor
    default:
      return x ** y;
  }
}

// -----------------------
// number to words
// -----------------------

/** The languages bundled from n2words. */
// shortcut: en, ar and fr only to keep the bundle small, add a language when someone needs it
const SPELLERS: Record<string, (n: number) => string> = {
  en: enCardinal,
  ar: arCardinal,
  fr: frCardinal,
};

/** `words`: the number in `lang`, between the optional `prefix` and `suffix`. */
function words({ value, lang = "en", prefix = "", suffix = "" }: Bound): string {
  const speller = SPELLERS[String(lang)];

  if (!speller) {
    throw new PyError(
      `Language '${pyStr(lang)}' is not supported in the editor, only en, ar and fr`,
    );
  }

  const n = num(value);

  try {
    return present([prefix, speller(n), suffix])
      .map(pyStr)
      .join(" ");
  } catch (e) {
    throw e instanceof PyError ? e : new PyError((e as Error).message);
  }
}

// -----------------------
// the computers, by name
// -----------------------

const chars = (value: unknown) => [...pyStr(value)];

const NO_FALLBACK = Symbol("no fallback");

export const COMPUTERS: Record<string, ComputeFn> = {
  // text
  join: ({ values, sep = " " }) => present(values).map(pyStr).join(text(sep, "sep")),
  concat: ({ values }) => present(values).map(pyStr).join(""),
  template: ({ template, values }) =>
    text(template, "template").replace(/\{\{|\}\}|\{([^{}]*)\}/g, (match, name?: string) => {
      if (name === undefined) {
        return match[0] as string;
      }

      const all = values as Bound;

      // shortcut: plain `{name}` fields only, no `{name:.2f}` format specs
      if (!Object.hasOwn(all, name)) {
        throw new PyError(`'${name}'`);
      }

      return pyStr(all[name]);
    }),
  upper: ({ value }) => pyStr(value).toUpperCase(),
  lower: ({ value }) => pyStr(value).toLowerCase(),
  title: ({ value }) =>
    pyStr(value).replace(/\p{L}+/gu, (word) => {
      const [first = "", ...rest] = [...word];

      return first.toUpperCase() + rest.join("").toLowerCase();
    }),
  capitalize: ({ value }) => {
    const [first = "", ...rest] = chars(value);

    return first.toUpperCase() + rest.join("").toLowerCase();
  },
  trim: ({ value }) => pyStr(value).trim(),
  replace: ({ value, old, new: replacement }) =>
    pyStr(value).replaceAll(text(old, "old"), text(replacement, "new")),
  slice: ({ value, start = 0, end = null }) => {
    const from = int(start, "start");
    const to = end === null ? undefined : int(end, "end");

    if (typeof value === "string") {
      return [...value].slice(from, to).join("");
    }

    return list(value, "value").slice(from, to);
  },
  initials: ({ values, sep = "" }) =>
    present(values)
      .flatMap((value) => pyStr(value).split(/\s+/).filter(Boolean))
      .map((word) => [...word][0]?.toUpperCase() ?? "")
      .join(text(sep, "sep")),
  slug: ({ value }) =>
    pyStr(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, ""),
  length: ({ value }) => {
    if (typeof value === "string") {
      return [...value].length;
    }

    if (isObject(value)) {
      return Object.keys(value).length;
    }

    return list(value, "value").length;
  },
  pad: ({ value, width, char = "0" }) => {
    if ([...text(char, "char")].length !== 1) {
      throw new PyError("The fill character must be exactly one character long");
    }

    const characters = chars(value);
    const missing = Math.max(int(width, "width") - characters.length, 0);

    return String(char).repeat(missing) + characters.join("");
  },
  mask: ({ value, keep = 4, char = "*" }) => {
    const characters = chars(value);
    const hidden = Math.max(characters.length - int(keep, "keep"), 0);

    return text(char, "char").repeat(hidden) + characters.slice(hidden).join("");
  },

  // numbers
  sum: ({ values }) => flat(values).reduce((total: number, v) => total + num(v), 0),
  subtract: ({ value, values }) =>
    flat(values).reduce((total: number, v) => total - num(v), num(value)),
  multiply: ({ values }) => flat(values).reduce((total: number, v) => total * num(v), 1),
  divide: ({ value, divisor }) => divide(value, divisor),
  average: ({ values }) => {
    const all = flat(values);

    if (all.length === 0) {
      throw new PyError("fmean requires at least one data point");
    }

    return all.reduce((total: number, v) => total + num(v), 0) / all.length;
  },
  min: ({ values }) => pyMin(flat(values), (a, b) => a < b),
  max: ({ values }) => pyMin(flat(values), (a, b) => a > b),
  abs: ({ value }) => Math.abs(num(value)),
  round: ({ value, digits = 2 }) => pyRound(num(value), int(digits, "digits")),
  percent: ({ part, whole }) => divide(part, whole) * 100,
  percent_of: ({ value, rate }) => (num(value) * num(rate)) / 100,
  expr: ({ expr: source, values }) => expr(text(source, "expr"), values as Bound),

  // number to words
  words,

  // dates
  today: () => localIso(new Date(), false),
  now: () => localIso(new Date(), true),
  add_days: ({ value, days = 0 }) => {
    const date = utc(dayOrToday(value));

    date.setUTCDate(date.getUTCDate() + int(days, "days"));

    return isoDate(date);
  },
  add_months: ({ value, months = 0 }) => addMonths(value, int(months, "months")),
  add_years: ({ value, years = 0 }) => addMonths(value, int(years, "years") * 12),
  days_between: ({ start, end }) => {
    const [a, b] = [isoDay(start), dayOrToday(end)];
    const midnight = (day: Day) => utc({ ...day, h: 0, mi: 0, s: 0 }).getTime();

    return Math.round((midnight(b) - midnight(a)) / 864e5);
  },
  age: ({ birth_date, on = null }) => {
    const born = isoDay(birth_date);
    const day = dayOrToday(on);
    const before = day.m < born.m || (day.m === born.m && day.d < born.d);

    return day.y - born.y - (before ? 1 : 0);
  },
  year: ({ value }) => dayOrToday(value).y,
  month: ({ value }) => dayOrToday(value).m,
  day: ({ value }) => dayOrToday(value).d,
  weekday: ({ value, fmt = "%A" }) =>
    strftime({ ...dayOrToday(value), h: 0, mi: 0, s: 0 }, text(fmt, "fmt")),
  format_date: ({ value, fmt = "%d/%m/%Y" }) =>
    strftime(isoDay(value || localIso(new Date(), true)), text(fmt, "fmt")),
  start_of_month: ({ value }) => isoDate(utc({ ...dayOrToday(value), d: 1 })),
  end_of_month: ({ value }) => {
    const day = dayOrToday(value);

    return isoDate(utc({ ...day, d: daysIn(day.y, day.m) }));
  },

  // logic, lookup and misc
  coalesce: ({ values }) => {
    const all = present(values);

    if (all.length === 0) {
      throw new PyError("All values are empty");
    }

    return all[0];
  },
  if_else: ({ condition, then, otherwise }) => (truthy(condition) ? then : otherwise),
  equals: ({ value, other }) => pyEquals(value, other),
  lookup: ({ key, map, fallback = NO_FALLBACK }) => {
    if (!isObject(map)) {
      throw new PyError(`'map' must be an object, not ${pyRepr(map)}`);
    }

    if (Object.hasOwn(map, pyStr(key))) {
      return map[pyStr(key)];
    }

    if (fallback === NO_FALLBACK) {
      throw new PyError(`'${pyStr(key)}' is not in the lookup map`);
    }

    return fallback;
  },
  constant: ({ value }) => value,
  count: ({ values }) => list(values, "values").length,
  count_if: ({ values, value }) => list(values, "values").filter((v) => pyEquals(v, value)).length,
  unique: ({ values }) =>
    list(values, "values").filter(
      (v, i, all) => all.findIndex((other) => pyEquals(other, v)) === i,
    ),
  uuid: () => crypto.randomUUID(),
};
