# Club map: a list beside it, and two filters — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put an alphabetical list of the clubs currently in the map view beside
the map, and add filters for membership restriction and online attendance.

**Architecture:** `docs/js/map.js` owns the whole section. `mapVisible()` is
already the one place that decides which clubs the section shows; both filters
go there, so the pins, the count and the new list cannot disagree. The list is
a second child of `.mapwrap` beside `.mapcanvas`, redrawn on Leaflet's
`moveend` — which fires once at the end of a pan or zoom, not per frame.

**Tech Stack:** Vanilla ES modules, Leaflet 1.9 + markercluster (vendored),
Python 3 for the monthly data pass, Playwright for browser tests.

**Spec:** `plans/2026-11-21-map-list-and-filters-spec.md`

## Global Constraints

- Filter labels, fixed by the spec: **Open to anyone**, **Restricted**,
  **Meets online**. Never "Company clubs".
- Every English string a reader can see goes through `T()` or `data-i18n`.
- `geo.json` writes optional fields only when true, never as `""` or `false`
  (`scripts/clublocs.py` house rule, stated in that file).
- No new network request, and no new dependency.
- The map section stands down silently when there is nothing to draw.

## Review Focus

1. A `geo.json` written before this change carries no restriction field at
   all: **Restricted** must show an empty list, **Open to anyone** must show
   every club, and neither may throw. Covered in Task 3.
2. Filters plus division plus search can narrow to zero clubs: the list needs
   an empty-state line and a zero count, with no stale rows left behind.
   Covered in Task 4.
3. A club inside a collapsed cluster is still within the view and must appear
   in the list; a club panned off the edge must leave it. Covered in Task 4.
4. Leaflet failing to load calls `standDownMap(why)`, which must hide the list
   and the new filter chips too, not just the canvas. Covered in Task 4.
5. Switching district reloads `geo.json` into a live map: the list must
   rebuild against the new district rather than keep the old one's rows.
   Covered in Task 4.

---

### Task 1: Let the translator see the split modules

`i18n_extract.py` still reads only `docs/app.js`, but the board's JS now lives
in `docs/js/*.js`. Strings moved there have silently dropped out of
`_source.json` — "Also meets online" and "No score this year" among them — and
anything this plan adds to `map.js` would drop out the same way. This task is
first because Tasks 3 and 4 add user-facing strings to `map.js`.

**Files:**
- Modify: `scripts/i18n_extract.py:107-109`
- Test: `scripts/test_i18n_extract.py` (create)

**Interfaces:**
- Produces: `js_sources() -> list[str]`, absolute paths to `docs/app.js` plus
  every `docs/js/*.js`, sorted.

- [ ] **Step 1: Write the failing test**

```python
def test_js_sources_includes_split_modules():
    names = [os.path.basename(p) for p in I.js_sources()]
    check("app.js is still read", "app.js" in names, True)
    check("the split modules are read too", "map.js" in names, True)

def test_map_strings_are_extracted():
    keys = I.from_js(C.p("docs", "js", "map.js"))
    check("a T() string in map.js is found", "Also meets online" in keys, True)
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python3 scripts/test_i18n_extract.py`
Expected: FAIL — `js_sources` is not defined.

- [ ] **Step 3: Add `js_sources()` and fold it into `main()`**

`main()` currently calls `from_js(C.p("docs", "app.js"))` once; it should
concatenate `from_js` over every path `js_sources()` returns, preserving the
existing order of markup keys first. Keep the module docstring honest: it
names `docs/app.js` as the source and must now name `docs/js/` too.

- [ ] **Step 4: Run the test, then regenerate**

Run: `python3 scripts/test_i18n_extract.py` → PASS
Run: `uv run scripts/i18n_extract.py` — expect it to report the strings it has
just recovered. Commit the regenerated `docs/i18n/_source.json`.

- [ ] **Step 5: Commit**

```bash
git add scripts/i18n_extract.py scripts/test_i18n_extract.py docs/i18n/_source.json
git commit -m "Read the split modules when collecting the board's English"
```

---

### Task 2: Carry the membership restriction into geo.json

**Files:**
- Modify: `scripts/clublocs.py:116-176` (`read_club`)
- Test: `scripts/test_clublocs.py`

**Interfaces:**
- Produces: `read_club(club)` adds `record["r"] = 1` when the API's
  `Restriction` is a non-empty value, and omits the key otherwise. Read as a
  flag, like the neighbouring `"v": 1`.

- [ ] **Step 1: Write the failing test**

Use the shape the live API actually returns — `[[]]` on a restricted club,
absent or `[]` on an open one:

```python
def test_restriction_is_flagged():
    club = dict(BASE, Restriction=[[]])
    check("a restricted club is flagged", read_club(club).get("r"), 1)

def test_open_club_carries_no_flag():
    check("an empty list is not a restriction", read_club(dict(BASE, Restriction=[])).get("r"), None)
    check("a missing field is not a restriction", read_club(dict(BASE)).get("r"), None)
```

- [ ] **Step 2: Run it and watch it fail**

Run: `python3 scripts/test_clublocs.py`
Expected: FAIL — `r` is None on the restricted club.

- [ ] **Step 3: Set the flag in `read_club`**

Beside the existing `AllowsVirtualAttendance` block, with a comment saying
what the flag does and does not mean: Toastmasters publishes one sentence for
professional *and/or educational* prerequisites, so this marks a club that
restricts membership, not a company club.

- [ ] **Step 4: Run the tests**

Run: `python3 scripts/test_clublocs.py && python3 scripts/test_build_geo.py`
Expected: PASS. `build_geo` needs no change — it compares whole records.

- [ ] **Step 5: Refresh District 21 so the page has something to filter**

Run: `uv run scripts/build_geo.py --district 21`
Expect roughly 36 of 174 D21 clubs to gain `"r": 1`.

- [ ] **Step 6: Commit**

```bash
git add scripts/clublocs.py scripts/test_clublocs.py docs/d/21/geo.json
git commit -m "Record whether a club restricts its membership"
```

---

### Task 3: The two filters

**Files:**
- Modify: `docs/js/core.js:2` (state), `docs/js/map.js:72-97`
  (`mapVisible`, `buildMapFilters`), `docs/index.html` (the `.mapbar` block),
  `docs/styles.css:856-867`
- Test: `tests/browser_test.py` (`test_map_filters`, new)

**Interfaces:**
- Consumes: `record["r"]` from Task 2.
- Produces: `S.mapRestrict` (`''` any, `'open'`, `'restricted'`) and
  `S.mapOnline` (`false` | `true`), both honoured inside `mapVisible()`.

- [ ] **Step 1: Write the failing test**

```python
def test_map_filters(browser, base):
    page = open_page(browser, f"{base}/?d=21", [])
    page.wait_for_selector(".leaflet-marker-icon")
    all_pins = page.locator(".leaflet-marker-icon").count()
    page.locator("#mpRestrict button", has_text="Restricted").click()
    check("restricting narrows the map", page.locator(".leaflet-marker-icon").count() < all_pins, True)
    check("the chip reports itself pressed",
          page.locator("#mpRestrict button[aria-pressed=true]").inner_text(), "Restricted")
    page.locator("#mpRestrict button", has_text="Open to anyone").click()
    check("open and restricted do not overlap",
          page.locator("#mpRestrict button[aria-pressed=true]").count(), 1)
    page.locator("#mpOnline button").click()
    check("online stacks with membership rather than replacing it",
          page.locator("#mpRestrict button[aria-pressed=true]").count(), 1)
    page.close()
```

And for Review Focus 1, a district whose `geo.json` predates Task 2 and so
carries no `r` on any club — District 61 is refreshed on the same monthly pass
and will not have been rebuilt here:

```python
def test_map_filters_without_restriction_data(browser, base):
    page = open_page(browser, f"{base}/?d=61", [])
    page.wait_for_selector(".leaflet-marker-icon")
    page.locator("#mpRestrict button", has_text="Restricted").click()
    check("no restriction data means no restricted clubs",
          page.locator(".leaflet-marker-icon").count(), 0)
    page.locator("#mpRestrict button", has_text="Open to anyone").click()
    check("and every club counts as open",
          page.locator(".leaflet-marker-icon").count() > 0, True)
    check("nothing threw", problems, [])
    page.close()
```

- [ ] **Step 2: Run it and watch it fail**

Run: `uv run tests/browser_test.py`
Expected: FAIL — `#mpRestrict` does not exist.

- [ ] **Step 3: Add the state**

`docs/js/core.js:2`: add `mapRestrict:''` and `mapOnline:false` to `S`.

- [ ] **Step 4: Add the markup**

A second `.mapfilters` row inside `.mapbar`, following the existing
`#mpDiv` pattern exactly (`role="group"`, `aria-label`, `data-i18n-label`):
`#mpRestrict` holding **Any membership** / **Open to anyone** / **Restricted**,
and `#mpOnline` holding a single **Meets online** toggle. Give `.mapbar` a
`flex-wrap` row break so the two rows stack rather than crowding the search
box; the chips themselves need no new CSS, since `.mapfilters button` already
styles them.

- [ ] **Step 5: Honour them in `mapVisible()`**

Three lines beside the existing division and query tests: a club fails
`'restricted'` unless `c.r`, fails `'open'` if `c.r`, and fails the online
toggle unless `c.v`. Wire both groups in `buildMapFilters()` the way `#mpDiv`
is wired — set `aria-pressed` across the group, then `drawMapPins(true)`.

- [ ] **Step 6: Run the tests**

Run: `uv run tests/browser_test.py` → PASS
Run: `uv run scripts/i18n_extract.py` and commit the new keys.

- [ ] **Step 7: Commit**

```bash
git add docs/js/core.js docs/js/map.js docs/index.html docs/styles.css docs/i18n/_source.json tests/browser_test.py
git commit -m "Filter the map by membership and by online attendance"
```

---

### Task 4: The list beside the map

**Files:**
- Modify: `docs/js/map.js` (`drawMapPins`, `drawMap`, `standDownMap`),
  `docs/index.html` (the `.mapwrap` block), `docs/styles.css:874-876`
- Test: `tests/browser_test.py` (`test_map_list`, new)

**Interfaces:**
- Consumes: `mapVisible()` from Task 3.
- Produces: `drawMapList()` — reads `mapVisible()`, keeps those whose
  `[c.lat, c.lng]` falls inside `S.map.getBounds()`, sorts by `c.m` with
  `localeCompare(…, LOC())`, and writes `#mpList`. Called from `drawMapPins()`
  and from `S.map.on('moveend')`.

- [ ] **Step 1: Write the failing test**

```python
def test_map_list(browser, base):
    page = open_page(browser, f"{base}/?d=21", [])
    page.wait_for_selector("#mpList .maprow")
    names = page.locator("#mpList .maprow .maprow-name").all_inner_texts()
    check("the list is alphabetical", names, sorted(names, key=str.casefold))
    check("the count matches the rows",
          page.locator("#mpListCount").inner_text(), f"{len(names)} clubs in view")
    before = len(names)
    for _ in range(4):
        page.locator(".leaflet-control-zoom-in").click()
    page.wait_for_function(f"document.querySelectorAll('#mpList .maprow').length !== {before}")
    check("zooming in drops the clubs that left the view",
          page.locator("#mpList .maprow").count() < before, True)
    page.locator("#mpList .maprow").first.click()
    page.wait_for_selector("#detail.open")
    check("a row opens that club's drawer",
          len(page.locator("#dname").inner_text()) > 0, True)
    page.close()
```

Drive the map through its own zoom control rather than a Leaflet handle on
`window`: `S` is module-scoped and nothing exposes it, and the control is what
a reader actually uses.

For Review Focus 3, in the same test, before zooming — a club inside a
collapsed cluster is still in view and must be listed:

```python
    check("clustered clubs are still listed",
          page.locator("#mpList .maprow").count()
          > page.locator(".leaflet-marker-icon:not(.marker-cluster)").count(), True)
```

For Review Focus 2, 4 and 5, a second test: narrow the filters until nothing
matches and assert `#mpList` shows the empty line and `#mpListCount` reads
zero; load `?d=99` (no `geo.json`, so the section stands down) and assert
`#mpList` is hidden rather than holding District 21's rows; then load `?d=61`
and assert the names differ from District 21's.

- [ ] **Step 2: Run it and watch it fail**

Run: `uv run tests/browser_test.py`
Expected: FAIL — `#mpList` does not exist.

- [ ] **Step 3: Add the markup**

Inside `.mapwrap`, after `#mpCanvas`: an `<aside id="mpList">` with a count
header (`#mpListCount`) and a scrolling `<ul>`. Each row is a `<button
class="maprow" data-club="…">` carrying `.maprow-name`, the division and area
line, and the same `.mappin` score dot the pin uses.

- [ ] **Step 4: Lay it out**

`.mapwrap` becomes `display:flex`. `.mapcanvas` takes `flex:1.9 1 0`,
`#mpList` takes `flex:1 1 0` with `min-width:0`, its own scroll, and a
`border-inline-start` in `var(--line)`. Under `900px`, a media query turns the
flex direction to `column` so the list stacks beneath the map. `.mapcanvas`
keeps its `clamp()` height; give `#mpList` the same height at desktop width so
the box stays square-edged.

- [ ] **Step 5: Implement `drawMapList()`**

Call it at the end of `drawMapPins()` and bind `S.map.on('moveend', drawMapList)`
where the other map handlers are bound in `drawMap()`. Rows delegate one click
handler on `#mpList` to `openLiveDetail(btn.dataset.club)`, the way
`popupopen` already does. Empty state: one line, `T('No clubs in view.')`.
`standDownMap()` hides `#mpList` alongside `#mpCanvas`.

- [ ] **Step 6: Run the tests**

Run: `uv run tests/browser_test.py` → PASS
Run: `uv run scripts/i18n_extract.py` and commit the new keys.

- [ ] **Step 7: Update the section's own "How to read this" copy**

The block in `index.html` explains pins, clusters and the division filter. Add
one sentence for the list and one for the two filters, in the voice already
there, and say plainly that the restriction flag covers professional *or*
educational prerequisites so a reader is not told an advanced club is a
company club.

- [ ] **Step 8: Commit**

```bash
git add docs/js/map.js docs/index.html docs/styles.css docs/i18n/_source.json tests/browser_test.py
git commit -m "List the clubs the map is showing, beside the map"
```

---

### Task 5: Restamp and verify the whole section

**Files:**
- Modify: `docs/index.html` (asset hashes, via the script)

- [ ] **Step 1: Restamp**

Run: `python3 scripts/stamp_assets.py`. `app.js`, `styles.css` and every
module in `docs/js/` are content-hashed; without this a browser holds new
markup beside an old module for ten minutes after deploy.

- [ ] **Step 2: Run everything**

```bash
for t in scripts/test_*.py; do python3 "$t" || echo "FAIL $t"; done
uv run tests/browser_test.py
```

- [ ] **Step 3: Look at it**

Serve `docs/` and check at desktop width and at 375px: the list beside the map
and then stacked under it, in both light and dark mode, with the filters
stacking against division and search.

- [ ] **Step 4: Commit**

```bash
git add docs/index.html
git commit -m "Restamp the assets for the map list and its filters"
```
