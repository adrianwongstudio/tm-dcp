"""Collect every English string the board can show, and check the catalogues.

The English in docs/index.html and docs/app.js is the source. A catalogue in
docs/i18n/<lang>.json is keyed by that English, so a key that goes missing
falls back to the words already in the markup rather than to a blank or a
label like "hero.lede.1". That is also why this script exists: nothing points
at the catalogues from the page, so without a check they drift silently.

  python3 scripts/i18n_extract.py          # write _source.json, report drift
  python3 scripts/i18n_extract.py --check  # report only, non-zero if stale

Run it after changing any English text, then fix what it names.
"""
import os, re, sys, json, html

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C

# Markup whose innerHTML is a key, and the two attributes that carry one.
EL = re.compile(r'<(\w+)\s[^>]*\bdata-i18n(?![\w-])[^>]*>(.*?)</\1>', re.S)
LABEL = re.compile(r'<\w+(?:\s[^>]*)?\saria-label="([^"]+)"(?:\s[^>]*)?\sdata-i18n-label', re.S)
LABEL2 = re.compile(r'<\w+(?:\s[^>]*)?\sdata-i18n-label(?:\s[^>]*)?\saria-label="([^"]+)"', re.S)
PH = re.compile(r'<\w+(?:\s[^>]*)?\splaceholder="([^"]+)"(?:\s[^>]*)?\sdata-i18n-ph', re.S)
PH2 = re.compile(r'<\w+(?:\s[^>]*)?\sdata-i18n-ph(?:\s[^>]*)?\splaceholder="([^"]+)"', re.S)
# T('…') and T("…") in app.js, single-line literals only — a string broken
# across lines is a string a translator cannot be handed anyway.
TCALL = re.compile(r"\bT\(\s*(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")")


def norm(s):
    """What the browser's innerHTML gives back: entities resolved, runs of
    whitespace collapsed to one space."""
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def unjs(s):
    return (s.replace("\\'", "'").replace('\\"', '"')
             .replace("\\n", "\n").replace("\\\\", "\\")
             .replace("\\u2014", "—").replace("\\u2013", "–")
             .replace("\\u00b7", "·").replace("\\u2026", "…"))


def from_markup(path):
    with open(path, encoding="utf-8") as fh:
        src = fh.read()
    src = src[src.index("<body>"):]
    out = []
    for m in EL.finditer(src):
        out.append(norm(m.group(2)))
    for rx in (LABEL, LABEL2, PH, PH2):
        out += [norm(x) for x in rx.findall(src)]
    return out


def from_js(path):
    with open(path, encoding="utf-8") as fh:
        src = fh.read()
    # comments explain T() as often as they call it, so they go first
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    src = re.sub(r"(?m)^\s*//.*$", "", src)
    return [unjs(a or b) for a, b in TCALL.findall(src)]


# Some labels never appear as a literal: the goal names, the window names and
# the recognition levels arrive in the data, and the counting words come out of
# an array. They are shown to the reader all the same, so a catalogue needs
# them and this script has to know they are not orphans.
ARRAYS = ("SHORT", "GOAL10", "NUM")
# config.json's own wording reaches the page through the data documents
CONFIG_KEYS = ("eyebrow", "title_suffix")
UPDATE_KEYS = ("cadence", "weekday")


def from_data(js_src):
    out = []
    for name in ARRAYS:
        m = re.search(rf"const {name}=\[(.*?)\];", js_src, re.S)
        if m:
            out += [a or b for a, b in re.findall(
                r'"((?:[^"\\]|\\.)*)"|\'((?:[^\'\\]|\\.)*)\'', m.group(1))]
    m = re.search(r"const LVL=\[(.*?)\];", js_src, re.S)
    if m:
        out += [a or b for a, b in re.findall(
            r'"((?:[^"\\]|\\.)*)"|\'((?:[^\'\\]|\\.)*)\'', m.group(1))]
    # one district is enough: every district's documents carry the same labels
    for rel in (("docs", "d", "21", "live.json"), ("docs", "d", "21", "data.json")):
        path = C.p(*rel)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            doc = json.load(fh)
        out += doc.get("goals", []) + doc.get("rows", [])
        out += [w.get("lbl", "") for w in (doc.get("agg", {}).get("close") or [])]
    cfg = C.p("config.json")
    if os.path.exists(cfg):
        with open(cfg, encoding="utf-8") as fh:
            site = (json.load(fh) or {}).get("site", {})
        out += [site.get(k, "") for k in CONFIG_KEYS]
        cfg_all = json.load(open(cfg, encoding="utf-8")) or {}
        upd = cfg_all.get("updates", {})
        out += [upd.get(k, "") for k in UPDATE_KEYS]
    return [unjs(x) for x in out if x]


def main():
    check = "--check" in sys.argv
    with open(C.p("docs", "app.js"), encoding="utf-8") as fh:
        js_src = fh.read()
    keys = (from_markup(C.p("docs", "index.html")) + from_js(C.p("docs", "app.js"))
            + from_data(js_src))
    keys = [k for k in keys if k]
    uniq = sorted(set(keys), key=lambda s: (len(s), s))
    print(f"  {len(keys)} strings, {len(uniq)} unique")

    d = C.p("docs", "i18n")
    os.makedirs(d, exist_ok=True)
    src_path = os.path.join(d, "_source.json")
    if not check:
        with open(src_path, "w", encoding="utf-8") as fh:
            json.dump(uniq, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
        print(f"  wrote {os.path.relpath(src_path, C.p())}")

    stale = 0
    for name in sorted(os.listdir(d)):
        if not name.endswith(".json") or name.startswith("_"):
            continue
        with open(os.path.join(d, name), encoding="utf-8") as fh:
            cat = json.load(fh)
        cat = {k: v for k, v in cat.items() if not k.startswith("_")}
        missing = [k for k in uniq if k not in cat]
        orphan = [k for k in cat if k not in set(uniq)]
        flag = "" if not (missing or orphan) else "  <-- stale"
        print(f"  {name:14s} {len(cat):4d} strings, {len(missing):3d} missing, "
              f"{len(orphan):3d} no longer in the page{flag}")
        for k in missing[:5]:
            print(f"      missing: {k[:90]}")
        for k in orphan[:5]:
            print(f"      orphan:  {k[:90]}")
        stale += len(missing) + len(orphan)

    if check and stale:
        sys.exit(1)


if __name__ == "__main__":
    main()
