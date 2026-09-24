"""Write docs/districts.json — the index the page loads before it knows which
district it wants.

The list is the **union of every program year in the window**, not today's
list alone. The 2026-2027 realignment dissolved 68 of 162 districts into the
new 200-series; their five finished years are still in the dashboard's archive
and are still the record of those clubs, so they stay on the board. A district
that no longer exists is marked, never hidden.

The per-district content hashes are filled in later by stamp_assets.py, once
the data files they describe exist.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import dashboards as D


def year_index(program_year):
    """The districts one program year listed, grouped by region. None if the
    page cannot be read — which must not be mistaken for a year with none."""
    stem = (f"{C.BASE}/" if program_year == C.current_program_year()
            else f"{C.BASE}/{program_year}/")
    html = C.get(stem)
    return D.parse_district_index(html) if html else None


def main():
    years = C.program_years() + [C.current_program_year()]
    per, failed = {}, []
    for py in years:
        regs = year_index(py)
        if regs is None:
            failed.append(py)
            print(f"  {py}: could not be read")
            continue
        per[py] = regs
        print(f"  {py}: {len(regs)} regions, {sum(len(r['d']) for r in regs)} districts")

    open_year = C.current_program_year()
    if open_year not in per:
        sys.exit("could not read the current district list — refusing to write an index")
    # More than one archive year missing means the archive, not a district,
    # is what changed. An index built from that would retire live districts.
    if len(failed) > 1:
        sys.exit(f"{len(failed)} archive years unreadable ({failed}) — refusing to rewrite the index")

    current = [d for r in per[open_year] for d in r["d"]]
    cur = set(current)

    # Where a retired district last sat, so the page can say when it ended.
    last = {}
    for py in years:
        for r in per.get(py, []):
            for d in r["d"]:
                last[d] = {"py": py, "r": r["r"]}

    retired = sorted((d for d in last if d not in cur),
                     key=lambda d: (len(d), d))

    dest = C.p("docs", "districts.json")
    old = {}
    if os.path.exists(dest):
        old = json.load(open(dest, encoding="utf-8")).get("districts", {})

    districts = {}
    for d in current + retired:
        e = dict(old.get(d, {}))
        e["name"] = C.district_name(d)
        if d in cur:
            e.pop("last", None)
            e.pop("gone", None)
        else:
            e["gone"] = True
            e["last"] = last[d]["py"]
            e["region"] = last[d]["r"]
        districts[d] = e

    doc = {
        "generated": C.today_local().isoformat(),
        "default": C.CONFIG.get("default_district", "21"),
        "regions": per[open_year],
        "retired": retired,
        "districts": districts,
    }
    json.dump(doc, open(dest, "w", encoding="utf-8"), separators=(",", ":"))
    print(f"wrote {dest}  listed={len(current)} retired={len(retired)} total={len(districts)}")


if __name__ == "__main__":
    main()
