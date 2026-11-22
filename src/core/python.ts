/** Python semantics of JSON values, so messages and comparisons match the CLI. */

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
