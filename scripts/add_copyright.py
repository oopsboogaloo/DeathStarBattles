#!/usr/bin/env python3
# Copyright © 2026 Chloe Bolland
# contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way
"""Add the copyright/contact notice to all source files and SVGs (idempotent).

Re-run after adding new source/SVG files: it skips files that already carry the
notice and inserts it into the rest.
"""
import glob
import os

MARKER = "Copyright © 2026 Chloe Bolland"
CONTACT = ("contact chloe@mammoththoughts.com if you wish to use, publish or "
           "reproduce this game or any part of it in any way")

JS_BLOCK = f"// {MARKER}\n// {CONTACT}\n\n"
XML_COMMENT = f"<!--\n  {MARKER}\n  {CONTACT}\n-->\n"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def write(path, text):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def add_js(path):
    text = read(path)
    if MARKER in text:
        return False
    write(path, JS_BLOCK + text)
    return True


def add_after_first_line(path, predicate):
    """Insert XML_COMMENT after the first line if predicate(first_line), else prepend."""
    text = read(path)
    if MARKER in text:
        return False
    lines = text.split("\n", 1)
    first = lines[0]
    rest = lines[1] if len(lines) > 1 else ""
    if predicate(first):
        write(path, first + "\n" + XML_COMMENT + rest)
    else:
        write(path, XML_COMMENT + text)
    return True


def main():
    changed, skipped = [], []

    # JS source files
    for path in sorted(glob.glob(os.path.join(ROOT, "src", "**", "*.js"), recursive=True)):
        (changed if add_js(path) else skipped).append(os.path.relpath(path, ROOT))

    # SVG files (insert after the <?xml ...?> declaration)
    svg_dirs = ["Images", os.path.join("assets", "sprites"), os.path.join("assets", "svg")]
    for d in svg_dirs:
        for path in sorted(glob.glob(os.path.join(ROOT, d, "*.svg"))):
            ok = add_after_first_line(path, lambda ln: ln.lstrip().startswith("<?xml"))
            (changed if ok else skipped).append(os.path.relpath(path, ROOT))

    # Game HTML entry points (insert after the <!DOCTYPE ...> line)
    for name in ["index.html", "game.html"]:
        path = os.path.join(ROOT, name)
        if os.path.exists(path):
            ok = add_after_first_line(path, lambda ln: ln.lstrip().lower().startswith("<!doctype"))
            (changed if ok else skipped).append(name)

    print(f"Changed {len(changed)} files:")
    for c in changed:
        print("  +", c)
    if skipped:
        print(f"Skipped {len(skipped)} (already had notice):")
        for s in skipped:
            print("  =", s)


if __name__ == "__main__":
    main()
