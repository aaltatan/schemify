# CLAUDE.md — schemify editor

A React + Tailwind + TypeScript editor for building JSON Schemas, the web version of
`schemify generate`. Frontend only, no backend.

## Linked project: the schemify CLI

The Python package lives at `../../cli/schemify` (`C:\Users\aaltt\dev\published\cli\schemify`).
This editor mirrors its `generate` logic and both must stay in step:

- **A feature added here is added to the schemify package too** (and the other way round):
  the Python generator, validators or computers first, with its pytest test, then the
  TypeScript mirror, with its Vitest test. Never ship a feature in one only.
- Mirrors, file for file:
  - `src/core/generators.ts` ↔ `src/schemify/generators.py` (a `Node` holds the answers
    Python prompts for; a rejected answer becomes an issue instead of being asked again)
  - `src/core/validators.ts` ↔ `src/schemify/validators.py`
  - `src/core/models.ts` ↔ `src/schemify/models.py`
  - `src/core/generators.test.ts` ↔ `tests/test_generators.py` (same cases)
  - `src/core/fillers.ts` ↔ `src/schemify/fillers.py` (a `Draft` holds the answers, a
    rejected one becomes an issue keyed by its path), `fillers.test.ts` ↔ `tests/test_fillers.py`
  - `src/core/computers.ts` ↔ `src/schemify/computers.py` (called by the Python signatures in
    `meta.json`), `computers.test.ts` ↔ `tests/test_computers.py`
  - `checkValue` in `validators.ts` uses Ajv (Draft 2020-12) like jsonschema in `check_value`,
    with jsonschema's messages
- `src/core/meta.json` is generated from Python, never edited by hand: the type names, the
  constraint keywords and questions, and every computer's signature, summary and options
  examples. Regenerate it with `pnpm sync` (runs `scripts/export_meta.py` in the CLI's uv env)
  after changing those in Python.
- `src/core/meta.test.ts` fails when `meta.json` has a type or constraint keyword the editor
  does not handle yet. Run `pnpm sync && pnpm check` after any change in the CLI.
- Keep the same key order in the generated schema as Python (`title`, `description`, then the
  type's keywords; `x-compute` last), so both produce the same JSON.

## Layout

```
scripts/export_meta.py   writes src/core/meta.json from the schemify package
src/core/                pure logic, no React
src/ui/                  app.tsx (title, generate / fill switch, live JSON, copy/download),
                         editors.tsx (one per type), fillers.tsx (the fill form)
```

## Commands

`pnpm dev`, `pnpm sync`, `pnpm check` (typecheck, Biome, Vitest).
