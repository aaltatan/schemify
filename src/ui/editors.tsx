/**
 * The editors of each node, asking what `schemify generate` asks, as a form.
 *
 * Every editor receives its node and path, and reports a changed copy through `onChange`.
 */

import { type ReactNode, useRef } from "react";
import {
  type Issues,
  type Node,
  newNode,
  newProperty,
  type ObjectNode,
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
import {
  ADD_BUTTON,
  Check,
  ErrorText,
  Field,
  ICON_BUTTON,
  Icon,
  INPUT,
  Select,
} from "./controls.tsx";

type EditorProps<N> = { node: N; path: string; issues: Issues; onChange: (node: N) => void };

const LEGEND = "mb-1.5 text-[0.8125rem] text-ink-muted";

// -----------------------
// form pieces
// -----------------------

function TypeSelect({
  value,
  error,
  label,
  onChange,
}: {
  value: TypeName;
  error?: string | undefined;
  label: string;
  onChange: (type: TypeName) => void;
}) {
  return (
    <Field label={label} error={error}>
      <Select
        value={value}
        groups={[["", TYPES]]}
        invalid={Boolean(error)}
        mono
        onChange={(type) => onChange(type as TypeName)}
      />
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
    <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
      {constraints.map(({ keyword, question }) => (
        <Field key={keyword} label={`${question} (optional)`} error={issues[`${path}.${keyword}`]}>
          <input
            className={`${INPUT} font-mono text-[0.8125rem]`}
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

/** The questions of `node`'s type. */
export function NodeEditor({ node, path, issues, onChange }: EditorProps<Node>) {
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
          <div className="sm:max-w-[calc(50%-0.375rem)]">
            <Field label="Format">
              <Select
                value={node.format}
                groups={[["", STRING_FORMATS]]}
                mono
                onChange={(format) => onChange({ ...node, format: format as typeof node.format })}
              />
            </Field>
          </div>
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
        <ChoicesEditor
          choices={node.choices}
          path={path}
          issues={issues}
          onChange={(choices) => onChange({ ...node, choices })}
        />
      );

    case "array":
      return (
        <div className="flex flex-col gap-4">
          <div className="sm:max-w-[calc(50%-0.375rem)]">
            <TypeSelect
              label="Items type"
              value={node.items.type}
              onChange={(type) => onChange({ ...node, items: newNode(type) })}
            />
          </div>
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

function ChoicesEditor({
  choices,
  path,
  issues,
  onChange,
}: {
  choices: string[];
  path: string;
  issues: Issues;
  onChange: (choices: string[]) => void;
}) {
  // set by "Add choice", so the new last input takes the focus once it is rendered
  const focusAdded = useRef(false);

  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className={LEGEND}>Choices</legend>
      {choices.map((choice, index) => {
        const error = issues[`${path}.choices.${index}`];

        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: choices are plain strings, edited in place
          <div key={index} className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="w-6 shrink-0 text-right font-mono text-xs text-ink-muted tabular-nums">
                {index + 1}
              </span>
              <input
                className={`${INPUT} font-mono text-[0.8125rem]`}
                value={choice}
                ref={(input) => {
                  if (input && focusAdded.current && index === choices.length - 1) {
                    focusAdded.current = false;
                    input.focus();
                  }
                }}
                aria-label={`Choice ${index + 1}`}
                aria-invalid={Boolean(error)}
                onChange={(e) => onChange(choices.with(index, e.target.value))}
              />
              <button
                type="button"
                className={`${ICON_BUTTON} hover:bg-danger-soft hover:text-danger`}
                disabled={choices.length === 1}
                onClick={() => onChange(choices.filter((_, i) => i !== index))}
                aria-label={`Remove choice ${index + 1}`}
              >
                <Icon name="x" />
              </button>
            </div>
            {error && (
              <span className="pl-7">
                <ErrorText>{error}</ErrorText>
              </span>
            )}
          </div>
        );
      })}
      {issues[`${path}.choices`] && <ErrorText>{issues[`${path}.choices`]}</ErrorText>}
      <button
        type="button"
        className={`${ADD_BUTTON} ml-7`}
        onClick={() => {
          focusAdded.current = true;
          onChange([...choices, ""]);
        }}
      >
        <Icon name="plus" />
        Add choice
      </button>
    </fieldset>
  );
}

function Nested({ children }: { children: ReactNode }) {
  return <div className="border-l border-rule-strong pl-4">{children}</div>;
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
        <p className="text-sm text-danger">{issues[`${path}.properties`]}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className={ADD_BUTTON}
          onClick={() => onChange({ ...node, properties: [...node.properties, newProperty()] })}
        >
          <Icon name="plus" />
          Add property
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
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  property: Property;
  path: string;
  issues: Issues;
  index: number;
  count: number;
  onChange: (property: Property) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const name = property.name.trim() || "property";
  const hasBody = !["boolean", "date", "datetime"].includes(property.node.type);

  return (
    <section className="flex flex-col gap-4 rounded-[6px] border border-rule bg-sheet p-4 shadow-[0_1px_2px_oklch(0.2_0.05_258/0.06)]">
      <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-[1fr_11rem_auto]">
        <Field label="Property name" error={issues[`${path}.name`]}>
          <input
            className={`${INPUT} font-mono text-[0.8125rem] font-medium`}
            value={property.name}
            aria-invalid={Boolean(issues[`${path}.name`])}
            onChange={(e) => onChange({ ...property, name: e.target.value })}
          />
        </Field>
        <TypeSelect
          label={`Type of '${name}'`}
          value={property.node.type}
          error={issues[`${path}.type`]}
          onChange={(type) => onChange({ ...property, node: newNode(type) })}
        />
        <div className="flex gap-0.5 self-start sm:col-start-3 sm:row-start-2">
          <button
            type="button"
            className={ICON_BUTTON}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
            aria-label={`Move '${name}' up`}
          >
            <Icon name="up" />
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
            aria-label={`Move '${name}' down`}
          >
            <Icon name="down" />
          </button>
          <button
            type="button"
            className={`${ICON_BUTTON} hover:bg-danger-soft hover:text-danger`}
            onClick={onRemove}
            aria-label={`Remove '${name}'`}
          >
            <Icon name="x" />
          </button>
        </div>
      </div>
      <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
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
        <Field label={`Default value of '${name}' (optional)`} error={issues[`${path}.default`]}>
          <input
            className={`${INPUT} font-mono text-[0.8125rem]`}
            value={property.default}
            aria-invalid={Boolean(issues[`${path}.default`])}
            onChange={(e) => onChange({ ...property, default: e.target.value })}
          />
        </Field>
      </div>
      <Check
        label={`'${name}' is required`}
        checked={property.required}
        onChange={(required) => onChange({ ...property, required })}
      />
      {hasBody && (
        <div className="-mx-4 -mb-4 border-t border-rule bg-sunken/60 px-4 pt-4 pb-4">
          <NodeEditor
            node={property.node}
            path={path}
            issues={issues}
            onChange={(node) => onChange({ ...property, node })}
          />
        </div>
      )}
    </section>
  );
}
