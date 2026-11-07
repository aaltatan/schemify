# schemify editor

Build JSON Schemas in the browser, and fill data from them: the web version of the
[schemify CLI](https://github.com/aaltatan/schemify-cli). Frontend only, no backend.

- Live: [schemify.surge.sh](https://schemify.surge.sh)
- Source: [github.com/aaltatan/schemify](https://github.com/aaltatan/schemify)

- **Generate** mirrors `schemify generate`: every question the CLI asks is a field here, and the
  schema updates as you type. Copy or download it.
- **Fill** mirrors `schemify fill` and `schemify list`: a form for one object or a list of them,
  checked against the schema (Ajv, Draft 2020-12), with `x-compute` properties computed live.

Both produce the same JSON as the CLI, key for key.

## Run

```bash
pnpm install
pnpm dev
```

## Develop

```bash
pnpm check   # typecheck, Biome, Vitest
pnpm build
```

`src/core/meta.json` (type names, constraint questions, computer signatures) is generated from
the [schemify CLI](https://github.com/aaltatan/schemify-cli), never edited by hand. After changing
the CLI, refresh it and check both agree:

```bash
pnpm sync && pnpm check
```

`src/core/` is pure logic mirroring the Python modules file for file; `src/ui/` is the React UI.
