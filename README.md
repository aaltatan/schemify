# schemify editor

Build JSON Schemas in the browser, the web version of
[`schemify generate`](../../cli/schemify). Every question the CLI asks is a field here, and the
schema updates as you type. Copy or download it, then fill it with `schemify fill`.

```bash
pnpm install
pnpm dev
```

After changing the schemify package, refresh what the editor reads from it and check both agree:

```bash
pnpm sync && pnpm check
```
