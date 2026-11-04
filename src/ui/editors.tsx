/**
 * The editors of each node, asking what `schemify generate` asks, as a form.
 *
 * Every editor receives its node and path, and reports a changed copy through `onChange`.
 */

import type { ReactNode } from "react";
import {
  computer,
  computerGroups,
  type Issues,
  type Node,
  newNode,
  newProperty,
  type ObjectNode,
  optionsExample,
  type Property,
  STRING_FORMATS,
  TYPES,
  type TypeName,
} from "../core/generators.ts";
import {
  ARRAY_CONSTRAINTS,
  type Constraint,
  NUMBER_CONSTRAINTS,
  STRING_CONSTRAINTS,
} from "../core/validators.ts";

type EditorProps<N> = { node: N; path: string; issues: Issues; onChange: (node: N) => void };

const INPUT =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 aria-invalid:border-red-500 dark:border-neutral-700 dark:bg-neutral-900";

const BUTTON =
  "rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-200 disabled:opacity-30 dark:text-neutral-400 dark:hover:bg-neutral-800";

// -----------------------
// form pieces
// -----------------------

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as `children`
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-indigo-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function TypeSelect({
  value,
  allowComputed,
  error,
  label,
  onChange,
}: {
  value: TypeName;
  allowComputed: boolean;
  error?: string | undefined;
  label: string;
  onChange: (type: TypeName) => void;
}) {
  const types = allowComputed || value === "computed" ? [...TYPES, "computed" as const] : TYPES;

  return (
    <Field label={label} error={error}>
      <select
        className={INPUT}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value as TypeName)}
      >
        {types.map((type) => (
          <option key={type}>{type}</option>
        ))}
      </select>
    </Field>
  );
}

/** One optional text input per constraint question, an empty one is skipped. */
function Constraints({
  constraints,
  answers,
  path,
  issues,
  onChange,
}: {
  constraints: Constraint[];
  answers: Record<string, string>;
  path: string;
  issues: Issues;
  onChange: (answers: Record<string, string>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {constraints.map(({ keyword, question }) => (
        <Field key={keyword} label={`${question} (optional)`} error={issues[`${path}.${keyword}`]}>
          <input
            className={INPUT}
            value={answers[keyword] ?? ""}
            aria-invalid={Boolean(issues[`${path}.${keyword}`])}
            onChange={(e) => onChange({ ...answers, [keyword]: e.target.value })}
          />
        </Field>
      ))}
    </div>
  );
}

// -----------------------
// nodes
// -----------------------

/** The questions of `node`'s type, `earlier` are the property names a computed one can use. */
export function NodeEditor({
  node,
  path,
  issues,
  onChange,
  earlier = [],
}: EditorProps<Node> & { earlier?: string[] }) {
  switch (node.type) {
    case "string": {
      const constraints = node.digitsOnly
        ? STRING_CONSTRAINTS.filter((c) => c.keyword !== "pattern")
        : STRING_CONSTRAINTS;

      return (
        <Validators
          checked={node.validators}
          onChange={(validators) => onChange({ ...node, validators })}
        >
          <Field label="Format">
            <select
              className={INPUT}
              value={node.format}
              onChange={(e) => onChange({ ...node, format: e.target.value as typeof node.format })}
            >
              {STRING_FORMATS.map((format) => (
                <option key={format}>{format}</option>
              ))}
            </select>
          </Field>
          {node.format === "none" && (
            <>
              <Check
                label="Digits only"
                checked={node.digitsOnly}
                onChange={(digitsOnly) => onChange({ ...node, digitsOnly })}
              />
              <Constraints
                constraints={constraints}
                answers={node.constraints}
                path={path}
                issues={issues}
                onChange={(answers) => onChange({ ...node, constraints: answers })}
              />
            </>
          )}
        </Validators>
      );
    }

    case "integer":
    case "number":
      return (
        <Validators
          checked={node.validators}
          onChange={(validators) => onChange({ ...node, validators })}
        >
          <Constraints
            constraints={NUMBER_CONSTRAINTS}
            answers={node.constraints}
            path={path}
            issues={issues}
            onChange={(answers) => onChange({ ...node, constraints: answers })}
          />
        </Validators>
      );

    case "enum":
      return (
        <Field label="Choices, comma separated" error={issues[`${path}.choices`]}>
          <input
            className={INPUT}
            value={node.choices}
            aria-invalid={Boolean(issues[`${path}.choices`])}
            onChange={(e) => onChange({ ...node, choices: e.target.value })}
          />
        </Field>
      );

    case "array":
      return (
        <div className="flex flex-col gap-3">
          <TypeSelect
            label="Items type"
            value={node.items.type}
            allowComputed={false}
            onChange={(type) => onChange({ ...node, items: newNode(type) })}
          />
          <Nested>
            <NodeEditor
              node={node.items}
              path={`${path}.items`}
              issues={issues}
              onChange={(items) => onChange({ ...node, items })}
            />
          </Nested>
          <Validators
            checked={node.validators}
            onChange={(validators) => onChange({ ...node, validators })}
          >
            <Constraints
              constraints={ARRAY_CONSTRAINTS}
              answers={node.constraints}
              path={path}
              issues={issues}
              onChange={(answers) => onChange({ ...node, constraints: answers })}
            />
            <Check
              label="Unique items"
              checked={node.uniqueItems}
              onChange={(uniqueItems) => onChange({ ...node, uniqueItems })}
            />
          </Validators>
        </div>
      );

    case "object":
      return <ObjectEditor node={node} path={path} issues={issues} onChange={onChange} />;

    case "computed":
      return (
        <ComputedEditor
          node={node}
          path={path}
          issues={issues}
          onChange={onChange}
          earlier={earlier}
        />
      );

    default:
      return null; // boolean, date and datetime ask nothing
  }
}

function Validators({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Check label="Add validators" checked={checked} onChange={onChange} />
      {checked && children}
    </div>
  );
}

function Nested({ children }: { children: ReactNode }) {
  return <div className="border-l-2 border-indigo-200 pl-4 dark:border-indigo-900">{children}</div>;
}

export function ObjectEditor({ node, path, issues, onChange }: EditorProps<ObjectNode>) {
  const setProperty = (index: number, property: Property) =>
    onChange({ ...node, properties: node.properties.with(index, property) });

  const move = (index: number, to: number) => {
    const properties = [...node.properties];
    const [moved] = properties.splice(index, 1);

    if (moved) {
      properties.splice(to, 0, moved);
    }

    onChange({ ...node, properties });
  };

  return (
    <div className="flex flex-col gap-3">
      {node.properties.map((property, index) => (
        <PropertyCard
          key={property.id}
          property={property}
          path={`${path}.${index}`}
          issues={issues}
          earlier={node.properties
            .slice(0, index)
            .map((p) => p.name.trim())
            .filter(Boolean)}
          onChange={(changed) => setProperty(index, changed)}
          onMove={(to) => move(index, to)}
          onRemove={() =>
            onChange({ ...node, properties: node.properties.filter((p) => p !== property) })
          }
          index={index}
          count={node.properties.length}
        />
      ))}
      {issues[`${path}.properties`] && (
        <p className="text-sm text-red-600 dark:text-red-400">{issues[`${path}.properties`]}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-md border border-dashed border-neutral-400 px-3 py-1.5 text-sm hover:border-indigo-500 hover:text-indigo-600 dark:border-neutral-600"
          onClick={() => onChange({ ...node, properties: [...node.properties, newProperty()] })}
        >
          + Add property
        </button>
        <Check
          label="Allow extra properties"
          checked={node.extraProperties}
          onChange={(extraProperties) => onChange({ ...node, extraProperties })}
        />
      </div>
    </div>
  );
}

function PropertyCard({
  property,
  path,
  issues,
  earlier,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  property: Property;
  path: string;
  issues: Issues;
  earlier: string[];
  index: number;
  count: number;
  onChange: (property: Property) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const name = property.name.trim() || "property";
  const hasBody = !["boolean", "date", "datetime"].includes(property.node.type);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-start">
        <Field label="Property name" error={issues[`${path}.name`]}>
          <input
            className={`${INPUT} font-mono`}
            value={property.name}
            aria-invalid={Boolean(issues[`${path}.name`])}
            onChange={(e) => onChange({ ...property, name: e.target.value })}
          />
        </Field>
        <TypeSelect
          label={`Type of '${name}'`}
          value={property.node.type}
          allowComputed={earlier.length > 0}
          error={issues[`${path}.type`]}
          onChange={(type) => onChange({ ...property, node: newNode(type) })}
        />
        <div className="flex gap-1 sm:pt-6">
          <button
            type="button"
            className={BUTTON}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
            aria-label={`Move '${name}' up`}
          >
            ↑
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
            aria-label={`Move '${name}' down`}
          >
            ↓
          </button>
          <button
            type="button"
            className={`${BUTTON} hover:text-red-600`}
            onClick={onRemove}
            aria-label={`Remove '${name}'`}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Label shown instead of '${name}' when filling (optional)`}>
          <input
            className={INPUT}
            value={property.label}
            onChange={(e) => onChange({ ...property, label: e.target.value })}
          />
        </Field>
        <Field label={`Description of '${name}' (optional)`}>
          <input
            className={INPUT}
            value={property.description}
            onChange={(e) => onChange({ ...property, description: e.target.value })}
          />
        </Field>
      </div>
      <Check
        label={`'${name}' is required`}
        checked={property.required}
        onChange={(required) => onChange({ ...property, required })}
      />
      {hasBody && (
        <Nested>
          <NodeEditor
            node={property.node}
            path={path}
            issues={issues}
            earlier={earlier}
            onChange={(node) => onChange({ ...property, node })}
          />
        </Nested>
      )}
    </section>
  );
}

function ComputedEditor({
  node,
  path,
  issues,
  onChange,
  earlier,
}: EditorProps<Extract<Node, { type: "computed" }>> & { earlier: string[] }) {
  const info = computer(node.fn);
  const example = optionsExample(node.fn, node.from.length);
  const toggle = (source: string) =>
    onChange({
      ...node,
      from: node.from.includes(source)
        ? node.from.filter((s) => s !== source)
        : [...node.from, source],
    });

  return (
    <div className="flex flex-col gap-3">
      <Field label="Compute with" error={issues[`${path}.fn`]}>
        <select
          className={INPUT}
          value={node.fn}
          onChange={(e) => onChange({ ...node, fn: e.target.value })}
        >
          {computerGroups().map(([group, names]) => (
            <optgroup key={group} label={group}>
              {names.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      {info && (
        <div className="rounded-md bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
          <code className="font-semibold break-words">{info.signature}</code>
          {info.summary && (
            <p className="mt-1 text-neutral-600 italic dark:text-neutral-400">{info.summary}</p>
          )}
        </div>
      )}
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1 text-neutral-600 dark:text-neutral-400">
          Computed from (in order)
        </legend>
        <div className="flex flex-wrap gap-2">
          {earlier.map((source) => {
            const order = node.from.indexOf(source);

            return (
              <button
                key={source}
                type="button"
                aria-pressed={order >= 0}
                className="rounded-full border border-neutral-300 px-3 py-1 font-mono text-xs aria-pressed:border-indigo-500 aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700 dark:border-neutral-700 dark:aria-pressed:bg-indigo-950 dark:aria-pressed:text-indigo-300"
                onClick={() => toggle(source)}
              >
                {order >= 0 && <span className="mr-1 font-sans font-semibold">{order + 1}</span>}
                {source}
              </button>
            );
          })}
        </div>
        {issues[`${path}.from`] && (
          <span className="text-xs text-red-600 dark:text-red-400">{issues[`${path}.from`]}</span>
        )}
      </fieldset>
      {example !== null && (
        <Field
          label={`Options as JSON (optional), like ${JSON.stringify(example)}`}
          error={issues[`${path}.options`]}
        >
          <textarea
            className={`${INPUT} font-mono`}
            rows={2}
            value={node.options}
            placeholder={JSON.stringify(example)}
            aria-invalid={Boolean(issues[`${path}.options`])}
            onChange={(e) => onChange({ ...node, options: e.target.value })}
          />
        </Field>
      )}
      <TypeSelect
        label="Result type"
        value={node.result.type}
        allowComputed={false}
        onChange={(type) => onChange({ ...node, result: newNode(type) })}
      />
      <Nested>
        <NodeEditor
          node={node.result}
          path={`${path}.result`}
          issues={issues}
          onChange={(result) => onChange({ ...node, result })}
        />
      </Nested>
    </div>
  );
}
