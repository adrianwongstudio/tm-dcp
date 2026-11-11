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
import os, re, sys, json, glob, hashlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C

ASSETS = ["styles.css", "app.js", "districts.json",
          "vendor/leaflet.css", "vendor/leaflet.js",
          "vendor/leaflet.markercluster.css", "vendor/leaflet.markercluster.js"]

# The language catalogues are fetched by name from app.js, never named in the
# markup, so they are versioned through __ASSETS__ the same way the index is.
def lang_assets():
    d = C.p("docs", "i18n")
    if not os.path.isdir(d):
        return []
    return sorted("i18n/" + f for f in os.listdir(d)
                  if f.endswith(".json") and not f.startswith("_"))


def digest_path(path):
    if not os.path.exists(path):
        return None
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()[:10]


def digest(name):
    return digest_path(C.p("docs", name))


_IMPORT = re.compile(r"(from '\./(?:js/)?[a-z]+\.js)(\?v=[0-9a-f]+)?'")


def stamp_modules():
    """One hash for the whole script set, written onto every import.

    The page is app.js plus the modules in docs/js/, and a module is fetched
    by the URL its importer names. If only app.js were versioned a deploy
    could serve new app.js beside a stale module. So the hash covers all of
    them, taken with the old hash stripped, and any change to any module
    gives every import a new URL. Returns the hash, which versions app.js.
    """
    paths = [C.p("docs", "app.js")] + sorted(glob.glob(C.p("docs", "js", "*.js")))
    plain = {}
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            plain[path] = _IMPORT.sub(r"\1'", fh.read())
    h = hashlib.sha256("".join(plain[p] for p in paths).encode()).hexdigest()[:10]
    for path, text in plain.items():
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(_IMPORT.sub(rf"\1?v={h}'", text))
    return h


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
        # geo.json is written by a different schedule from the other two, so
        # it carries its own hash: a month with no club moving must not force
        # every reader to re-fetch a map that has not changed.
        for key, name in (("vd", "data.json"), ("v", "live.json"),
                          ("vg", "geo.json"), ("vf", "forecast.json")):
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

    modules = stamp_modules()
    versions = {name: digest(name) for name in ASSETS + lang_assets()}
    versions["app.js"] = modules
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
    # A JSON block, not a script: it changes every build, and an executable
    # inline script would need a new Content-Security-Policy hash each time.
    block = ('<script type="application/json" id="assets">{' +
             ",".join(f'"{n}":"{n}?v={v}"' for n, v in versions.items() if v) + "}</script>")
    if 'id="assets"' in html:
        html = re.sub(r'<script type="application/json" id="assets">.*?</script>', block, html, flags=re.S)
    elif "window.__ASSETS__" in html:
        html = re.sub(r"<script>window\.__ASSETS__=.*?</script>", block, html, flags=re.S)
    else:
        html = html.replace("</head>", block + "\n</head>")

    with open(html_path, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"  stamped {changed} references: " +
          ", ".join(f"{n}={v}" for n, v in versions.items() if v))


if __name__ == "__main__":
    main()
