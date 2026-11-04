import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { type Draft, newDraft, readList } from "../core/fillers.ts";
import { buildSchema, newProperty, type ObjectNode } from "../core/generators.ts";
import { readSchema } from "../core/reader.ts";
import {
  ADD_BUTTON,
  BUTTON,
  Check,
  ICON_BUTTON,
  Icon,
  INPUT,
  Logo,
  ThemeSwitch,
} from "./controls.tsx";
import { ObjectEditor } from "./editors.tsx";
import { FillForm } from "./fillers.tsx";

const WORKSPACE = "workspace";

const MODES = ["generate", "fill"] as const;

type Mode = (typeof MODES)[number];

type Workspace = { title: string; root: ObjectNode };

// hash routes (#/generate, #/fill) so a reload or a shared link works on any static host
function onHashChange(callback: () => void) {
  addEventListener("hashchange", callback);

  return () => removeEventListener("hashchange", callback);
}

function currentMode(): Mode {
  return location.hash === "#/fill" ? "fill" : "generate";
}

// shortcut: trusts the saved shape, add a version key when Node changes incompatibly
function savedWorkspace(): Workspace {
  try {
    const saved = JSON.parse(localStorage.getItem(WORKSPACE) ?? "null");

    if (saved?.root?.type === "object") {
      return saved;
    }
  } catch {
    // blocked storage or bad JSON: start fresh
  }

  return {
    title: "",
    root: { type: "object", properties: [newProperty()], extraProperties: false },
  };
}

export function App() {
  const [initial] = useState(savedWorkspace);
  const [title, setTitle] = useState(initial.title);
  const [root, setRoot] = useState<ObjectNode>(initial.root);

  useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE, JSON.stringify({ title, root }));
    } catch {
      // private mode: the workspace lasts for this visit only
    }
  }, [title, root]);

  const { schema, issues } = useMemo(() => buildSchema(root, title.trim()), [root, title]);
  // the fill answers are kept for this visit only, one draft per item in list mode
  const mode = useSyncExternalStore(onHashChange, currentMode);
  const [asList, setAsList] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const items = drafts.length > 0 ? drafts : [newDraft(schema)];
  const shown = asList ? items : items.slice(0, 1);
  const filled = readList(schema, shown);
  const filling = mode === "fill";

  const setItem = (index: number, draft: Draft) => setDrafts(items.with(index, draft));

  // like the CLI's `to_json`
  const json = JSON.stringify(filling ? (asList ? filled.data : filled.data[0]) : schema, null, 2);
  const issueCount = filling
    ? filled.issues.reduce((total, itemIssues) => total + Object.keys(itemIssues).length, 0)
    : Object.keys(issues).length;
  const fileName = filling
    ? `${title.trim() || "data"}.data.json`
    : `${title.trim() || "schema"}.json`;

  // the JSON being typed or pasted, kept until it reads into the editor and loses focus
  const [draft, setDraft] = useState<string | null>(null);
  const [readError, setReadError] = useState("");
  const [copied, setCopied] = useState(false);

  const editJson = (text: string) => {
    setDraft(text);

    try {
      const read = readSchema(text);

      setRoot(read.root);
      setTitle(read.title);
      setReadError("");
    } catch (e) {
      setReadError((e as Error).message);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([`${json}\n`], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: fileName });

    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col text-ink">
      <header className="sticky top-0 z-40 border-b border-rule bg-sheet/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <h1 className="flex items-center gap-2.5">
            <Logo />
            <span className="text-base font-semibold tracking-[-0.02em]">schemify</span>
            <span className="h-4 w-px bg-rule-strong" aria-hidden="true" />
            <span className="sr-only">, the JSON Schema editor</span>
          </h1>
          <nav
            aria-label="Command"
            className="mr-auto flex rounded-[6px] border border-rule bg-sunken p-0.5"
          >
            {MODES.map((name) => (
              <a
                key={name}
                href={`#/${name}`}
                aria-current={mode === name ? "page" : undefined}
                className="rounded-[4px] px-2.5 py-1 font-mono text-[0.8125rem] text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent"
              >
                {name}
              </a>
            ))}
          </nav>
          <ThemeSwitch />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-8">
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] text-ink-muted">Title of the schema (optional)</span>
            <input
              className={`${INPUT} h-11 text-lg font-semibold tracking-tight`}
              placeholder="Untitled schema"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          {filling ? (
            <>
              {Object.keys(issues).length > 0 && (
                <p className="text-sm text-danger" role="alert">
                  Fix the schema in generate first, its answers with issues are left out here.
                </p>
              )}
              <Check label="Fill a list of items" checked={asList} onChange={setAsList} />
              {shown.map((draft, index) => (
                <section
                  // items have no id, the index is their identity like in the data
                  // biome-ignore lint/suspicious/noArrayIndexKey: see above
                  key={index}
                  className="flex flex-col gap-4 rounded-[6px] border border-rule bg-sheet p-4 shadow-[0_1px_2px_oklch(0.2_0.05_258/0.06)]"
                >
                  {asList && (
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold">Item {index + 1}</h2>
                      <button
                        type="button"
                        className={`${ICON_BUTTON} hover:bg-danger-soft hover:text-danger`}
                        disabled={shown.length === 1}
                        onClick={() => setDrafts(items.filter((_, i) => i !== index))}
                        aria-label={`Remove item ${index + 1}`}
                      >
                        <Icon name="x" />
                      </button>
                    </div>
                  )}
                  <FillForm
                    schema={schema}
                    draft={draft}
                    data={filled.data[index]}
                    issues={filled.issues[index] ?? {}}
                    onChange={(changed) => setItem(index, changed)}
                  />
                </section>
              ))}
              {asList && (
                <button
                  type="button"
                  className={ADD_BUTTON}
                  onClick={() => setDrafts([...items, newDraft(schema)])}
                >
                  <Icon name="plus" />
                  Add another item ({shown.length} so far)
                </button>
              )}
            </>
          ) : (
            <ObjectEditor node={root} path="root" issues={issues} onChange={setRoot} />
          )}
        </div>
        <aside className="flex min-h-[28rem] flex-col overflow-hidden rounded-[6px] border border-print-rule bg-print text-print-ink shadow-[0_10px_30px_-12px_oklch(0.2_0.06_258/0.45)] transition-[border-color] duration-150 has-[textarea:focus-visible]:border-print-ink/45 lg:sticky lg:top-20 lg:h-[calc(100vh-9rem)] lg:self-start">
          <div className="flex items-center justify-between gap-3 border-b border-print-rule py-2 pr-2 pl-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`size-2 shrink-0 rounded-full ${issueCount ? "bg-[oklch(0.72_0.16_25)]" : "bg-[oklch(0.78_0.13_160)]"}`}
                aria-hidden="true"
              />
              <span className="truncate font-mono text-[0.8125rem]">{fileName}</span>
              <span className="shrink-0 text-xs text-print-ink/65 max-sm:sr-only" role="status">
                {issueCount
                  ? `${issueCount} answer${issueCount > 1 ? "s" : ""} to fix`
                  : filling
                    ? "Valid data"
                    : "Valid schema"}
              </span>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={issueCount > 0}
                className={`${BUTTON} h-8 text-print-ink/80 hover:bg-print-rule hover:text-print-ink`}
                onClick={copy}
              >
                <Icon name={copied ? "check" : "copy"} className="size-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                disabled={issueCount > 0}
                className={`${BUTTON} h-8 bg-print-ink text-print hover:bg-white`}
                onClick={download}
              >
                <Icon name="download" className="size-3.5" />
                Download
              </button>
            </div>
          </div>
          {readError && (
            <p
              className="border-b border-print-rule bg-[oklch(0.35_0.09_25/0.35)] px-4 py-2 text-xs text-[oklch(0.88_0.07_25)]"
              role="alert"
            >
              {readError}
            </p>
          )}
          <textarea
            aria-label={filling ? "The filled data" : "JSON Schema, edit or paste one to load it"}
            readOnly={filling}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed text-print-ink caret-print-ink outline-none selection:bg-print-rule focus-visible:outline-none"
            value={filling ? json : (draft ?? json)}
            onChange={(e) => editJson(e.target.value)}
            onBlur={() => !readError && setDraft(null)}
          />
        </aside>
      </main>
      <footer className="sticky bottom-0 z-40 border-t border-rule bg-sheet/90 backdrop-blur-sm">
        <div className="mx-auto flex h-10 max-w-7xl items-center gap-2 px-4 text-xs text-ink-muted">
          <span>© {new Date().getFullYear()}</span>
          <a
            href="https://github.com/aaltatan"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-ink underline decoration-rule-strong underline-offset-4 transition-colors duration-150 hover:text-accent hover:decoration-accent"
          >
            <Icon name="github" className="size-3.5" />
            Abdullah Altatan
          </a>
        </div>
      </footer>
    </div>
  );
}
