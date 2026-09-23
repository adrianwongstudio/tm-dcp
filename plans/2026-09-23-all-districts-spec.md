# All-districts Club Health board — spec

**Status:** ready to build · **Date:** 2026-09-23 · **Supersedes:** nothing

The board at `adrianwongstudio.github.io/d21-dcp/` reports one district. This
spec takes the same design to **all 94 districts Toastmasters currently lists**,
with a district selector in the masthead, and nothing else about the page
changing. [DESIGN.md](../DESIGN.md) remains the design reference and is
unchanged by this work except where section *6. The district selector* says so.

---

## 1. The finding that shapes everything

The current site is built by scraping **one club-report page per club per month
per year** — 13,560 fetches for District 21. Two facts make that unnecessary,
and one makes it wrong.

**The monthly data is never read.** `data.json` carries a 12-value monthly
series per club-year (`s`), and `live.json` carries an in-year series. Neither
appears anywhere in `app.js` — the five-year "trace" is built from the five
year-end scores (`app.js:187`, `app.js:339`). The monthly scrape feeds only the
Excel workbooks and `analyze.py`.

**One CSV per district-year carries everything the site does use.**

```
https://dashboards.toastmasters.org/{py}/export.aspx?type=CSV&report=clubperformance~{district}~~~{py}
https://dashboards.toastmasters.org/export.aspx?type=CSV&report=clubperformance~{district}~~~{py}   ← open year
```

Columns: District, Division, Area, Club Number, Club Name, Club Status, CSP
(open year only), Mem. Base, Active Members, Net Growth (open year only), Goals
Met, all **twelve** DCP row counts, Club Distinguished Status. The file ends
with a `Month of Sep, As of 09/22/2026` line, which is the `asof` the page
shows. That is every field in both JSON files except the unused series.

Verified against the shipped site: for District 21, 2023-2024, the CSV's
`Goals Met` matched the scraped `f` for **109 of 109** shared clubs, and
division and area agreed **109 of 109**.

**The scrape over-includes, and the CSV is the correction.** `clubs.tsv` is a
union of every club the district has held across all five years, and the scrape
pulls every one of them for every year. The club-report page carries division
and area but **no district field**, so nothing ever checked whether a club was
actually in the district in the year being recorded. For 2023-2024 that put
**82 clubs into District 21's board that were in other districts that year**.

The check that settles it: *Absolutely Toasted* (01134527) is a D21 club today,
and its archived 2023-2024 report says Division B, Area 21. In D21's 2023-2024
alignment, Division B held areas 10–13 — area 21 was Division C. The club was
somewhere else that year. The district CSV, which is the district's own roster
for that year, excludes it correctly.

> **Consequence to expect, and to tell people about.** Rebuilding District 21
> from CSVs will show **fewer clubs per finished year** than the site shows
> today (109 rather than 196 for 2023-2024), and division averages, the tallies
> and the climbed/slipped lists will all move. This is a bug fix, not a
> regression, but it is a visible change to numbers someone may have quoted.

**Cost, after the change.** A full historical build is `94 districts × 6 years =
564` fetches. The weekly in-year refresh is **94 fetches**. Today's single
district costs 13,560 and 678 respectively.

---

## 2. Decisions taken

| | Decision |
|---|---|
| **Repo** | A new repo, **`tm-dcp`**, Pages served from `/docs` on `main`. Published at `adrianwongstudio.github.io/tm-dcp/`. The name appears once, in the README and the footer "Source" link. |
| **`d21-dcp`** | Left running exactly as it is. It keeps the monthly cache, `analyze.py` and the month-by-month workbooks, which the new repo does not reproduce. Nothing in this plan edits it. |
| **Districts** | All 94 in the dashboard's own district `<select>`, including the two non-numeric ones, **F** and **U**. |
| **History** | Same window as today: program years from **2021-2022**, five finished years plus the open one. Districts younger than that get fewer years (D227 has no 2021-2022 clubs) and the page must say so from the data. |
| **Scraping** | CSV only. No club-report pages, no `data/cache`, no `clubs.tsv`. |
| **District switch** | Full navigation to `?d=<id>`. One line, always correct; an in-place swap is a later refinement, not this plan. |

---

## 3. Published layout

```
docs/
  index.html          one page, all districts
  app.js  styles.css  carried over from d21-dcp, then modified
  districts.json      the selector index + per-district cache-busting hashes
  d/<id>/data.json    finished years        (~170 KB worst case)
  d/<id>/live.json    the open year         (~82 KB worst case)
  d/<id>/inyear.xlsx  the area-director workbook
```

94 districts is roughly **23 MB in the repo**, of which a visitor downloads one
district — about **250 KB**. Well inside the 1 GB repo and 100 MB file limits.

`districts.json` is the only index the page loads before it knows which district
it wants:

```json
{"generated":"2026-09-23",
 "default":"21",
 "regions":[{"r":"Region 01","d":["02","21","49","101","205","206","207"]}, ...],
 "districts":{"21":{"name":"District 21","clubs":184,"years":5,"v":"9f3c76d112"}, ...}}
```

`v` is the content hash of that district's `live.json`, so `app.js` can request
`d/21/live.json?v=9f3c76d112` and a deploy stays atomic from the browser's side
without `index.html` naming 188 files. `data.json` carries its own `vd` hash for
the same reason.

**Repo churn.** Every weekly run rewrites up to 94 `live.json` files, roughly
8 MB of new blobs a week. Git delta-compresses these well, but if the repo
passes ~1 GB, re-cut the data history (orphan branch or a squash) rather than
adding a second storage system.

---

## 4. Field mapping

Both CSV shapes map onto the existing JSON. **Column names drift between
years** and must be matched by normalised header, never by position:

| Canonical | Open year (2025-2026) | Closed year (2023-2024) |
|---|---|---|
| goal 2 | `Level 2s or EOM` | `Level 2s` |
| goal 3 | `Add. Level 2s or EOM` | `Add. Level 2s` |
| goal 5 | `Level 4s, Path Completions, or DTM Awards` | `Level 4s, Level 5s, or DTM award` |
| goal 6 | `Add. Level 4s, Path Completions, or DTM award` | `Add. Level 4s, Level 5s, or DTM award` |
| CSP | `CSP` (`Y`/`N`) | **absent** |
| net growth | `Net Growth` | **absent** |

**The export prints thirteen goal columns, the club report twelve rows.** The
report's single `Renewal dues on time` row is published as two — `Mem. dues on
time Oct` and `Mem. dues on time Apr` — and the row's value is their **sum**.
Checked against every value the shipped site holds for District 21's 2023-2024:
1,308 of 1,309 row values agree, including all 26 clubs where the two rounds
differ. Reading the export's columns positionally would put the April round
where the officer list belongs and shift nothing else, which is precisely the
kind of error that looks like working code.

Three behaviours follow:

- **CSP is an open-year field only.** That is already how the page uses it —
  the plan flag and the No Success Plan filter live in the current-year table
  alone. `data.json`'s `csp` becomes permanently `""` and nothing reads it.
  `cspRank()` in `app.js` currently tests `/Met/i` against a sentence from the
  club page; against CSV it must test `Y`/`N`.
- **`Club Distinguished Status` is a code** in the CSV (`P`, `S`, `D`, `H`,
  empty) where the site wants a label. Map: `D`→`Distinguished`,
  `S`→`Select Distinguished`, `P`→`President's Distinguished`,
  `H`→`Smedley Distinguished`, empty→`""`.

Everything the in-year view computes — reachability, ceiling, next deadline,
the closing-window counts — is derived from the twelve row values and the
calendar in `gen_live_data.py`. It needs no extra source and carries over
unchanged.

---

## 5. What is dropped

- `scrape.py`, `scrape_live.py`, `parse.py`, `build.py`, `analyze.py`,
  `close_year.py`, `data/cache`, `data/live`, `probes/`, `scripts/clubs.tsv`
- the monthly series `s` and the `months` key in both JSON files
- **the district spreadsheet link.** `config.json`'s `spreadsheet_url` is one
  Google Sheet belonging to District 21. There is no equivalent for the other
  93, so the masthead "Download" link and the footer "Spreadsheet" link go, and
  the in-year workbook button — which is per-district and generated — stays.
- `config.json` as a district carrier. It keeps only what is district-neutral:
  history window, timezone, contact settings, output prefixes.

---

## 6. The district selector

**It is not a fourth destination.** The three masthead links answer *what do you
need*; the district answers *whose board is this*, which scopes all three. Sat
next to them at 15px it would read as a peer, and at 13px in the utility cluster
beside Download and Contact it would read as an afterthought. It is neither.

**The wordmark becomes the selector.** The masthead already prints the district
once, as `District 21 Club Health`. That word becomes a native `<select>` set in
the wordmark's own type — Montserrat 19px/700 `--ink` — with a chevron after it,
taking `--maroon-ink` on hover and focus because it is interactive (rule 2). The
district is still said exactly once (rule 1), and the control sits where a
reader already looks to find out whose page they are on.

- A native `<select>` for the keyboard, for screen readers, and so it degrades:
  with JS off it holds one option, the current district, and does nothing.
- **`<optgroup>` per region**, 14 of them, in the dashboard's own order. A flat
  94-item list is unreadable; region is the grouping Toastmasters itself uses.
- Options are labelled `District 21`. The dashboard publishes no district names.
- Changing it navigates to `?d=<id>`.
- `--maroon-ink` on `--card` measures 4.3:1 in dark, so at 19px/700 it clears
  the 3:1 large-text bar — this is the one place the maroon may be type at
  weight on a raised surface. Re-run the audit in section 8 after building it.
- At 375px the wordmark must still hold one line; it drops to 16px below 768px
  today and the select follows it.

The `<title>`, the hero deck's club count, the footer source line and both
workbook filenames all follow the selected district.

---

## 7. URL and default

- `?d=21` selects a district. Unknown, malformed or absent → the default.
- The default is the last district chosen, from `localStorage` key `tm-district`,
  else `districts.json`'s `default` (`21`).
- The theme key moves from `d21-theme` to **`tm-theme`**, and is shared across
  districts deliberately: it is a preference about the page, not the district.
- A district in the archive but no longer listed (e.g. 106) is reachable by URL
  if its files were built, but is not offered in the selector.

---

## 8. Invariants that must survive

These are the existing rules this work must not break. They are the acceptance
bar, not aspirations.

1. **Contrast.** Both themes report zero failures under the audit in
   [DESIGN.md](../DESIGN.md) §*The contrast audit*, including the row hover
   surface and with the drawer and contact modal open.
2. **The stylesheet is the design.** Any value this work changes is changed in
   `DESIGN.md` in the same commit.
3. **Asset versioning is last.** `stamp_assets.py` runs after anything that
   rewrites `docs/`.
4. **A refresh that returns nothing does not commit.** Today's workflow refuses
   under 50 clubs; the multi-district equivalent refuses if more than 10% of
   districts failed to fetch.
5. **One instruction line per section, ≤20 words, one line.**
