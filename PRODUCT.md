# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers who know JSON Schema and want to build one faster than hand-writing JSON or
answering the `schemify generate` prompts one at a time.

## Product Purpose

The web version of `schemify generate`: every question the CLI asks is a form field, and the
schema updates live as you type. The schema can be copied, downloaded, or pasted back in to keep
editing it, then filled with `schemify fill`.

## Positioning

It mirrors the schemify CLI's generator exactly: the same questions, validation, computers and
key order, so the editor and the CLI produce the same JSON.

## Capabilities and Constraints

- Frontend only, no backend. React, Tailwind and TypeScript.
- Types, constraint keywords and computer signatures come from `src/core/meta.json`, generated
  from the Python package.
- A rejected answer shows as an issue on its field instead of being asked again.

## Product Principles

- The CLI is the source of truth; the editor never asks something the CLI would not.
- The live JSON is the product; the form is how you get there.
- Errors sit on the field that caused them.
