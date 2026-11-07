// Mirrors `tests/test_computers.py`, same cases.

import { describe, expect, test } from "vitest";
import {
  COMPUTERS,
  ComputeError,
  compute,
  NotSupportedError,
  parameters,
  resolve,
} from "./computers.ts";
import meta from "./meta.json";
import type { Schema } from "./models.ts";

/** Call a computer like Python does, `fn(*args, **options)`, through `compute`. */
function call(name: string, args: unknown[], options: Record<string, unknown> = {}): unknown {
  const sources = args.map((_, i) => `a${i}`);
  const schema: Schema = {
    type: "object",
    properties: {
      ...Object.fromEntries(sources.map((source) => [source, {}])),
      out: { "x-compute": { fn: name, from: sources, options } },
    },
  };
  const data = Object.fromEntries(args.map((arg, i) => [`a${i}`, arg]));

  return (compute(schema, data) as Record<string, unknown>).out;
}

describe("computers", () => {
  test.each<[string, unknown[], Record<string, unknown>, unknown]>([
    // text
    ["join", ["Rama", null, "", "Ali"], {}, "Rama Ali"],
    ["join", [["a", "b"], "c"], { sep: ", " }, "a, b, c"],
    ["concat", ["ab", 1], {}, "ab1"],
    ["upper", ["abc"], {}, "ABC"],
    ["lower", ["ABC"], {}, "abc"],
    ["title", ["rama ali"], {}, "Rama Ali"],
    ["capitalize", ["rama ali"], {}, "Rama ali"],
    ["trim", ["  x "], {}, "x"],
    ["replace", ["a-b-c"], { old: "-", new: "/" }, "a/b/c"],
    ["slice", ["2026-11-04"], { end: 4 }, "2026"],
    ["slice", [[1, 2, 3]], { start: 1 }, [2, 3]],
    ["initials", ["rama ali", "x"], {}, "RAX"],
    ["slug", ["  Hello, World! "], {}, "hello-world"],
    ["slug", ["مرحبا بالعالم"], {}, "مرحبا-بالعالم"],
    ["length", ["abc"], {}, 3],
    ["length", [[1, 2]], {}, 2],
    ["pad", [42], { width: 5 }, "00042"],
    ["mask", ["12345678"], {}, "****5678"],
    ["mask", ["12"], {}, "12"],
    // numbers
    ["sum", [1, [2, 3]], {}, 6],
    ["subtract", [10, 3, [2]], {}, 5],
    ["multiply", [2, [3, 4]], {}, 24],
    ["divide", [1, 4], {}, 0.25],
    ["average", [[1, 2, 3]], {}, 2],
    ["min", [[3, 1], 2], {}, 1],
    ["max", [[3, 1], 2], {}, 3],
    ["abs", [-2], {}, 2],
    ["round", [2.3456], {}, 2.35],
    ["round", [2.3456], { digits: 0 }, 2],
    ["percent", [1, 4], {}, 25],
    ["percent_of", [200, 15], {}, 30],
    // words
    ["words", [12], {}, "twelve"],
    ["words", [12], { suffix: "USD" }, "twelve USD"],
    ["words", [12], { prefix: "only", suffix: "USD" }, "only twelve USD"],
    ["words", [1.5], { prefix: "only" }, "only one point five"],
    ["words", [3], { lang: "ar" }, "ثلاثة"],
    // dates
    ["add_days", ["2026-12-31"], { days: 1 }, "2027-01-01"],
    ["add_days", ["2026-11-04T10:00:00+03:00"], { days: -4 }, "2026-10-31"],
    ["add_months", ["2026-01-31"], { months: 1 }, "2026-02-28"],
    ["add_months", ["2026-01-15"], { months: -2 }, "2025-11-15"],
    ["add_years", ["2028-02-29"], { years: 1 }, "2029-02-28"],
    ["days_between", ["2026-01-01", "2026-03-01"], {}, 59],
    ["age", ["2000-11-05"], { on: "2026-11-04" }, 25],
    ["age", ["2000-11-04"], { on: "2026-11-04" }, 26],
    ["year", ["2026-11-04"], {}, 2026],
    ["month", ["2026-11-04"], {}, 11],
    ["day", ["2026-11-04"], {}, 4],
    ["weekday", ["2026-11-04"], {}, "Wednesday"],
    ["format_date", ["2026-11-04"], {}, "04/11/2026"],
    ["format_date", ["2026-11-04T10:30:00"], { fmt: "%H:%M" }, "10:30"],
    ["start_of_month", ["2026-11-04"], {}, "2026-11-01"],
    ["end_of_month", ["2028-02-04"], {}, "2028-02-29"],
    // logic, lookup and misc
    ["coalesce", [null, "", 0, 1], {}, 0],
    ["if_else", [true, "a", "b"], {}, "a"],
    ["if_else", [0, "a", "b"], {}, "b"],
    ["equals", [1, 1], {}, true],
    ["lookup", ["SY"], { map: { SY: "Syria" } }, "Syria"],
    ["lookup", [1], { map: { "1": "one" } }, "one"],
    ["lookup", ["XX"], { map: {}, fallback: "?" }, "?"],
    ["constant", [], { value: 7 }, 7],
    ["count", [[1, 2]], {}, 2],
    ["count_if", [["a", "b", "a"], "a"], {}, 2],
    ["unique", [[2, 1, 2]], {}, [2, 1]],
  ])("%s(%j, %j)", (name, args, options, expected) => {
    expect(call(name, args, options)).toEqual(expected);
  });

  test.each([
    ["today", /^\d{4}-\d{2}-\d{2}$/],
    ["now", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/],
    ["uuid", /^[0-9a-f-]{36}$/],
  ])("%s takes no arguments", (name, pattern) => {
    expect(call(name, [])).toMatch(pattern);
  });

  test("today is today", () => {
    const now = new Date();
    const two = (n: number) => String(n).padStart(2, "0");

    expect(call("today", [])).toBe(
      `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`,
    );
  });

  test("dates default to today", () => {
    const iso = call("today", []);

    for (const name of ["add_days", "add_months", "add_years"]) {
      expect(call(name, [])).toBe(iso);
      expect(call(name, [null])).toBe(iso);
    }

    expect(call("add_days", [], { days: 1 })).toBe(call("add_days", [iso], { days: 1 }));
    expect(call("add_months", [], { months: 1 })).toBe(call("add_months", [iso], { months: 1 }));
    expect(call("add_years", [], { years: 1 })).toBe(call("add_years", [iso], { years: 1 }));
    expect(call("days_between", [iso])).toBe(0);

    for (const name of ["year", "month", "day", "weekday", "format_date", "start_of_month"]) {
      expect(call(name, [])).toEqual(call(name, [iso]));
    }

    expect(call("end_of_month", [])).toBe(call("end_of_month", [iso]));
  });

  test("template", () => {
    expect(COMPUTERS.template?.({ template: "{n} @ {c}", values: { n: "Rama", c: "Acme" } })).toBe(
      "Rama @ Acme",
    );
  });

  test.each<[string, unknown[], Record<string, unknown>]>([
    ["divide", [1, 0], {}],
    ["coalesce", [null, ""], {}],
    ["lookup", ["XX"], { map: {} }],
    ["average", [], {}],
    ["words", [1], { lang: "xx" }],
    ["words", [1], { to: "ordinal" }],
    ["days_between", [null], {}],
    ["age", [null], {}],
  ])("%s(%j, %j) fails", (name, args, options) => {
    expect(() => call(name, args, options)).toThrow(ComputeError);
  });

  test("every computer in meta.json is implemented", () => {
    expect(Object.keys(COMPUTERS).sort()).toEqual(Object.keys(meta.computers).sort());
  });

  test("parameters", () => {
    expect(
      parameters("lookup(key: Any, map: dict[str, typing.Any], fallback: Any = 1) -> Any"),
    ).toEqual([
      { name: "key", kind: "positional", required: true },
      { name: "map", kind: "positional", required: true },
      { name: "fallback", kind: "positional", required: false },
    ]);
    expect(parameters("join(*values: Any, sep: str = ' ') -> str")).toEqual([
      { name: "values", kind: "var", required: false },
      { name: "sep", kind: "keyword", required: false },
    ]);
  });
});

describe("expr", () => {
  const expr = (expression: string, values: Record<string, unknown>) =>
    COMPUTERS.expr?.({ expr: expression, values });

  test.each<[string, Record<string, unknown>, unknown]>([
    ["q * p", { q: 2, p: 3 }, 6],
    ["round(q * p * 1.15, 2)", { q: 3, p: 9.99 }, 34.47],
    ["-a + b // 2 - b % 3 + 2 ** 3", { a: 1, b: 7 }, 9],
    ["max(a, b) if a > 0 and not b == 0 else 0", { a: 1, b: 5 }, 5],
    ["1 < a <= 3", { a: 3 }, true],
    ["sum(xs) / 2", { xs: [2, 4] }, 3],
    ["min([a, b])", { a: 2, b: 1 }, 1],
    ["'big' if a > 10 or b else 'small'", { a: 1, b: 0 }, "small"],
  ])("%s", (expression, values, expected) => {
    expect(expr(expression, values)).toEqual(expected);
  });

  test.each([
    "__import__('os').system('echo hi')",
    "a.__class__",
    "open('x')",
    "unknown + 1",
    "[x for x in a]",
    "a[0]",
    "lambda: 1",
    "2 ** a",
    "1 +",
  ])("rejects %s", (expression) => {
    expect(() => expr(expression, { a: 10 ** 6 })).toThrow(
      /not allowed|too large|Invalid expression/,
    );
  });
});

describe("resolve", () => {
  const data = { name: "Rama", address: { city: "Homs" }, items: [{ p: 1 }, {}, { p: 3 }] };

  test.each<[string, unknown]>([
    ["name", "Rama"],
    ["address.city", "Homs"],
    ["items[0].p", 1],
    ["items[*].p", [1, 3]],
    ["$.company", "Acme"],
    ["middle?", null],
    ["address.zip?", null],
  ])("%s", (path, expected) => {
    expect(resolve(path, data, { company: "Acme" })).toEqual(expected);
  });

  test.each(["middle", "items[5]", "items[1].p", "name.first"])("%s is missing", (path) => {
    expect(() => resolve(path, data, data)).toThrow();
  });
});

const computed = (fn: string, spec: Record<string, unknown> = {}) => ({
  "x-compute": { fn, ...spec },
});

describe("compute", () => {
  test("invoice", () => {
    const schema = {
      type: "object",
      properties: {
        company: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              qty: { type: "integer" },
              price: { type: "number" },
              line: computed("expr", {
                from: { q: "qty", p: "price" },
                options: { expr: "q * p" },
              }),
              label: computed("template", {
                from: { c: "$.company" },
                options: { template: "{c} item" },
              }),
            },
          },
        },
        total: computed("sum", { from: ["items[*].line"] }),
        words: computed("words", { from: ["total"] }),
        count: computed("count", { from: ["items"] }),
      },
    };
    const data = {
      company: "Acme",
      items: [
        { qty: 2, price: 5 },
        { qty: 1, price: 3 },
      ],
    };

    expect(compute(schema, data)).toEqual({
      company: "Acme",
      items: [
        { qty: 2, price: 5, line: 10, label: "Acme item" },
        { qty: 1, price: 3, line: 3, label: "Acme item" },
      ],
      total: 13,
      words: "thirteen",
      count: 2,
    });
  });

  test("keeps the schema order", () => {
    const schema = {
      type: "object",
      properties: {
        full: computed("join", { from: ["first", "last"] }),
        first: { type: "string" },
        last: { type: "string" },
      },
    };

    expect(Object.keys(compute(schema, { first: "A", last: "B" }) as object)).toEqual([
      "full",
      "first",
      "last",
    ]);
  });

  test.each<[Record<string, unknown>, Record<string, unknown>]>([
    [{ from: ["first", "middle", "last"] }, {}],
    [{ from: ["first", "middle", "last"], default: "?" }, { full: "?" }],
    [{ from: ["first", "middle?", "last"] }, { full: "A B" }],
  ])("missing source %j", (spec, expected) => {
    const schema = {
      type: "object",
      properties: {
        first: { type: "string" },
        middle: { type: "string" },
        last: { type: "string" },
        full: computed("join", spec),
      },
    };

    expect(compute(schema, { first: "A", last: "B" })).toEqual({
      first: "A",
      last: "B",
      ...expected,
    });
  });

  test("unknown property", () => {
    const schema = { type: "object", properties: { x: computed("upper", { from: ["nmae"] }) } };

    expect(() => compute(schema, {})).toThrow(/'nmae' is not a property/);
  });

  test("bad value", () => {
    const schema = {
      type: "object",
      properties: { a: { type: "integer" }, x: computed("divide", { from: ["a", "a"] }) },
    };

    expect(() => compute(schema, { a: 0 })).toThrow(/Can not compute 'x' with 'divide'/);
  });

  test("unknown computer", () => {
    const schema = { type: "object", properties: { x: computed("nope") } };

    expect(() => compute(schema, {})).toThrow(NotSupportedError);
    expect(() => compute(schema, {})).toThrow(/Computer 'nope'/);
  });
});
