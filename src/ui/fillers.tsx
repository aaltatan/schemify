/**
 * The fill form, asking what `schemify fill` asks: one input per value, by schema kind.
 *
 * Every input receives its draft and path, and reports a changed copy through `onChange`.
 * `data` is the computed data at that path, to show the computed properties.
 */

import { KEYWORD, pyStr } from "../core/computers.ts";
import { type Draft, displayName, draftFor, kind, newDraft, properties } from "../core/fillers.ts";
import type { Issues } from "../core/generators.ts";
import type { Schema } from "../core/models.ts";
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
  data: unknown;
  issues: Issues;
  onChange: (draft: Draft) => void;
};

const PLACEHOLDERS: Record<string, string> = {
  integer: "42",
  number: "4.2",
  "date-time": "2026-11-04T10:30:00+03:00",
};

function at(data: unknown, key: string | number): unknown {
  return typeof data === "object" && data !== null
    ? (data as Record<string | number, unknown>)[key]
    : undefined;
}

/** The questions of a root object schema, like `ask_data`. */
export function FillForm({
  schema,
  draft,
  data,
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
          data={data}
          issues={issues}
          onChange={onChange}
        />
      ) : (
        <ValueInput
          schema={schema}
          draft={current}
          label=""
          required
          data={data}
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
  data,
  issues,
  onChange,
}: Omit<ValueProps, "required" | "draft"> & { draft: Extract<Draft, { kind: "object" }> }) {
  const required = new Set((schema.required ?? []) as string[]);

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(properties(schema)).map(([name, propertySchema]) => {
        const path = label ? `${label}.${name}` : name;

        if (KEYWORD in propertySchema) {
          return (
            <Computed key={name} name={displayName(propertySchema, path)} value={at(data, name)} />
          );
        }

        return (
          <ValueInput
            key={name}
            schema={propertySchema}
            draft={draftFor(propertySchema, draft.properties[name])}
            label={path}
            required={required.has(name)}
            data={at(data, name)}
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

function Computed({ name, value }: { name: string; value: unknown }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="text-[0.8125rem] text-ink-muted">{name} (computed)</span>
      <output className="min-h-9 rounded-[5px] border border-dashed border-rule-strong px-2.5 py-2 font-mono text-[0.8125rem] break-all">
        {value === undefined ? "—" : JSON.stringify(value)}
      </output>
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
  const { schema, draft, label, data, issues, onChange } = props;

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
                    data={at(data, i)}
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
              data={data}
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
