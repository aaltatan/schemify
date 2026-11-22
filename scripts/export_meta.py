"""Export what the editor reads from the schemify package to `src/core/meta.json`.

Run with `pnpm sync`, inside the schemify CLI project's environment, after changing its
generators or constraints.
"""

import json
from pathlib import Path

from schemify.generators import SCHEMA_DIALECT, generators
from schemify.validators import ARRAY_CONSTRAINTS, NUMBER_CONSTRAINTS, STRING_CONSTRAINTS

OUTPUT = Path(__file__).resolve().parents[1] / "src" / "core" / "meta.json"


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
    }

    OUTPUT.write_text(f"{json.dumps(meta, indent=2, ensure_ascii=False)}\n", encoding="utf-8")
    print(f"Saved to: {OUTPUT}")


if __name__ == "__main__":
    main()
