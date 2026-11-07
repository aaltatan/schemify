"""Export what the editor reads from the schemify package to `src/core/meta.json`.

Run with `pnpm sync`, inside the schemify CLI project's environment, after changing its
generators, constraints or computers.
"""

import inspect
import json
from pathlib import Path

from schemify.computers import computers, groups
from schemify.generators import SCHEMA_DIALECT, generators, options_example
from schemify.validators import ARRAY_CONSTRAINTS, NUMBER_CONSTRAINTS, STRING_CONSTRAINTS

OUTPUT = Path(__file__).resolve().parents[1] / "src" / "core" / "meta.json"


def _computer(name: str) -> dict[str, object]:
    fn = computers[name]
    signature = inspect.signature(fn)

    return {
        "signature": f"{name}{signature}",
        "summary": (inspect.getdoc(fn) or "").split("\n\n")[0],
        # `examples[n]` is the options example once `n` sources are picked, from Python itself
        # since it reads the parameter annotations and defaults
        "examples": [options_example(fn, n) for n in range(len(signature.parameters) + 1)],
    }


def main() -> None:
    meta = {
        "dialect": SCHEMA_DIALECT,
        "types": generators.names,
        "constraints": {
            kind: [[keyword, question] for keyword, question, *_ in constraints]
            for kind, constraints in [
                ("string", STRING_CONSTRAINTS),
                ("number", NUMBER_CONSTRAINTS),
                ("array", ARRAY_CONSTRAINTS),
            ]
        },
        "groups": groups,
        "computers": {name: _computer(name) for name in computers.names},
    }

    OUTPUT.write_text(f"{json.dumps(meta, indent=2, ensure_ascii=False)}\n", encoding="utf-8")
    print(f"Saved to: {OUTPUT}")


if __name__ == "__main__":
    main()
