import { useMemo, useState } from "react";
import { buildSchema, newProperty, type ObjectNode } from "../core/generators.ts";
import { ObjectEditor } from "./editors.tsx";

export function App() {
  const [title, setTitle] = useState("");
  const [root, setRoot] = useState<ObjectNode>({
    type: "object",
    properties: [newProperty()],
    extraProperties: false,
  });
  const { schema, issues } = useMemo(() => buildSchema(root, title.trim()), [root, title]);
  const json = JSON.stringify(schema, null, 2); // like the CLI's `to_json`
  const issueCount = Object.keys(issues).length;

  const download = () => {
    const url = URL.createObjectURL(new Blob([`${json}\n`], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: `${title.trim() || "schema"}.json`,
    });

    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <header className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <h1 className="text-lg font-semibold">
          schemify <span className="font-normal text-neutral-500">generate</span>
        </h1>
      </header>
      <main className="mx-auto grid max-w-7xl gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              Title of the schema (optional)
            </span>
            <input
              className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-neutral-700 dark:bg-neutral-900"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <ObjectEditor node={root} path="root" issues={issues} onChange={setRoot} />
        </div>
        <aside className="flex flex-col gap-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-sm ${issueCount ? "text-red-600 dark:text-red-400" : "text-neutral-500"}`}
              role="status"
            >
              {issueCount
                ? `${issueCount} answer${issueCount > 1 ? "s" : ""} to fix`
                : "Valid schema"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={issueCount > 0}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-200 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
                onClick={() => navigator.clipboard.writeText(json)}
              >
                Copy
              </button>
              <button
                type="button"
                disabled={issueCount > 0}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-40"
                onClick={download}
              >
                Download
              </button>
            </div>
          </div>
          <pre className="overflow-auto rounded-lg bg-neutral-950 p-4 font-mono text-xs leading-relaxed text-neutral-100">
            {json}
          </pre>
        </aside>
      </main>
    </div>
  );
}
