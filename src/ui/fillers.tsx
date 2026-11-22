/**
 * The fill form, asking what `schemify fill` asks: one input per value, by schema kind.
 *
 * Every input receives its draft and path, and reports a changed copy through `onChange`.
 */

import { type Draft, displayName, draftFor, kind, newDraft, properties } from "../core/fillers.ts";
import type { Issues } from "../core/generators.ts";
import type { Schema } from "../core/models.ts";
import { pyStr } from "../core/python.ts";
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

type ValueProps = {
  schema: Schema;
  draft: Draft;
  label: string;
  required: boolean;
  issues: Issues;
  onChange: (draft: Draft) => void;
};

const PLACEHOLDERS: Record<string, string> = {
  integer: "42",
  number: "4.2",
  "date-time": "2026-11-04T10:30:00+03:00",
};

/** The questions of a root object schema, like `ask_data`. */
export function FillForm({
  schema,
  draft,
  issues,
  onChange,
}: Omit<ValueProps, "label" | "required">) {
  const current = draftFor(schema, draft);

  return (
    <div className="flex flex-col gap-4">
      {issues[""] && (
        <p className="rounded-[5px] bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {issues[""]}
        </p>
      )}
      {current.kind === "object" ? (
        <ObjectFields
          schema={schema}
          draft={current}
          label=""
          issues={issues}
          onChange={onChange}
        />
      ) : (
        <ValueInput
          schema={schema}
          draft={current}
          label=""
          required
          issues={issues}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function ObjectFields({
  schema,
  draft,
  label,
  issues,
  onChange,
}: Omit<ValueProps, "required" | "draft"> & { draft: Extract<Draft, { kind: "object" }> }) {
  const required = new Set((schema.required ?? []) as string[]);

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(properties(schema)).map(([name, propertySchema]) => {
        const path = label ? `${label}.${name}` : name;

        return (
          <ValueInput
            key={name}
            schema={propertySchema}
            draft={draftFor(propertySchema, draft.properties[name])}
            label={path}
            required={required.has(name)}
            issues={issues}
            onChange={(changed) =>
              onChange({ ...draft, properties: { ...draft.properties, [name]: changed } })
            }
          />
        );
      })}
    </div>
  );
}

/** The question of one value, an optional choice or container is added first, like Python. */
function ValueInput(props: ValueProps) {
  const { schema, draft, label, required, issues, onChange } = props;
  const name = displayName(schema, label || "data");

  if (draft.kind === "none") {
    return <ErrorText>{issues[label]}</ErrorText>;
  }

  if (draft.kind === "text") {
    const description = typeof schema.description === "string" ? schema.description : "";
    const text = `${name}${description ? ` (${description})` : ""}${required ? "" : " (optional)"}`;
    const valueKind = kind(schema);

    return (
      <Field label={text} error={issues[label]}>
        <input
          className={`${INPUT} ${valueKind === "string" ? "" : "font-mono text-[0.8125rem]"}`}
          type={valueKind === "date" ? "date" : "text"}
          inputMode={
            valueKind === "integer" ? "numeric" : valueKind === "number" ? "decimal" : undefined
          }
          placeholder={PLACEHOLDERS[valueKind]}
          value={draft.text}
          aria-invalid={Boolean(issues[label])}
          onChange={(e) => onChange({ ...draft, text: e.target.value })}
        />
      </Field>
    );
  }

  const added = required || draft.added;

  return (
    <div className="flex flex-col gap-2">
      {!required && (
        <Check
          label={`Add '${name}'`}
          checked={draft.added}
          onChange={(checked) => onChange({ ...draft, added: checked })}
        />
      )}
      {added && <Choice {...props} name={name} />}
    </div>
  );
}

function Choice({ name, ...props }: ValueProps & { name: string }) {
  const { schema, draft, label, issues, onChange } = props;

  switch (draft.kind) {
    case "boolean":
      return (
        <Check
          label={name}
          checked={draft.value}
          onChange={(value) => onChange({ ...draft, value })}
        />
      );
    case "enum": {
      const choices = (schema.enum as unknown[]).map(pyStr);

      return (
        <Field label={name}>
          <Select
            value={choices[draft.index] ?? ""}
            groups={[["", choices]]}
            onChange={(choice) => onChange({ ...draft, index: choices.indexOf(choice) })}
          />
        </Field>
      );
    }
    case "array": {
      const itemsSchema = (schema.items ?? {}) as Schema;
      const min = Number(schema.minItems ?? 0);
      const max = Number(schema.maxItems ?? Number.POSITIVE_INFINITY);

      return (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 text-[0.8125rem] text-ink-muted">{name}</legend>
          <div className="flex flex-col gap-3 border-l border-rule-strong pl-4">
            {draft.items.map((item, i) => (
              // items have no id, the index is their identity like in the data
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              <div key={i} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <ValueInput
                    schema={itemsSchema}
                    draft={draftFor(itemsSchema, item)}
                    label={`${label}[${i}]`}
                    required
                    issues={issues}
                    onChange={(changed) =>
                      onChange({ ...draft, items: draft.items.with(i, changed) })
                    }
                  />
                </div>
                <button
                  type="button"
                  className={`${ICON_BUTTON} mt-6 hover:bg-danger-soft hover:text-danger`}
                  disabled={draft.items.length <= min}
                  onClick={() =>
                    onChange({ ...draft, items: draft.items.filter((_, j) => j !== i) })
                  }
                  aria-label={`Remove item ${i + 1} of '${name}'`}
                >
                  <Icon name="x" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={ADD_BUTTON}
              disabled={draft.items.length >= max}
              onClick={() => onChange({ ...draft, items: [...draft.items, newDraft(itemsSchema)] })}
            >
              <Icon name="plus" />
              Add an item to '{name}'
            </button>
          </div>
        </fieldset>
      );
    }
    case "object":
      return (
        <fieldset className="flex flex-col">
          <legend className="mb-1.5 text-[0.8125rem] text-ink-muted">{name}</legend>
          <div className="border-l border-rule-strong pl-4">
            <ObjectFields
              schema={schema}
              draft={draft}
              label={label}
              issues={issues}
              onChange={onChange}
            />
          </div>
        </fieldset>
      );
    default:
      return null;
  }
}
