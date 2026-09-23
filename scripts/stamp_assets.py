"""Stamp content hashes onto the assets index.html loads.

GitHub Pages caches every file for ten minutes independently. Right after a
deploy a browser can therefore hold new markup beside a stale app.js — which
looks exactly like a broken feature: the element is in the page and nothing
ever fills it.

Versioning the URLs makes a deploy atomic from the browser's side. index.html
is the entry point and carries the hashes, so when it changes the browser is
forced to fetch the assets it names. The per-district data is versioned the
same way, but through districts.json rather than index.html: 188 data files
cannot each be named in the markup.

Run after anything that rewrites docs/. Idempotent.
"""
import os, re, sys, json, hashlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C

ASSETS = ["styles.css", "app.js", "districts.json"]


def digest_path(path):
    if not os.path.exists(path):
        return None
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()[:10]


def digest(name):
    return digest_path(C.p("docs", name))


def stamp_districts():
    """Hash each district's data into districts.json, so app.js can ask for a
    versioned URL without index.html having to name 188 files."""
    path = C.p("docs", "districts.json")
    if not os.path.exists(path):
        print("  no districts.json — nothing to stamp")
        return
    doc = json.load(open(path, encoding="utf-8"))
    n = 0
    for did, entry in doc["districts"].items():
        for key, name in (("vd", "data.json"), ("v", "live.json")):
            h = digest_path(C.p("docs", "d", did, name))
            if h:
                entry[key] = h
                n += 1
    json.dump(doc, open(path, "w", encoding="utf-8"), separators=(",", ":"))
    print(f"  stamped {n} district data files")


def main():
    # First, because it rewrites districts.json, whose own hash is taken below.
    stamp_districts()

    html_path = C.p("docs", "index.html")
    with open(html_path, encoding="utf-8") as fh:
        html = fh.read()

    versions = {name: digest(name) for name in ASSETS}
    missing = [n for n, v in versions.items() if v is None]
    if missing:
        print(f"  missing, not stamped: {', '.join(missing)}")

    changed = 0
    for name, ver in versions.items():
        if ver is None:
            continue
        # match the file wherever it is referenced, with or without an old ?v=
        pattern = re.compile(rf'({re.escape(name)})(\?v=[0-9a-f]+)?(["\'])')
        html, n = pattern.subn(rf'\g<1>?v={ver}\g<3>', html)
        changed += n

    # app.js fetches the index itself, so hand it the versioned URL rather than
    # letting it request an unversioned copy the preload never warmed.
    block = ("<script>window.__ASSETS__=" +
             "{" + ",".join(f'"{n}":"{n}?v={v}"' for n, v in versions.items() if v) + "};</script>")
    if "window.__ASSETS__" in html:
        html = re.sub(r"<script>window\.__ASSETS__=.*?</script>", block, html, flags=re.S)
    else:
        html = html.replace("</head>", block + "\n</head>")

    with open(html_path, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"  stamped {changed} references: " +
          ", ".join(f"{n}={v}" for n, v in versions.items() if v))


if __name__ == "__main__":
    main()
