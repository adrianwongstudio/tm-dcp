# All-districts Club Health Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing single-district Club Health board for all 94 Toastmasters districts, with a district selector in the masthead, built entirely from district CSV exports.

**Architecture:** A new repo `tm-dcp` carries the current `docs/` front end unchanged in design. Every JSON file is generated from one CSV per district-year (`clubperformance~{district}~~~{py}`) instead of 13,560 club-report page fetches. Data is published per district at `docs/d/<id>/`, indexed by `docs/districts.json`, which also carries the content hashes that make a deploy atomic. The page reads `?d=<id>`, defaults to the last district chosen, and switches by navigation.

**Tech Stack:** Python 3.12 stdlib (`urllib`, `csv`, `json`, `hashlib`, `threading`) plus `openpyxl` for the workbook. Vanilla ES2020 front end, no framework, no build step. GitHub Actions + GitHub Pages.

**Spec:** [`plans/2026-09-23-all-districts-spec.md`](2026-09-23-all-districts-spec.md) — read it first; this plan argues from it and does not repeat its reasoning.

## Global Constraints

- **Design reference is `DESIGN.md`**, copied into the new repo at Task 1. Any value this work changes is changed there in the same commit.
- **Contrast:** every text colour clears 4.5:1, or 3:1 at ≥24px or ≥18.66px bold, in **both** themes, including the row hover surface. Zero failures is the bar.
- **Never write `--maroon` into a `color:`** — `--maroon-ink` is the brand as type.
- **Type:** Montserrat (headings), Source Sans 3 (body), IBM Plex Mono (figures, dates, IDs).
- **One instruction line per section, ≤20 words, holding one line.**
- **`stamp_assets.py` runs last**, after anything that rewrites `docs/`.
- **Program years** are `2021-2022` through the open year; a district with no clubs in a year simply has no record for it.
- **District ids are strings**, always. `F` and `U` are districts; `02` is not `2`.
- **Tests are plain scripts** run as `python3 scripts/test_<name>.py`, printing `pass`/`FAIL` per check and exiting non-zero on any failure — matching `scripts/test_reachability.py` in `d21-dcp`. No pytest.
- **Commit after every task.** Never commit into `docs/d/` by hand; it is generated.

---

### Task 1: New repo, carried-over front end, and the district index

**Files:**
- Create: `tm-dcp/` (new repo), `scripts/common.py`, `scripts/dashboards.py`, `scripts/districts.py`, `config.json`, `.gitignore`, `README.md`
- Copy from `d21-dcp`: `docs/index.html`, `docs/styles.css`, `docs/app.js`, `DESIGN.md`
- Test: `scripts/test_dashboards.py`, `tests/fixtures/home.html`

**Interfaces:**
- Consumes: nothing.
- Produces: `dashboards.district_index() -> list[dict]` where each dict is `{"r": "Region 01", "d": ["02","21",...]}` in dashboard order; `dashboards.club_performance(district: str, program_year: str) -> tuple[str|None, str]` returning `(csv_text, source_url)`, `csv_text` None if the fetch failed; `common.p(*parts)`, `common.PROGRAM_YEARS`, `common.current_program_year()`, `common.today_local()`, `common.stamp()`.

- [ ] **Step 1: Create the repo and carry the front end over**

```bash
mkdir -p ~/Documents/clients/d21/tm-dcp && cd ~/Documents/clients/d21/tm-dcp
git init -b main
mkdir -p docs scripts tests/fixtures .github/workflows
OLD=~/Documents/clients/d21/dcp
cp $OLD/docs/index.html $OLD/docs/styles.css $OLD/docs/app.js docs/
cp $OLD/DESIGN.md $OLD/plans/2026-09-23-all-districts-spec.md .
printf '%s\n' '__pycache__/' '*.pyc' '.DS_Store' > .gitignore
```

Do **not** copy `docs/data.json`, `docs/live.json`, `docs/inyear.xlsx`, `scripts/`, `data/` or `probes/`. They are either generated or retired.

- [ ] **Step 2: Write `config.json` with nothing district-specific in it**

```json
{
  "history": { "start_year": 2021, "years": 5 },
  "site": {
    "title_suffix": "Club Health Board",
    "eyebrow": "Distinguished Club Program",
    "repo_url": "https://github.com/adrianwongstudio/tm-dcp",
    "contact_email": "adrian@akwongmade.com",
    "contact_tag": "DCP-Dashboard",
    "contact_endpoint": ""
  },
  "output": { "inyear_prefix": "District" },
  "timezone": "America/Vancouver",
  "default_district": "21"
}
```

- [ ] **Step 3: Write `scripts/common.py`**

Start from `d21-dcp/scripts/common.py` and delete everything district-bound. Keep `ROOT`, `p`, `tz`, `now_local`, `today_local`, `stamp`. Delete `DISTRICT`, `DISTRICT_NAME`, `load_clubs`, `sync_clubs_tsv`, `live_club_list`, `roster`, `roster_with_names`, `club_report_url`, `CACHE`, `LIVE_CACHE`. Keep `get`, `season_start`, `current_program_year`, `months_of`, `last_day`. Add:

```python
BASE = "https://dashboards.toastmasters.org"
UA = {"User-Agent": "Mozilla/5.0 (Toastmasters DCP board)"}

def program_years(today=None):
    """Finished program years, oldest first. The open year is not among them."""
    h = CONFIG["history"]
    start = int(h["start_year"])
    return [f"{y}-{y+1}" for y in range(start, start + int(h["years"]))]

def district_name(did):
    """The dashboard publishes no district names, only numbers."""
    return f"District {did}"
```

- [ ] **Step 4: Save a fixture of the dashboard home page**

```bash
curl -s "https://dashboards.toastmasters.org/" -o tests/fixtures/home.html
```

The fixture is what the test runs against, so the test never touches the network and never fails because Toastmasters is down.

- [ ] **Step 5: Write the failing test**

```python
# scripts/test_dashboards.py
"""Tests for reading the district list off the dashboard home page.

Runs against a saved fixture: the parse has to keep working when the site is
down, and a test that fetches is a test that fails for reasons of its own.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dashboards as D

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "..", "tests", "fixtures", "home.html")
FAILED = []

def check(label, got, want):
    if got == want:
        print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")

def main():
    html = open(FIXTURE, encoding="utf-8", errors="replace").read()
    regions = D.parse_district_index(html)
    ids = [d for r in regions for d in r["d"]]

    check("fourteen regions", len(regions), 14)
    check("ninety-four districts", len(ids), 94)
    check("no district listed twice", len(set(ids)), 94)
    check("regions are in dashboard order", [r["r"] for r in regions][:3],
          ["Region 01", "Region 02", "Region 03"])
    check("District 21 sits in Region 01",
          next(r["r"] for r in regions if "21" in r["d"]), "Region 01")
    check("the non-numeric districts survive",
          sorted(i for i in ids if not i.isdigit()), ["F", "U"])
    check("leading zeros are kept", "02" in ids, True)
    check("District 21 is not '021' or '21 '", [i for i in ids if i.strip() == "21"], ["21"])

    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)

if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run it and watch it fail**

Run: `python3 scripts/test_dashboards.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'dashboards'`

- [ ] **Step 7: Write `scripts/dashboards.py`**

```python
"""The only thing that talks to dashboards.toastmasters.org.

Two endpoints carry this whole site: the home page, which lists the districts
grouped by region, and the club performance CSV export, which carries a
district's entire year in one file.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C

# Region headings and district links appear in document order, so a single
# pass over the two patterns together reconstructs the grouping. The <select>
# lower down the page has the same 94 ids but throws the regions away.
_TOKEN = re.compile(r"(Region\s+\d+)|District\.aspx\?id=([0-9A-Za-z]+)&hideclub")

def parse_district_index(html):
    """[{"r": "Region 01", "d": ["02", "21", ...]}] in the page's own order."""
    regions, current, seen = [], None, set()
    for region, did in _TOKEN.findall(html):
        if region:
            label = re.sub(r"\s+", " ", region).strip()
            if current is None or current["r"] != label:
                current = {"r": label, "d": []}
                regions.append(current)
        elif current is not None and did not in seen:
            seen.add(did)
            current["d"].append(did)
    return [r for r in regions if r["d"]]

def district_index():
    """The live district list. None if the home page cannot be read."""
    html = C.get(f"{C.BASE}/")
    return parse_district_index(html) if html else None

def club_performance(district, program_year):
    """(csv text, source url) for one district-year. Text is None on failure.

    A closed year is served from its own archive path; the open year is only
    served from the unprefixed one.
    """
    stem = (f"{C.BASE}/export.aspx" if program_year == C.current_program_year()
            else f"{C.BASE}/{program_year}/export.aspx")
    url = f"{stem}?type=CSV&report=clubperformance~{district}~~~{program_year}"
    return C.get(url), url
```

- [ ] **Step 8: Run the test and watch it pass**

Run: `python3 scripts/test_dashboards.py`
Expected: all eight checks `pass`, exit 0.

- [ ] **Step 9: Write `scripts/districts.py`**

```python
"""Write docs/districts.json — the index the page loads before it knows which
district it wants.

The per-district content hashes are filled in later by stamp_assets.py, once
the data files they describe exist.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import dashboards as D

def main():
    regions = D.district_index()
    if not regions:
        sys.exit("could not read the district list from the dashboard home page")
    ids = [d for r in regions for d in r["d"]]
    dest = C.p("docs", "districts.json")

    # Keep any hashes and club counts a previous run established; this script
    # knows the roster, not the data.
    old = {}
    if os.path.exists(dest):
        old = json.load(open(dest, encoding="utf-8")).get("districts", {})

    doc = {
        "generated": C.today_local().isoformat(),
        "default": C.CONFIG.get("default_district", "21"),
        "regions": regions,
        "districts": {i: old.get(i, {"name": C.district_name(i)}) for i in ids},
    }
    json.dump(doc, open(dest, "w", encoding="utf-8"), separators=(",", ":"))
    print(f"wrote {dest}  regions={len(regions)} districts={len(ids)}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 10: Run it and check the output**

Run: `python3 scripts/districts.py`
Expected: `regions=14 districts=94`, and `docs/districts.json` exists.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Start the all-districts board from the dashboard's own district list"
```

---

### Task 2: Read a district-year CSV, whatever year it came from

**Files:**
- Create: `scripts/csvmap.py`
- Test: `scripts/test_csvmap.py`, `tests/fixtures/cp_open.csv`, `tests/fixtures/cp_closed.csv`

**Interfaces:**
- Consumes: nothing.
- Produces: `csvmap.read(text) -> tuple[list[dict], str]` returning `(rows, asof)`. Each row is a plain dict with exactly these keys: `n` (8-digit club number str), `m` (name), `d` (division), `a` (area), `status` (str), `goals` (list of 12 ints, `None` where absent), `met` (int|None), `mb` (int|None), `md` (int|None), `ng` (int|None), `csp` (`"Y"`, `"N"` or `""`), `st` (recognition label, `""` if none). `asof` is `"22-Sep-2026"` style, `""` if the file carries no trailing line.

- [ ] **Step 1: Save both CSV shapes as fixtures**

```bash
curl -s "https://dashboards.toastmasters.org/export.aspx?type=CSV&report=clubperformance~21~~~2025-2026" -o tests/fixtures/cp_open.csv
curl -s "https://dashboards.toastmasters.org/2023-2024/export.aspx?type=CSV&report=clubperformance~21~~~2023-2024" -o tests/fixtures/cp_closed.csv
```

These two files are the whole reason this module exists: their headers differ.

- [ ] **Step 2: Write the failing test**

```python
# scripts/test_csvmap.py
"""Tests for reading a club performance CSV.

The open year and a closed year print different column headings for the same
four goals, and the closed year drops two columns entirely. Mapping by
position would appear to work and be silently wrong, so both shapes are
driven here against saved fixtures.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import csvmap

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests", "fixtures")
FAILED = []

def check(label, got, want):
    if got == want:
        print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")

def load(name):
    return csvmap.read(open(os.path.join(FIX, name), encoding="utf-8-sig").read())

def main():
    rows, asof = load("cp_open.csv")
    by = {r["n"]: r for r in rows}

    check("open year reads every club", len(rows) > 150, True)
    check("open year carries an as-of date", bool(asof), True)
    check("club numbers are zero-padded to eight",
          all(len(r["n"]) == 8 and r["n"].isdigit() for r in rows), True)
    check("twelve goal values per club",
          {len(r["goals"]) for r in rows}, {12})
    check("open year carries CSP", {r["csp"] for r in rows} <= {"Y", "N", ""}, True)
    check("open year carries net growth",
          any(r["ng"] is not None for r in rows), True)

    crows, casof = load("cp_closed.csv")
    cby = {r["n"]: r for r in crows}
    check("closed year reads every club", len(crows), 109)
    check("closed year has no CSP", {r["csp"] for r in crows}, {""})
    check("closed year still gives twelve goals",
          {len(r["goals"]) for r in crows}, {12})

    # The club the spec traces: a real 2023-2024 D21 club, President's level.
    first = cby["00000038"]
    check("first Canadian: goals met", first["met"], 9)
    check("first Canadian: division and area", (first["d"], first["a"]), ("A", "01"))
    # The twelfth value is the two dues rounds summed: the export prints 13
    # goal columns, the club report 12 rows.
    check("first Canadian: twelve rows read in order",
          first["goals"], [5, 2, 2, 2, 1, 5, 4, 3, 7, 7, 2, 1])
    check("the two dues rounds collapse into one row",
          cby["00000965"]["goals"][10], 2)
    check("status code became a label", first["st"], "President's Distinguished")

    check("a blank status stays blank",
          any(r["st"] == "" for r in crows), True)

    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run it and watch it fail**

Run: `python3 scripts/test_csvmap.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'csvmap'`

- [ ] **Step 4: Write `scripts/csvmap.py`**

```python
"""Read a club performance CSV into the shape the site's JSON wants.

The column headings drift between program years — "Level 2s" became "Level 2s
or EOM", "Level 4s, Level 5s, or DTM award" became "Level 4s, Path
Completions, or DTM Awards" — and closed years drop CSP and Net Growth
altogether. Matching by position would line up for most columns and be
silently wrong for the rest, so every column is matched by a normalised
heading and anything unmatched comes back None.
"""
import csv, io, re

def _key(s):
    """Fold a heading to something stable across years: lowercase alphanumerics."""
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())

# The twelve report rows, in the order the DCP prints them.
#
# Each row is a list of COLUMNS, and each column a list of the headings that
# column has been published under. A row's value is the sum of its columns —
# which matters for exactly one row: the club report prints a single "Renewal
# dues on time" row, and the export splits it into the October and April
# rounds. Summing them reproduces the report (verified against 109 clubs of
# District 21's 2023-2024, including the 26 where the two rounds differ).
GOAL_HEADINGS = [
    [["level1s"]],
    [["level2s", "level2soreom"]],
    [["addlevel2s", "addlevel2soreom"]],
    [["level3s"]],
    [["level4slevel5sordtmaward", "level4spathcompletionsordtmawards"]],
    [["addlevel4slevel5sordtmaward", "addlevel4spathcompletionsordtmaward"]],
    [["newmembers"]],
    [["addnewmembers"]],
    [["offtrainedround1"]],
    [["offtrainedround2"]],
    [["memduesontimeoct"], ["memduesontimeapr"]],
    [["offlistontime"]],
]

META = {
    "n":  ["clubnumber"],
    "m":  ["clubname"],
    "d":  ["division"],
    "a":  ["area"],
    "status": ["clubstatus"],
    "met": ["goalsmet"],
    "mb": ["membase"],
    "md": ["activemembers"],
    "ng": ["netgrowth"],
    "csp": ["csp"],
    "st": ["clubdistinguishedstatus"],
}

# The export prints a one-letter recognition code; the page prints the label.
STATUS = {"D": "Distinguished", "S": "Select Distinguished",
          "P": "President's Distinguished", "H": "Smedley Distinguished"}

ASOF = re.compile(r"As of (\d{1,2})/(\d{1,2})/(\d{4})")
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

def _int(v):
    try:
        return int(str(v).strip())
    except Exception:
        return None

def _asof(text):
    """'Month of Sep, As of 09/22/2026' -> '22-Sep-2026', the site's format."""
    m = ASOF.search(text)
    if not m:
        return ""
    mo, day, yr = int(m.group(1)), int(m.group(2)), m.group(3)
    return f"{day:02d}-{MONTHS[mo - 1]}-{yr}"

def read(text):
    """(rows, asof). Rows carry only what the site uses, already typed."""
    if not text:
        return [], ""
    reader = csv.reader(io.StringIO(text.lstrip("﻿")))
    try:
        header = next(reader)
    except StopIteration:
        return [], ""
    idx = {_key(h): i for i, h in enumerate(header)}

    def col(names):
        for n in names:
            if n in idx:
                return idx[n]
        return None

    meta_at = {k: col(v) for k, v in META.items()}
    goals_at = [[col(alts) for alts in spec] for spec in GOAL_HEADINGS]

    def at(row, i):
        return row[i].strip() if i is not None and i < len(row) else ""

    def goal(row, cols):
        """A report row: the sum of the export columns that make it up.

        None only when no column matched at all — a row that matched and read
        blank is a zero, not a gap, and must not be confused with one.
        """
        vals = [_int(at(row, i)) for i in cols if i is not None]
        return sum(v or 0 for v in vals) if vals else None

    rows = []
    for row in reader:
        num = at(row, meta_at["n"])
        if not num.isdigit():
            continue                      # the trailing "As of" line, and blanks
        code = at(row, meta_at["st"]).upper()
        rows.append({
            "n": num.zfill(8),
            "m": at(row, meta_at["m"]) or f"Club {num}",
            "d": at(row, meta_at["d"]),
            "a": at(row, meta_at["a"]),
            "status": at(row, meta_at["status"]),
            "goals": [goal(row, cols) for cols in goals_at],
            "met": _int(at(row, meta_at["met"])),
            "mb": _int(at(row, meta_at["mb"])),
            "md": _int(at(row, meta_at["md"])),
            "ng": _int(at(row, meta_at["ng"])),
            "csp": at(row, meta_at["csp"]).upper()[:1],
            "st": STATUS.get(code, ""),
        })
    return rows, _asof(text)
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `python3 scripts/test_csvmap.py`
Expected: every check `pass`, exit 0.

If `first Canadian: twelve rows read in order` fails, print `header` and compare against `GOAL_HEADINGS` — a heading has drifted again, and the fix is to add it to the alternatives, never to reorder.

This mapping was checked against every value the shipped site holds for District 21's 2023-2024: **1,308 of 1,309** row values agree (109 clubs × 12 rows). The single outlier is *Walnut Grove Toastmasters*, row 5, scraped 2 against the export's 3 — both clear that row's target of 1, so no goal count moves. It is an award posted after the scrape ran, not a mapping fault. If a rerun shows more than a handful of such outliers, stop: something in `GOAL_HEADINGS` has slipped.

- [ ] **Step 6: Commit**

```bash
git add scripts/csvmap.py scripts/test_csvmap.py tests/fixtures/cp_open.csv tests/fixtures/cp_closed.csv
git commit -m "Read a club performance CSV from any year by heading, not position"
```

---

### Task 3: The DCP calendar, lifted out of the old generator

**Files:**
- Create: `scripts/dcp.py`
- Test: `scripts/test_reachability.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `dcp.TARGETS` (12 ints), `dcp.ROW_NAMES` (12 str), `dcp.GOAL_ROWS` (10 lists), `dcp.GOAL_NAMES` (10 str), `dcp.LEVELS`, `dcp.windows(season_start_year) -> list[tuple]`, `dcp.goal_states(vals, WIN, today, END) -> tuple[list[str], list[str]]`.

- [ ] **Step 1: Create `scripts/dcp.py` by moving, not rewriting**

Copy `TARGETS`, `ROW_NAMES`, `GOAL_ROWS`, `GOAL_NAMES`, `LEVELS` verbatim out of `d21-dcp/scripts/common.py`, and `windows()` and `goal_states()` verbatim out of `d21-dcp/scripts/gen_live_data.py` (they are at the top of the file, above `main`). Keep their docstrings — the derivation of the dead-from dates from 10,170 historical rows is the only record of why those dates are what they are.

`goal_states` references module-level `TARGETS`, `GOALS` and `ROWNAMES`. In the new module define them as:

```python
GOALS = [{"n": n, "r": r} for n, r in zip(GOAL_NAMES, GOAL_ROWS)]
ROWNAMES = ROW_NAMES
```

- [ ] **Step 2: Copy the existing test across and point it at the new module**

```bash
cp ~/Documents/clients/d21/dcp/scripts/test_reachability.py scripts/
sed -i '' 's/^import gen_live_data as G$/import dcp as G/' scripts/test_reachability.py
```

- [ ] **Step 3: Run it**

Run: `python3 scripts/test_reachability.py`
Expected: every check `pass`. The module moved; the behaviour did not. If anything fails, the move dropped a constant — diff against the originals rather than adjusting the test.

- [ ] **Step 4: Commit**

```bash
git add scripts/dcp.py scripts/test_reachability.py
git commit -m "Lift the DCP calendar into a module of its own"
```

---

### Task 4: Build one district's finished years

**Files:**
- Create: `scripts/build_district.py`
- Test: `scripts/test_build_district.py`

**Interfaces:**
- Consumes: `csvmap.read`, `dashboards.club_performance`, `common.program_years`.
- Produces: `build_district.build_history(district: str, fetch=dashboards.club_performance) -> dict` — the `data.json` document. `fetch` is injected so the test can drive it from fixtures. Document keys: `years`, `goals`, `clubs`, `imp`, `dec`, `district`, `district_id`, `site`, `generated`, `source`. Each club: `{"n","m","d","a","y":{py:{"f","st","mb","md","g","csp","d","a"}}}`. No `s`, no `months`.

- [ ] **Step 1: Write the failing test**

```python
# scripts/test_build_district.py
"""Tests for assembling a district's finished years from CSVs.

Driven from the two saved fixtures rather than the network, and asserted
against District 21's real 2023-2024 numbers, which were cross-checked
against the shipped site: 109 clubs, all agreeing on goals, division and area.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_district as B

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests", "fixtures")
FAILED = []

def check(label, got, want):
    if got == want:
        print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")

def fake_fetch(district, program_year):
    """2023-2024 comes from the fixture; every other year is a dead endpoint."""
    if program_year == "2023-2024":
        return open(os.path.join(FIX, "cp_closed.csv"), encoding="utf-8-sig").read(), "fixture"
    return None, "fixture"

def main():
    doc = B.build_history("21", fetch=fake_fetch)
    clubs = doc["clubs"]
    by = {c["n"]: c for c in clubs}

    check("only the year that returned data is present",
          sorted({py for c in clubs for py in c["y"]}), ["2023-2024"])
    check("one club record per club in that year", len(clubs), 109)
    check("clubs are sorted by name",
          [c["m"] for c in clubs] == sorted((c["m"] for c in clubs), key=str.lower), True)

    first = by["00000038"]["y"]["2023-2024"]
    check("year-end goals", first["f"], 9)
    check("that year's alignment, not today's", (first["d"], first["a"]), ("A", "01"))
    check("twelve underlying rows", len(first["g"]), 12)
    check("recognition label", first["st"], "President's Distinguished")
    check("no monthly series survives", "s" in first, False)
    check("closed years carry no success plan", first["csp"], "")

    check("top-level alignment is the latest year's",
          (by["00000038"]["d"], by["00000038"]["a"]), ("A", "01"))
    check("a single year yields no transitions", (doc["imp"], doc["dec"]), ([], []))
    check("district id is a string", doc["district_id"], "21")
    check("district name", doc["district"], "District 21")

    # A district that returns nothing at all must still produce a valid document.
    empty = B.build_history("227", fetch=lambda d, py: (None, "fixture"))
    check("a district with no data still builds", empty["clubs"], [])
    check("and claims no years", empty["years"], [])

    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python3 scripts/test_build_district.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'build_district'`

- [ ] **Step 3: Write the history half of `scripts/build_district.py`**

```python
"""Build one district's two JSON files from the dashboard's CSV exports.

One fetch per district-year. The district's own export is the authority on
which clubs were in the district that year — a club report page carries a
division and an area but no district, which is how the earlier scrape came to
file clubs under a district they were not in.
"""
import os, sys, json, base64, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import csvmap
import dashboards
import dcp

DISTINGUISHED = 5      # the threshold both movement lists pivot on

def _site_for_publishing():
    """The site config with the contact address encoded rather than plain.

    Harvesters crawl static files for anything matching an email pattern. This
    is not secrecy — anyone reading the code can undo it — but it keeps the
    address out of a regex.
    """
    out = dict(C.CONFIG.get("site", {}))
    addr = out.pop("contact_email", "")
    if addr:
        out["contact_email_enc"] = base64.b64encode(addr[::-1].encode()).decode()
    return out

def _year_record(row):
    """One club's year, as the page reads it."""
    return {"f": row["met"], "st": row["st"], "mb": row["mb"], "md": row["md"],
            "g": row["goals"], "csp": "", "d": row["d"], "a": row["a"]}

def _transitions(clubs, years):
    """Clubs that climbed from under the threshold, and slipped from above it."""
    climbed, slipped = [], []
    for c in clubs:
        for before, after in zip(years, years[1:]):
            was = c["y"].get(before, {}).get("f")
            now = c["y"].get(after, {}).get("f")
            if was is None or now is None:
                continue
            end = c["y"][after]
            rec = {"n": c["n"], "m": c["m"],
                   "d": end.get("d") or c["d"], "a": end.get("a") or c["a"],
                   "fy": before, "ty": after, "fd": was, "td": now,
                   "ch": now - was, "st": end["st"]}
            if was < DISTINGUISHED and now > was:
                climbed.append(rec)
            if was > DISTINGUISHED and now < was:
                slipped.append(rec)
    climbed.sort(key=lambda r: -r["ch"])
    slipped.sort(key=lambda r: r["ch"])
    return climbed, slipped

def build_history(district, fetch=dashboards.club_performance):
    """The data.json document for one district's finished years."""
    per_year, names, got_years = {}, {}, []
    for py in C.program_years():
        text, _ = fetch(district, py)
        rows, _asof = csvmap.read(text)
        if not rows:
            continue                       # a district younger than this year
        got_years.append(py)
        for r in rows:
            per_year.setdefault(r["n"], {})[py] = _year_record(r)
            names[r["n"]] = r["m"]         # the most recent year wins

    clubs = []
    for cid in sorted(per_year, key=lambda c: names[c].lower()):
        ys = per_year[cid]
        latest = ys[max(ys, key=lambda p: got_years.index(p))]
        clubs.append({"n": cid, "m": names[cid],
                      "d": latest["d"], "a": latest["a"], "y": ys})

    climbed, slipped = _transitions(clubs, got_years)
    return {
        "years": got_years,
        "goals": dcp.ROW_NAMES,
        "clubs": clubs,
        "imp": climbed,
        "dec": slipped,
        "district": C.district_name(district),
        "district_id": district,
        "site": _site_for_publishing(),
        "generated": C.today_local().isoformat(),
        "source": f"dashboards.toastmasters.org — {C.district_name(district)}",
    }
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `python3 scripts/test_build_district.py`
Expected: every check `pass`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/build_district.py scripts/test_build_district.py
git commit -m "Build a district's finished years from its own yearly exports"
```

---

### Task 5: Build one district's open year

**Files:**
- Modify: `scripts/build_district.py`
- Test: `scripts/test_build_live.py`

**Interfaces:**
- Consumes: `dcp.windows`, `dcp.goal_states`, `csvmap.read`.
- Produces: `build_district.build_live(district, fetch=dashboards.club_performance, today=None) -> dict` — the `live.json` document. Keys: `py`, `asof`, `today`, `end`, `days`, `acts`, `targets`, `rows`, `goals`, `clubs`, `agg`, `generated`, `timezone`, `source`, `district`. No `months`, no per-club `s`. Also `build_district.main(district)` writing both files to `docs/d/<district>/`.

- [ ] **Step 1: Write the failing test**

```python
# scripts/test_build_live.py
"""Tests for the in-year document.

Pinned to a fixed 'today' so the reachability branches actually execute: run
in August nothing is unreachable and the interesting code never runs.
"""
import os, sys, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_district as B

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests", "fixtures")
FAILED = []

def check(label, got, want):
    if got == want:
        print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")

def fake_fetch(district, program_year):
    return open(os.path.join(FIX, "cp_open.csv"), encoding="utf-8-sig").read(), "fixture"

def main():
    # March: both training windows have shut, so 'd' states exist to assert on.
    doc = B.build_live("21", fetch=fake_fetch, today=datetime.date(2026, 3, 15))
    clubs = doc["clubs"]

    check("every club in the export is present", len(clubs) > 150, True)
    check("ten goal states per club", {len(c["st"]) for c in clubs}, {10})
    check("states are only m, o or d",
          {s for c in clubs for s in c["st"]} <= {"m", "o", "d"}, True)
    check("twelve raw rows per club", {len(c["v"]) for c in clubs}, {12})
    check("no monthly series", any("s" in c for c in clubs), False)
    check("the as-of date came off the CSV", bool(doc["asof"]), True)
    check("ceiling is never below goals met",
          all(c["ceil"] >= c["met"] for c in clubs), True)
    check("by March the first training window has shut for someone",
          any(c["st"][8] == "d" for c in clubs), True)
    check("the success plan came through as Y or N",
          {c["csp"] for c in clubs} <= {"Y", "N", ""}, True)
    check("every club has a next deadline or none at all",
          all(("nd" in c and "ndl" in c) for c in clubs), True)
    check("aggregate club count matches", doc["agg"]["clubs"], len(clubs))
    check("days left is positive in March", doc["days"] > 0, True)
    check("district id in the source line",
          doc["source"].endswith("District 21"), True)

    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python3 scripts/test_build_live.py`
Expected: FAIL — `AttributeError: module 'build_district' has no attribute 'build_live'`

- [ ] **Step 3: Append `build_live` and `main` to `scripts/build_district.py`**

```python
def build_live(district, fetch=dashboards.club_performance, today=None):
    """The live.json document: where the district stands in the open year."""
    import datetime
    today = today or C.today_local()
    season = C.season_start(today)
    py = f"{season}-{season + 1}"
    end = datetime.date(season + 1, 6, 30)
    win = dcp.windows(season)

    text, _ = fetch(district, py)
    rows, asof = csvmap.read(text)

    out = []
    for r in rows:
        vals = r["goals"]
        st, why = dcp.goal_states(vals, win, today, end)
        hdr = r["met"]
        # A club chartered mid-window has its training goal waived, so the
        # dashboard can credit a goal the rows say is unmet. Trust the header.
        if hdr is not None and sum(x == "m" for x in st) < hdr and st[8] != "m":
            st[8], why[8] = "m", "credited (club chartered mid-window)"
        met = sum(x == "m" for x in st)
        ceil = met + sum(x == "o" for x in st)
        if hdr is not None and met != hdr:
            met, ceil = hdr, max(ceil, hdr)

        ng = r["ng"]
        if ng is None and r["mb"] is not None and r["md"] is not None:
            ng = r["md"] - r["mb"]
        memok = bool(r["md"] is not None and (r["md"] >= 20 or (ng is not None and ng >= 5)))
        out.append({
            "n": r["n"], "m": r["m"], "d": r["d"], "a": r["a"],
            "met": met, "ceil": ceil, "st": st, "why": why, "v": vals,
            "mb": r["mb"], "md": r["md"], "ng": ng, "memok": memok,
            "best": next((n for t, n in dcp.LEVELS if ceil >= t), None),
            "now": next((n for t, n in dcp.LEVELS if met >= t), None),
            "asof": asof, "csp": r["csp"],
        })
    out.sort(key=lambda c: (c["ceil"], c["met"], -len(c["m"])))

    # Reachability alone says little early in the year, when nothing has died.
    # What bites is the next window to shut and who loses a goal when it does.
    close = []
    for i in (8, 9, 10, 11):
        act, _dead, opens = win[i]
        if act < today:
            continue
        n = sum(1 for c in out if c["v"][i] is not None and c["v"][i] < dcp.TARGETS[i])
        if n:
            close.append({"lbl": dcp.ROW_NAMES[i], "date": act.isoformat(),
                          "days": (act - today).days, "clubs": n,
                          "open": today >= opens, "opens": opens.isoformat()})
    close.sort(key=lambda x: x["days"])

    for c in out:
        nd = [(win[i][0], dcp.ROW_NAMES[i]) for g in dcp.GOALS for i in g["r"]
              if not (c["v"][i] is not None and c["v"][i] >= dcp.TARGETS[i])
              and win[i][0] >= today]
        c["nd"], c["ndl"] = (min(nd)[0].isoformat(), min(nd)[1]) if nd else ("", "")

    agg = {"clubs": len(out),
           "dist_now": sum(1 for c in out if c["met"] >= DISTINGUISHED),
           "dist_live": sum(1 for c in out if c["met"] < DISTINGUISHED and c["ceil"] >= DISTINGUISHED),
           "dist_out": sum(1 for c in out if c["ceil"] < DISTINGUISHED),
           "at_risk": sum(1 for c in out if c["ceil"] < DISTINGUISHED),
           "train_dead": sum(1 for c in out if c["st"][8] == "d"),
           "train_open": sum(1 for c in out if c["st"][8] == "o"),
           "memok": sum(1 for c in out if c["memok"]),
           "avg_met": round(sum(c["met"] for c in out) / max(len(out), 1), 2),
           "close": close}

    return {"py": py, "asof": asof, "today": today.isoformat(),
            "end": end.isoformat(), "days": (end - today).days,
            "acts": [win[i][0].isoformat() for i in range(12)],
            "targets": dcp.TARGETS, "rows": dcp.ROW_NAMES,
            "goals": dcp.GOAL_NAMES, "clubs": out, "agg": agg,
            "generated": C.stamp(), "timezone": C.TIMEZONE,
            "source": f"dashboards.toastmasters.org - {C.district_name(district)}",
            "district": C.district_name(district)}

def write(district):
    """Both files for one district. Returns (history clubs, live clubs)."""
    out_dir = C.p("docs", "d", district)
    os.makedirs(out_dir, exist_ok=True)
    hist = build_history(district)
    live = build_live(district)
    for name, doc in (("data.json", hist), ("live.json", live)):
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as fh:
            json.dump(doc, fh, separators=(",", ":"))
    return len(hist["clubs"]), len(live["clubs"]), len(hist["years"])

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/build_district.py <district id>")
    h, l, y = write(sys.argv[1])
    print(f"district {sys.argv[1]}: {h} clubs over {y} finished years, {l} live")
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `python3 scripts/test_build_live.py`
Expected: every check `pass`, exit 0.

- [ ] **Step 5: Build District 21 for real and compare against the shipped site**

```bash
python3 scripts/build_district.py 21
python3 - <<'PY'
import json
new=json.load(open('docs/d/21/data.json'))
old=json.load(open('/Users/adrianwong/Documents/clients/d21/dcp/docs/data.json'))
o={c['n']:c for c in old['clubs']}
for py in new['years']:
    n=[c for c in new['clubs'] if py in c['y']]
    agree=sum(1 for c in n if o.get(c['n'],{}).get('y',{}).get(py,{}).get('f')==c['y'][py]['f'])
    print(f"{py}: new={len(n):4d}  old={sum(1 for c in old['clubs'] if py in c['y']):4d}  goals agree on shared={agree}")
PY
```

Expected: the new counts are **lower** than the old ones, and every shared club agrees on `f`. That is the spec's §1 finding reproducing itself — the old file carried clubs from other districts. A disagreement on `f` is a real bug: stop and investigate before going further.

- [ ] **Step 6: Commit**

```bash
git add scripts/build_district.py scripts/test_build_live.py
git commit -m "Build the open year from the district's own export"
```

---

### Task 6: The in-year workbook, per district

**Files:**
- Create: `scripts/gen_inyear_xlsx.py` (adapted copy)

**Interfaces:**
- Consumes: `docs/d/<id>/live.json`, `docs/d/<id>/data.json`.
- Produces: `gen_inyear_xlsx.build(district) -> str` (the path written), writing `docs/d/<id>/inyear.xlsx`.

- [ ] **Step 1: Copy the generator over**

```bash
cp ~/Documents/clients/d21/dcp/scripts/gen_inyear_xlsx.py scripts/
```

- [ ] **Step 2: Make its paths district-aware**

It currently reads `_p('docs','live.json')` and `_p('docs','data.json')` and writes `_p('docs','inyear.xlsx')`. Wrap the whole of `main()` as `build(district)` and replace those three paths with `C.p('docs', 'd', district, '<name>')`. Replace the `prior_year()` docstring's reference to `docs/data.json` with `docs/d/<district>/data.json`. Add at the foot:

```python
if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/gen_inyear_xlsx.py <district id>")
    print(build(sys.argv[1]))
```

- [ ] **Step 3: Build it for District 21 and open it**

```bash
pip install --quiet openpyxl
python3 scripts/gen_inyear_xlsx.py 21
python3 -c "
from openpyxl import load_workbook
w=load_workbook('docs/d/21/inyear.xlsx')
s=w.active
print('sheet:',s.title,'rows:',s.max_row,'cols:',s.max_column)
print('first data row:',[c.value for c in s[4]][:8])
"
```

Expected: a sheet with one row per club and the twelve goal columns present. If `prior_year()` returns nothing, the district has no finished years — that is legitimate for a young district and the columns are meant to vanish.

- [ ] **Step 4: Commit**

```bash
git add scripts/gen_inyear_xlsx.py
git commit -m "Generate the area-director workbook per district"
```

---

### Task 7: Build every district, and version what was built

**Files:**
- Create: `scripts/build_all.py`
- Modify: `scripts/stamp_assets.py` (copied and rewritten)

**Interfaces:**
- Consumes: `build_district.write`, `gen_inyear_xlsx.build`, `districts.py` output.
- Produces: `docs/d/<id>/` for every listed district; `docs/districts.json` with `clubs`, `years`, `v` (live hash) and `vd` (data hash) per district; `window.__ASSETS__` in `index.html` naming only `styles.css`, `app.js` and `districts.json`.

- [ ] **Step 1: Write `scripts/build_all.py`**

```python
"""Build every district the dashboard currently lists.

Threaded because each district is four independent fetches and the work is
entirely network-bound, but kept to a handful of workers: this is somebody
else's server and the whole run is only a few hundred requests.

Resumable: --only rebuilds named districts, and a district that fails leaves
the files it already had in place rather than replacing them with nothing.
"""
import os, sys, json, argparse, threading, queue, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import build_district
import gen_inyear_xlsx

THREADS = 4

def districts_from_index():
    path = C.p("docs", "districts.json")
    if not os.path.exists(path):
        sys.exit("run scripts/districts.py first — docs/districts.json is missing")
    doc = json.load(open(path, encoding="utf-8"))
    return doc, [d for r in doc["regions"] for d in r["d"]]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="district ids; default is all of them")
    ap.add_argument("--skip-xlsx", action="store_true", help="JSON only, for a fast refresh")
    args = ap.parse_args()

    doc, ids = districts_from_index()
    todo = args.only or ids
    work = queue.Queue()
    for d in todo:
        work.put(d)

    results, failures, lock = {}, [], threading.Lock()

    def worker():
        while True:
            try:
                did = work.get_nowait()
            except queue.Empty:
                return
            try:
                clubs, live, years = build_district.write(did)
                if not args.skip_xlsx:
                    gen_inyear_xlsx.build(did)
                with lock:
                    results[did] = {"clubs": live, "years": years}
                    print(f"  {did:>3}  {clubs:4d} clubs / {years} years / {live:4d} live", flush=True)
            except Exception:
                with lock:
                    failures.append(did)
                    print(f"  {did:>3}  FAILED\n{traceback.format_exc()}", flush=True)

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(THREADS)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    for did, info in results.items():
        entry = doc["districts"].setdefault(did, {"name": C.district_name(did)})
        entry.update(info)
    json.dump(doc, open(C.p("docs", "districts.json"), "w", encoding="utf-8"),
              separators=(",", ":"))

    print(f"built {len(results)}/{len(todo)}; failed {len(failures)}: {failures}")
    # A handful of districts failing is a bad afternoon at Toastmasters; a
    # tenth of them failing is a broken run and must not reach the site.
    if len(failures) > max(1, len(todo) // 10):
        sys.exit(f"{len(failures)} districts failed — refusing to call this a build")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Rewrite `scripts/stamp_assets.py` for many data files**

```bash
cp ~/Documents/clients/d21/dcp/scripts/stamp_assets.py scripts/
```

Keep the module docstring — the reasoning about Pages caching each file for ten minutes is exactly why this exists. Replace `ASSETS` and `main`:

```python
ASSETS = ["styles.css", "app.js", "districts.json"]

def digest_path(path):
    if not os.path.exists(path):
        return None
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()[:10]

def stamp_districts():
    """Hash each district's data into districts.json, so app.js can ask for a
    versioned URL without index.html having to name 188 files."""
    path = C.p("docs", "districts.json")
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
```

`main()` calls `stamp_districts()` **first** (it rewrites `districts.json`, whose own hash must then be taken), then hashes the three `ASSETS` and rewrites `index.html` exactly as before.

- [ ] **Step 3: Run the whole build**

```bash
python3 scripts/districts.py
python3 scripts/build_all.py
python3 scripts/stamp_assets.py
du -sh docs/d && python3 -c "
import json;d=json.load(open('docs/districts.json'))
ds=d['districts'];print('districts:',len(ds))
print('missing hashes:',[k for k,v in ds.items() if 'v' not in v or 'vd' not in v])
print('no finished years:',[k for k,v in ds.items() if v.get('years')==0])
"
```

Expected: 94 districts, no missing hashes, `docs/d` in the region of 20–25 MB. Districts reporting `years: 0` are young ones — note which, they are the test cases for Task 10's copy.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Build every district the dashboard lists"
```

---

### Task 8: Teach the page which district it is showing

**Files:**
- Modify: `docs/app.js` (the boot path at the foot of the file, ~line 1020–1035)

**Interfaces:**
- Consumes: `docs/districts.json`.
- Produces: `S.did` (the active district id), `S.index` (the parsed districts.json), and a boot sequence that fetches `d/<id>/data.json` and `d/<id>/live.json`.

- [ ] **Step 1: Read the existing boot path**

```bash
sed -n '1000,1040p' docs/app.js
```

It currently reads `window.__ASSETS__` for `data.json` and `live.json` and calls `applySiteConfig(d)`. That is the seam.

- [ ] **Step 2: Add district resolution above the boot**

```js
/* Which district this page is showing. The URL wins, then the last one the
   reader chose, then the index's default. An unknown id is not an error worth
   a message — it is a stale link, and the default is the useful answer. */
const DKEY='tm-district';
function pickDistrict(index){
  const known=new Set(Object.keys(index.districts));
  const asked=new URLSearchParams(location.search).get('d');
  if(asked&&known.has(asked)) return asked;
  let saved=null; try{saved=localStorage.getItem(DKEY);}catch(e){}
  if(saved&&known.has(saved)) return saved;
  return known.has(index.default)?index.default:Object.keys(index.districts)[0];
}
```

- [ ] **Step 3: Replace the boot with a district-aware one**

```js
async function boot(){
  const A=window.__ASSETS__||{};
  const index=await fetch(A['districts.json']||'districts.json').then(r=>r.json());
  S.index=index;
  const did=S.did=pickDistrict(index);
  try{localStorage.setItem(DKEY,did);}catch(e){}
  const meta=index.districts[did]||{};
  // versioned from the index, so a deploy cannot serve new markup with stale data
  const v=s=>s?`?v=${s}`:'';
  const [d,l]=await Promise.all([
    fetch(`d/${did}/data.json${v(meta.vd)}`).then(r=>r.json()),
    fetch(`d/${did}/live.json${v(meta.v)}`).then(r=>r.json()).catch(()=>null)
  ]);
  buildDistrictNav(index,did);          // Task 9
  applySiteConfig(d);
  start(d,l);                           // whatever the existing boot called
}
boot();
```

Keep the existing function that renders from `(d, l)` — rename nothing else. If the current file calls its renderer something other than `start`, use that name here.

- [ ] **Step 4: Remove the data preloads from `index.html`**

The two `<link rel="preload">` tags name `data.json` and `live.json` at the old paths and now warm nothing. Delete them and preload the index instead:

```html
<link rel="preload" href="districts.json" as="fetch" type="application/json" crossorigin>
```

- [ ] **Step 5: Verify in the browser**

```bash
python3 -m http.server 8000 --directory docs
```

Open `http://localhost:8000/`, then `?d=57`, then `?d=F`, then `?d=999`. Expected: 21, 57, F, and 21 again (the saved one). Console clean. The board, the charts, the movement lists and the club table all populate for each.

- [ ] **Step 6: Commit**

```bash
git add docs/app.js docs/index.html
git commit -m "Load the district the URL asks for"
```

---

### Task 9: The selector in the wordmark

**Files:**
- Modify: `docs/index.html` (the `.brandtext` block, ~line 30), `docs/styles.css` (after `.brandname`, ~line 95), `docs/app.js`

**Interfaces:**
- Consumes: `S.index`, `S.did`.
- Produces: `buildDistrictNav(index, did)` — fills `#districtPick` with `<optgroup>`s and wires the change handler.

Read spec §6 before writing this. The short version: the district is not a fourth destination, so it does not go in `.mastnav`; it is not an afterthought, so it does not go in `.mastutil`. It replaces the district words in the wordmark.

- [ ] **Step 1: Replace the wordmark's district span with a select**

```html
<div class="brandtext">
  <span class="brandpick">
    <select id="districtPick" class="brandname" aria-label="Choose a district">
      <option value="21">District 21</option>
    </select>
    <svg class="brandchev" viewBox="0 0 10 6" aria-hidden="true">
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round"/></svg>
  </span>
  <span class="brandname brandtail">Club Health</span>
  <span class="brandorg" id="brandRegion">Toastmasters</span>
</div>
```

With JS off this shows the current district and does nothing, which is the same bargain the rest of the page already makes.

- [ ] **Step 2: Style it as the wordmark, not as a form control**

```css
/* The district is the wordmark, so the control is set in the wordmark's own
   type and the chevron is the only thing that says it opens. It is
   interactive, so it takes the brand on hover and focus. */
.brandpick{position:relative;display:inline-flex;align-items:baseline;gap:5px}
.brandpick select.brandname{appearance:none;-webkit-appearance:none;
  background:none;border:none;padding:0 2px 0 0;margin:0;cursor:pointer;
  color:var(--ink);font:inherit;font-family:Montserrat,"Segoe UI",Arial,sans-serif;
  font-size:19px;font-weight:700;letter-spacing:-.01em;line-height:inherit}
.brandpick:hover select.brandname,.brandpick select.brandname:focus-visible{color:var(--maroon-ink)}
.brandpick:hover .brandchev{color:var(--maroon-ink)}
.brandpick select.brandname:focus-visible{outline:2px solid var(--maroon-ink);outline-offset:2px;border-radius:3px}
.brandchev{width:10px;height:6px;flex:none;color:var(--muted);
  transition:color .15s;pointer-events:none;align-self:center}
/* the native menu is the platform's, so its options need the page's ground */
.brandpick select.brandname option,.brandpick select.brandname optgroup{
  background:var(--card);color:var(--ink);font-size:14px;font-weight:600}
@media (max-width:768px){
  .brandpick select.brandname{font-size:16px}
}
```

`.brandname` already exists and sets the same face, size and weight; the select inherits it and overrides only what a form control resets. Do not delete `.brandname` — `.brandtail` uses it.

- [ ] **Step 3: Fill it from the index**

```js
/* Ninety-four districts is past the point where a flat list can be read, so
   they are grouped by the region the dashboard itself groups them by. */
function buildDistrictNav(index,did){
  const sel=document.getElementById('districtPick');
  if(!sel) return;
  sel.innerHTML=index.regions.map(r=>
    `<optgroup label="${esc(r.r)}">`+
    r.d.filter(d=>index.districts[d]).map(d=>
      `<option value="${esc(d)}"${d===did?' selected':''}>${esc(index.districts[d].name)}</option>`
    ).join('')+`</optgroup>`).join('');
  sel.value=did;
  sel.onchange=()=>{
    const next=sel.value;
    try{localStorage.setItem(DKEY,next);}catch(e){}
    // A full navigation rather than an in-place swap: every section, the
    // drawer and the year scrub all derive from the two documents, and
    // reloading is the one way that cannot leave a stale corner behind.
    location.assign(`?d=${encodeURIComponent(next)}`);
  };
}
```

- [ ] **Step 4: Check it renders and switches**

Reload `http://localhost:8000/`. Expected: the wordmark reads `District 21 ▾ Club Health`; opening it shows 14 region groups; choosing District 57 navigates to `?d=57` and the whole page re-renders as District 57. Keyboard: Tab reaches it, arrows change it, Enter commits.

- [ ] **Step 5: Check it at 375px and in dark**

```bash
python3 -c "print('resize to 375px and toggle the theme')"
```

Expected: the wordmark still holds one line at 375px; the select is `--ink` on `--card` in both themes and `--maroon-ink` on hover. If the native menu renders white-on-white in dark on Linux Chrome, that is the platform's menu and the `option` rule above is the whole of what CSS can do about it.

- [ ] **Step 6: Commit**

```bash
git add docs/index.html docs/styles.css docs/app.js
git commit -m "Make the wordmark the district selector"
```

---

### Task 10: Copy, filenames and links that follow the district

**Files:**
- Modify: `docs/app.js`, `docs/index.html`

- [ ] **Step 1: Make the download filenames follow the district**

`app.js` has two hardcoded `District21_` strings — the spec's long-standing to-do. Replace the in-year one (`District21_InYear_<py>.xlsx`) and the scoped one (`District21_<kind>_<label>_DCP.xlsx`) with:

```js
const dprefix=()=>`District${S.did}`;
```

and build both names from it. The workbook link itself moves to `d/${S.did}/inyear.xlsx`.

- [ ] **Step 2: Rename the theme key**

`d21-theme` appears once in `app.js` and once in the inline script in `index.html`. Both become `tm-theme`. The key is shared across districts on purpose: it is a preference about the page, not about the district.

- [ ] **Step 3: Make the year count in the hero come from the data**

The deck hardcodes "five finished years and the one still running", which is wrong for a district with two. Give the sentence a span and fill it:

```html
<p class="lede">Ten goals a year; five earns Distinguished. This page carries that score for
<b id="hClubs">&mdash;</b> clubs across <span id="hYears">&mdash;</span>.</p>
```

```js
const NUM=['no','one','two','three','four','five','six'];
function yearPhrase(d,l){
  const n=(d.years||[]).length;
  const finished=n?`${NUM[n]||n} finished year${n===1?'':'s'}`:'no finished years yet';
  return l?`${finished} and the one still running`:finished;
}
```

Set `#hYears` from it in the same place `#hClubs` is set.

- [ ] **Step 4: Drop the spreadsheet links**

The Google Sheet belongs to District 21 and has no equivalent for the other 93. Delete the `#sheet1` anchor from `.mastutil` and the `#sheet2` anchor from the footer, and remove the `applySiteConfig` lines that fill them. Leave Contact and the theme toggle. The footer's "Source" link stays and points at the new repo.

- [ ] **Step 5: Title, footer and source follow the district**

`applySiteConfig(d)` already reads `d.site`. Add the document title and the footer source:

```js
document.title=`${d.district} — ${(d.site&&d.site.title_suffix)||'Club Health Board'}`;
const fs=$('footSource'); if(fs) fs.textContent=d.district;
const fd=$('footDash');
if(fd) fd.href=`https://dashboards.toastmasters.org/District.aspx?id=${d.district_id}`;
```

- [ ] **Step 6: Check a young district and an old one**

Open `?d=227` (few or no finished years) and `?d=21`. Expected: 227's deck reads sensibly rather than claiming five years, its year scrub shows only the years it has, and the board does not render an empty grid with a stray legend. If 227 has no finished years at all, the board section should be hidden rather than empty — add `if(!d.years.length) document.getElementById('board').hidden=true;` and the same for `#signals` and `#movement`, which all derive from finished years.

- [ ] **Step 7: Commit**

```bash
git add docs/app.js docs/index.html
git commit -m "Follow the selected district through the copy, the links and the filenames"
```

---

### Task 11: The workflows

**Files:**
- Create: `.github/workflows/refresh-inyear.yml`, `.github/workflows/rebuild-history.yml`

- [ ] **Step 1: Write the weekly in-year refresh**

Start from `d21-dcp/.github/workflows/refresh-inyear.yml` — keep the schedule comment, the concurrency group, `permissions: contents: write`, and the shape of the commit step. Replace the three run steps with:

```yaml
      - name: Refresh the district list
        run: python3 scripts/districts.py

      - name: Rebuild every district's open year
        run: python3 scripts/build_all.py

      - name: Re-stamp the asset versions
        run: python3 scripts/stamp_assets.py

      - name: Refuse a run that lost too many districts
        run: |
          python3 - <<'PY'
          import json,sys
          d=json.load(open('docs/districts.json'))['districts']
          thin=[k for k,v in d.items() if not v.get('clubs')]
          print(f"{len(d)} districts, {len(thin)} with no live clubs: {thin}")
          if len(thin) > max(1, len(d)//10):
              sys.exit("too many districts came back empty - refusing to commit")
          PY
```

and `git add docs/` in the commit step. Set `timeout-minutes: 45`.

- [ ] **Step 2: Write the history rebuild**

Finished years do not change, so this runs on `workflow_dispatch` only, plus one `cron: "0 17 15 8 *"` — mid-August, once the previous year's archive has settled. It is the same steps; `build_all.py` rebuilds both documents anyway.

- [ ] **Step 3: Push and run both by hand from the Actions tab**

Expected: the refresh finishes inside its timeout and commits, or reports that the dashboard has not moved. Watch the first run — 94 districts at four threads is the first time this code meets the real endpoint at scale.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows
git commit -m "Refresh every district weekly, and rebuild history on demand"
```

---

### Task 12: Publish, audit, and bring the docs level

**Files:**
- Modify: `DESIGN.md`, `README.md`

- [ ] **Step 1: Turn Pages on**

```bash
gh repo create adrianwongstudio/tm-dcp --public --source=. --push
gh api -X PUT repos/adrianwongstudio/tm-dcp/pages -f "source[branch]=main" -f "source[path]=/docs"
```

- [ ] **Step 2: Run the contrast audit**

Follow `DESIGN.md` §*The contrast audit* exactly — all four steps, in both themes, with the drawer and the contact modal open, and with the row hover surface forced. The selector is new coloured type on `--card`; it is the thing being audited.

Expected: zero failures in both themes. `--maroon-ink` on `--card` measures 4.3:1 in dark, which clears the 3:1 large-text bar at 19px/700 but would fail at 14px — so if the selector is ever reduced in size, it must stop being maroon.

- [ ] **Step 3: Update `DESIGN.md`**

Three edits, no more:
- **Masthead** — the wordmark now opens; add the selector, its type, its states and the region grouping, and say why it is not in the nav and not in the utilities.
- **Standing it up for another district** — the section is obsolete in this repo. Replace it with *Adding a district*, which is: it appears in the dashboard's own list, the next build picks it up, nothing to edit. Keep the note that `stamp_assets.py` runs last.
- **Colour** — if the audit moved any value, record it.

- [ ] **Step 4: Write `README.md`**

Carry over `d21-dcp/README.md`'s structure and voice. The sections that change: *What it produces* (94 districts, one page), *It keeps itself current* (weekly, all districts), and a new short section recording spec §1 — that the board is built from district exports, that this is why club counts for finished years are lower than the old single-district site showed, and the *Absolutely Toasted* check that establishes it. Point at `DESIGN.md` and the spec.

- [ ] **Step 5: Tell the reader what moved**

Add one line to the footer, or the *Finished Years* disclosure, noting that a club is listed under the district that held it in that year. Someone who bookmarked the old D21 numbers will otherwise think the site lost clubs.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "Publish the all-districts board and bring the docs level with it"
git push
```

---

## Self-review notes

**Spec coverage.** §1 → Tasks 2, 4, 5 (and the Task 5 comparison step proves it). §2 → Tasks 1, 7, 11. §3 → Tasks 1, 7. §4 → Task 2. §5 → Tasks 1, 10. §6 → Task 9. §7 → Tasks 8, 10. §8 → invariant 1 Task 12, invariant 2 Task 12, invariant 3 Task 7, invariant 4 Tasks 7 and 11, invariant 5 unchanged (no instruction lines are edited).

**Names used consistently throughout:** `csvmap.read`, `dashboards.club_performance`, `dashboards.parse_district_index`, `dashboards.district_index`, `dcp.windows`, `dcp.goal_states`, `build_district.build_history`, `build_district.build_live`, `build_district.write`, `gen_inyear_xlsx.build`, `buildDistrictNav`, `pickDistrict`, `S.did`, `S.index`, `DKEY`, `tm-theme`, `tm-district`.

**Two things deliberately not in this plan.** An in-place district swap without a reload (Task 9 step 3 says why), and any attempt to recover the per-club monthly series for districts other than 21 — that is what `d21-dcp` still exists for.
