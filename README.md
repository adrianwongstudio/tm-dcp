# Toastmasters — Club Health Board

Five years of Distinguished Club Program results, plus the year still running,
for every club in **all 162 districts Toastmasters has listed across that
window** — the 94 that exist today and the 68 dissolved in the 2026-27
realignment — chosen from the wordmark, one district at a time.

Published at **https://adrianwongstudio.github.io/tm-dcp/**

## What it produces

One page. `?d=<id>` selects a district; the selector in the wordmark navigates
there, and the last district chosen is remembered.

    docs/
      index.html  app.js  styles.css   the page, one copy for every district
      districts.json                   the region-grouped index, plus each
                                       district's content hashes
      d/<id>/data.json                 finished years
      d/<id>/live.json                 the open year
      d/<id>/inyear.xlsx               the area-director workbook

162 districts is about 29 MB in the repo, of which a visitor downloads one —
roughly 250 KB.

## Built from the district's own export

The whole site comes from **one CSV per district-year**:

    https://dashboards.toastmasters.org/{py}/export.aspx?type=CSV&report=clubperformance~{district}~~~{py}
    https://dashboards.toastmasters.org/export.aspx?type=CSV&report=clubperformance~{district}~~~{py}   ← open year

A full historical build is `162 × 6 = 972` fetches and finishes in well under a
minute. The single-district site this grew out of scraped one club-report page
per club per month per year — 13,560 fetches for one district.

### Why the finished-year club counts moved

The old site built its club list from a union of every club the district had
held across five years, and pulled every one of them for every year. A club
report page carries a division and an area but **no district**, so nothing ever
checked whether a club was actually in the district in the year recorded. For
District 21's 2023-2024 that filed **82 clubs that were in other districts that
year**.

The check that settles it: *Absolutely Toasted* (01134527) is a D21 club today,
and its archived 2023-2024 report says Division B, Area 21. In D21's 2023-2024
alignment, Division B held areas 10–13 — area 21 was Division C. The club was
somewhere else that year. The district CSV, which is the district's own roster
for that year, excludes it correctly.

So this board shows **fewer clubs per finished year** than the old one did —
109 rather than 196 for D21's 2023-2024 — and the division averages, the
tallies and the climbed/slipped lists all move with them. Every club the two
share agrees on goals met and on division and area. A club is listed under the
district that held it **in that year**, and the footer says so.

### 162 districts, of which 94 still exist

The 2026-2027 realignment was a large one. Toastmasters listed 125–132
districts in each of the five finished years and lists **94** today: 68 were
dissolved into a new 200-series, and 30 of the current 94 are brand new.

So the district list is the **union of all six years**, not today's list. A
dissolved district keeps its five finished years — they are the record of what
those clubs did, and dissolving a district does not undo it. They appear in the
selector under *No longer a district*, labelled with the last year they were
listed, and their pages hide the year in progress and say why.

Districts 201–231, conversely, have an open year and no archive at all. Their
pages hide the four retrospective sections and say why.

## Layout

    config.json  history window, timezone, site wording — nothing district-specific
    scripts/
      common.py           paths, config, program-year maths, dashboard access
      dashboards.py       the only thing that talks to dashboards.toastmasters.org
      districts.py        the dashboard's district list -> docs/districts.json
      csvmap.py           a club performance CSV -> typed rows, matched by heading
      dcp.py              the DCP itself: twelve rows, ten goals, the calendar
      build_district.py   one district -> data.json + live.json
      gen_inyear_xlsx.py  one district's live.json -> inyear.xlsx
      build_all.py        every district, four threads
      crosslink.py        writes each club's other districts onto its records
      stamp_assets.py     content hashes onto the URLs index.html loads
      test_*.py           plain scripts; run them directly, no pytest
    tests/fixtures/       a saved home page and both CSV shapes
    docs/                 the published site

## It keeps itself current

**Refresh in-year data** runs every Sunday at 09:00 Pacific: it re-reads the
district list, rebuilds all 94 districts and commits `docs/`. It refuses to
commit if more than a tenth of districts come back with no clubs.

**Rebuild history** runs on demand, plus once a year on 15 August, when the
year just closed has settled in the dashboard's archive.

Both can be run by hand from the repo's Actions tab.

## Running it locally

Scripts resolve paths from this folder, so the working directory is free.

    python3 scripts/districts.py          # the district list
    python3 scripts/build_all.py          # all 162, about a minute
    python3 scripts/build_all.py --only 21 57   # or just these
    python3 scripts/crosslink.py          # after a full build, before stamping
    python3 scripts/stamp_assets.py       # always last

    python3 scripts/test_dashboards.py    # the tests, each on its own
    python3 scripts/test_csvmap.py
    python3 scripts/test_reachability.py
    python3 scripts/test_build_district.py
    python3 scripts/test_build_live.py

`stamp_assets.py` puts a content hash on each asset `index.html` loads, and
each district's data hash into `districts.json`. Pages caches every file for
ten minutes independently, so without it a browser can hold new markup beside a
stale `app.js` — which looks exactly like a feature that shipped broken. Run it
after anything that rewrites `docs/`.

## What the site shows

The masthead carries three destinations named for the task — **This year**,
**Past years**, **Find a club** — with Contact and the theme toggle demoted to
a utility cluster behind a rule. The district sits in the wordmark, because it
scopes all three rather than being a fourth.

Every section opens with one imperative line, at most twenty words, set to hold
a single line. The caveats, definitions and provenance notes sit behind a **How
to read this section** disclosure: a native `<details>`, so it works without JS.

**The Year in Progress** — goals achieved so far, days to 30 June, and which
goals are still mathematically reachable. A goal is unreachable once its window
has shut; the two officer-training windows and the two administrative deadlines
all close mid-year, so a club's ceiling can fall below Distinguished long
before June. The Club Success Plan rides on the club line as a `No Club Success
Plan` flag, with a filter for the clubs missing one — it is a prerequisite for
every recognition level.

**The Finished Years** — every club at the close of a chosen year, grouped by
the division and area that supported it *in that year*, ranked worst-last
within each area.

**Where the Goals Are Going Missing** — goal completion district-wide, the
five-year trajectory, and division standings against the prior year.

**Who Climbed, and Who Slipped** — clubs that were under five goals and
improved, and clubs that were above five and fell back.

**Every Club, Year by Year** — searchable, with five-year sparklines.

## A club that changed district

A club number survives a realignment; a district does not. **6,823 of 20,868
clubs** changed district for 2026-27, so a club's five finished years can sit
under one district and its year in progress under another — Mecon
Communication Club (00009639) has 2021-22 to 2025-26 in District 121 and
2026-27 in District 227.

`crosslink.py` surveys every district's files after a build and writes onto
each moved club the other districts holding it, and which years each one has.
The club drawer's year picker then shows those years as chips too, dashed and
marked with the district — `25–26 · D121 ↗` — and choosing one opens
`?d=121&c=00009639`: that district, that club, drawer already open. It works in
both directions, so a dissolved district's clubs lead to where they are now and
a new district's clubs lead back to their history.

`?c=<club number>` is a deep link on its own. Closing the drawer drops it.

## Downloads

Every download is a real workbook. `docs/d/<id>/inyear.xlsx` is one row per club
with the twelve goal counts, membership, next deadline and Club Success Plan,
for an area director to open alongside a club officer. Each division header and
area card carries its own scoped download, and a club's panel exports just that
club. Filenames carry the district, so two districts' workbooks do not collide
in one downloads folder.

## Contact

A **Contact** button in the masthead opens a form — name, email, subject,
message and a spam check. The subject is sent prefixed with `site.contact_tag`
("DCP-Dashboard") to `site.contact_email`.

The site is static and cannot send mail itself, so delivery follows
`site.contact_endpoint`:

- **blank** (as now) — the message is handed to the sender's own mail client,
  pre-addressed with the tagged subject. No account or key needed.
- **set** — the form POSTs `{name, email, subject, message}` to that URL and
  the sender never leaves the page.

The address is never published as text: the build encodes it into `data.json`
and the form decodes it only when a message is sent, so nothing in `docs/`
matches an email pattern. That is obfuscation, not secrecy. The POST body
carries **no recipient** — a client-supplied `to` would let anyone who found
the endpoint relay mail through it.

## Notes

- Column headings drift between program years: "Level 2s" became "Level 2s or
  EOM", "Level 4s, Level 5s, or DTM award" became "Level 4s, Path Completions,
  or DTM Awards", and closed years drop CSP and Net Growth entirely. Every
  column is matched by **normalised heading, never by position**.
- The export prints thirteen goal columns where the club report prints twelve
  rows: the report's single "Renewal dues on time" row is published as the
  October and April rounds, and the row's value is their sum. Reading
  positionally would put the April round where the officer list belongs.
- `Club Distinguished Status` is a one-letter code in the CSV (`P`, `S`, `D`,
  `H`) where the page wants a label.
- The open year is **not** on the year-prefixed URL. It comes from the
  unprefixed `export.aspx`.
- The DCP report prints 12 goal rows but awards 10 goals: the two
  officer-training rows earn one between them, as do the two administrative
  rows.
- Divisions and areas are redrawn every July, so alignment is stored per year.
- District ids are **strings**. `F` and `U` are districts; `02` is not `2`.
- The monthly per-club series the old site collected is not reproduced here.
  Nothing on the page ever read it — the five-year trace is built from the five
  year-end scores. The single-district repo still holds it.

**[DESIGN.md](DESIGN.md) is the full design reference** — every token in both
themes, the type scale, the metrics, each region's construction, the contrast
audit, and what adding a district costs. Read it before altering the layout,
and keep it level with the stylesheet. The spec this was built from is
[`plans/2026-09-23-all-districts-spec.md`](plans/2026-09-23-all-districts-spec.md).
