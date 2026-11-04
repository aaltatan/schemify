/**
 * The form controls every editor shares, so each input, select and checkbox looks and
 * behaves the same.
 */

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export const INPUT =
  "h-9 w-full rounded-[5px] border border-rule-strong bg-sheet px-2.5 text-sm text-ink placeholder:text-ink-muted/70 transition-[border-color,box-shadow] duration-150 hover:border-ink-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none aria-invalid:border-danger aria-invalid:focus:shadow-[0_0_0_3px_var(--danger-soft)]";

export const ICON_BUTTON =
  "grid size-8 place-items-center rounded-[5px] text-ink-muted transition-colors duration-150 hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-30";

export const BUTTON =
  "inline-flex h-9 items-center gap-1.5 rounded-[5px] px-3 text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40";

export const ADD_BUTTON = `${BUTTON} self-start border border-dashed border-rule-strong text-ink-muted hover:border-accent hover:bg-accent-soft hover:text-accent`;

// -----------------------
// icons, one stroke weight
// -----------------------

const PATHS = {
  chevron: "M6 9l6 6 6-6",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  x: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  copy: "M9 9h10v10H9zM5 15V5h10",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  light:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  dark: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  system: "M3 5h18v11H3zM8 20h8M12 16v4",
  github:
    "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 3.5c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 10.5c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4M9 18c-4.51 2-5-2-7-2",
} as const;

/** The mark: a schema's braces around two ruled lines, as on a spec sheet. Also the favicon. */
export const LOGO_PATH =
  "M9 5.5c-1.7 0-2.2.8-2.2 2.2v1.9c0 1.1-.6 1.9-1.8 2.4 1.2.5 1.8 1.3 1.8 2.4v1.9c0 1.4.5 2.2 2.2 2.2M15 5.5c1.7 0 2.2.8 2.2 2.2v1.9c0 1.1.6 1.9 1.8 2.4-1.2.5-1.8 1.3-1.8 2.4v1.9c0 1.4-.5 2.2-2.2 2.2M10.2 10h3.6M10.2 14h3.6";

export function Logo() {
  return (
    <span className="grid size-7 place-items-center rounded-[6px] bg-accent text-on-accent shadow-[0_1px_2px_oklch(0.2_0.06_258/0.3)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[1.125rem]"
        aria-hidden="true"
      >
        <path d={LOGO_PATH} />
      </svg>
    </span>
  );
}

export function Icon({
  name,
  className = "size-4",
}: {
  name: keyof typeof PATHS;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

// -----------------------
// field and checkbox
// -----------------------

export function ErrorText({ children }: { children: ReactNode }) {
  return <span className="text-xs text-danger">{children}</span>;
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    // row-span-3 + subgrid: in a grid of fields, labels, controls and errors each share a row
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as `children`
    <label className="row-span-3 grid min-w-0 grid-rows-subgrid content-start gap-y-1.5 text-sm">
      <span className="text-[0.8125rem] text-ink-muted">{label}</span>
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </label>
  );
}

export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="group inline-flex cursor-pointer items-center gap-2 self-start text-sm">
      <span className="relative grid size-4 place-items-center">
        <input
          type="checkbox"
          className="peer size-4 cursor-pointer appearance-none rounded-[4px] border border-rule-strong bg-sheet transition-colors duration-150 checked:border-accent checked:bg-accent group-hover:border-ink-muted checked:group-hover:border-accent-hover checked:group-hover:bg-accent-hover"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <Icon
          name="check"
          className="pointer-events-none absolute size-3 text-on-accent opacity-0 peer-checked:opacity-100"
        />
      </span>
      {label}
    </label>
  );
}

// -----------------------
// select
// -----------------------

/** Options as `[group, values]`, an empty group name draws no heading. */
export type OptionGroups = readonly (readonly [string, readonly string[]])[];

/**
 * A listbox select: the button keeps focus and points at the active option, so it reads like a
 * native select to a screen reader and works from the keyboard (arrows, Home, End, Enter, Escape).
 */
export function Select({
  value,
  groups,
  invalid = false,
  mono = false,
  onChange,
}: {
  value: string;
  groups: OptionGroups;
  invalid?: boolean;
  mono?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const options = groups.flatMap(([, values]) => values);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(false);

  const show = () => {
    setActive(Math.max(options.indexOf(value), 0));
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];

    if (option !== undefined && option !== value) {
      onChange(option);
    }

    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", close);

    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // open upwards when the list would run past the bottom of the window
  useLayoutEffect(() => {
    if (open && root.current) {
      const box = root.current.getBoundingClientRect();

      setAbove(window.innerHeight - box.bottom < 300 && box.top > window.innerHeight - box.bottom);
    }
  }, [open]);

  // keep the active option in view, scrolling the list only, never the page
  useEffect(() => {
    const box = list.current;
    const option = box?.querySelector<HTMLElement>(`[data-index="${active}"]`);

    if (!open || !box || !option) {
      return;
    }

    if (option.offsetTop < box.scrollTop) {
      box.scrollTop = option.offsetTop;
    } else if (option.offsetTop + option.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = option.offsetTop + option.offsetHeight - box.clientHeight;
    }
  }, [open, active]);

  const onKeyDown = (e: KeyboardEvent) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };

    if (e.key in moves) {
      e.preventDefault();

      if (open) {
        setActive(moves[e.key] as number);
      } else {
        show();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();

      if (open) {
        choose(active);
      } else {
        show();
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  let index = -1;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-invalid={invalid}
        className={`${INPUT} flex cursor-pointer items-center justify-between gap-2 text-left ${open ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : ""}`}
        onClick={(e) => {
          e.preventDefault();

          if (open) {
            setOpen(false);
          } else {
            show();
          }
        }}
        onKeyDown={onKeyDown}
      >
        <span className={`truncate ${mono ? "font-mono text-[0.8125rem]" : ""}`}>{value}</span>
        <Icon
          name="chevron"
          className={`size-4 text-ink-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          ref={list}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          className={`absolute inset-x-0 z-30 max-h-72 min-w-max overflow-auto rounded-[5px] border border-rule-strong bg-sheet p-1 shadow-[0_8px_24px_-6px_oklch(0.2_0.05_258/0.25),0_2px_6px_-2px_oklch(0.2_0.05_258/0.12)] ${above ? "bottom-full mb-1" : "top-full mt-1"}`}
        >
          {groups.map(([group, values]) => (
            // biome-ignore lint/a11y/useSemanticElements: a listbox group, not a form fieldset
            <div key={group || "options"} role="group" aria-label={group || undefined}>
              {group && (
                <div className="px-2 pt-2 pb-1 text-xs font-medium text-ink-muted">{group}</div>
              )}
              {values.map((option) => {
                index += 1;

                const at = index;
                const selected = option === value;

                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled on the button
                  <div
                    key={option}
                    id={`${id}-${at}`}
                    data-index={at}
                    role="option"
                    tabIndex={-1}
                    aria-selected={selected}
                    className={`flex cursor-pointer items-center justify-between gap-4 rounded-[4px] px-2 py-1.5 text-sm ${at === active ? "bg-accent-soft text-ink" : "text-ink"} ${mono ? "font-mono text-[0.8125rem]" : ""}`}
                    onPointerMove={() => setActive(at)}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault(); // inside a <label>, a click would reopen the list
                      choose(at);
                    }}
                  >
                    {option}
                    {selected && <Icon name="check" className="size-3.5 text-accent" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------
// theme
// -----------------------

const THEMES = ["system", "light", "dark"] as const;

type Theme = (typeof THEMES)[number];

function savedTheme(): Theme {
  try {
    const theme = localStorage.getItem("theme");

    return THEMES.includes(theme as Theme) ? (theme as Theme) : "system";
  } catch {
    return "system";
  }
}

/** System, light or dark, remembered; `index.html` applies it before the first paint. */
export function ThemeSwitch() {
  const [theme, setTheme] = useState(savedTheme);

  useEffect(() => {
    if (theme === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }

    try {
      localStorage.setItem("theme", theme);
    } catch {
      // private mode: the choice lasts for this visit only
    }
  }, [theme]);

  return (
    <fieldset className="flex rounded-[6px] border border-rule bg-sunken p-0.5">
      <legend className="sr-only">Theme</legend>
      {THEMES.map((name) => (
        <label
          key={name}
          title={`${name[0]?.toUpperCase()}${name.slice(1)} theme`}
          className="grid size-7 cursor-pointer place-items-center rounded-[4px] text-ink-muted transition-colors duration-150 hover:text-ink has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:outline-2 has-focus-visible:outline-accent"
        >
          <input
            type="radio"
            name="theme"
            className="sr-only"
            checked={theme === name}
            onChange={() => setTheme(name)}
          />
          <Icon name={name} className="size-3.5" />
          <span className="sr-only">{name}</span>
        </label>
      ))}
    </fieldset>
  );
}
