#!/usr/bin/env python3
"""Write fusion_rover manifest from bounds JSON (stdin or file). Meshes loaded via viewer."""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "meshes", "fusion_rover")


def main():
    if len(sys.argv) < 2:
        print("Usage: assemble_fusion_export.py bounds.json", file=sys.stderr)
        sys.exit(1)
    with open(sys.argv[1], encoding="utf-8") as f:
        parts = json.load(f)
    os.makedirs(OUT, exist_ok=True)
    manifest = {"parts": [], "exportedAt": None, "modelCenter": {"x": 0, "y": 0, "z": 0}}
    cx = cy = cz = 0
    n = 0
    for p in parts:
        b = p["b"]
        manifest["parts"].append(
            {
                "name": p["name"].replace(" ", "_").replace("(", "").replace(")", ""),
                "bounds": {
                    "min": b["min"],
                    "max": b["max"],
                    "center": b["center"],
                    "size": b["size"],
                },
            }
        )
        cx += b["center"]["x"]
        cy += b["center"]["y"]
        cz += b["center"]["z"]
        n += 1
    if n:
        manifest["modelCenter"] = {"x": cx / n, "y": cy / n, "z": cz / n}
    path = os.path.join(OUT, "manifest.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print("Wrote", path, "with", n, "parts")


if __name__ == "__main__":
    main()
