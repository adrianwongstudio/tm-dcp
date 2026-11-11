"""One-off: turn District 21's monthly archive into data/seasons.json.

The dashboard serves only year-end values for finished years, so the one real
November-to-June history we have is the sibling d21-dcp repo. Each club-season
keeps the metrics the forecast needs at the Nov 10 snapshot (the "Oct" row) and
at year end (the "Jun" row). Also writes the share of each year-end count that
is already in by November, used to synthesize snapshots for other districts.

    uv run scripts/build_seasons.py ../dcp/data/rows.json
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C

METRICS = ["l1", "l2", "l3", "l4", "new"]


def _i(v):
    return int(v) if str(v).strip().lstrip("-").isdigit() else 0


def metrics(r):
    """Cumulative counts and flags from one monthly row."""
    g = lambda k: _i(r[k])
    return {
        "l1": g("Level 1 awards"),
        "l2": g("Level 2 awards") + g("More Level 2 awards"),
        "l3": g("Level 3 awards"),
        "l4": g("Level 4, Path Completion, or DTM award")
              + g("One more Level 4, Path Completion, or DTM award"),
        "new": g("New members") + g("More new members"),
        "members": _i(r["Membership To Date"]),
        "base": _i(r["Membership Base"]),
        "t1": g("Club officer roles trained June-August"),
        "t2": g("Club officer roles trained November-February"),
        "dues": g("Membership-renewal dues on time"),
    }


def curve(seasons):
    """Share of each year-end count already in by November, over all seasons."""
    out = {}
    for k in METRICS:
        end = sum(s["end"][k] for s in seasons)
        out[k] = round(sum(s["snap"][k] for s in seasons) / end, 3) if end else 0.0
    return out


def main(path):
    rows = json.load(open(path, encoding="utf-8"))
    by = {}
    for r in rows:
        by.setdefault((r["Club No"], r["Program Year"]), {})[r["Month"][:3]] = r
    seasons = []
    for (n, py), m in sorted(by.items()):
        if "Oct" in m and "Jun" in m:
            seasons.append({"n": n, "py": py, "snap": metrics(m["Oct"]),
                            "end": metrics(m["Jun"])})
    doc = {"curve": curve(seasons), "seasons": seasons}
    out = C.p("data", "seasons.json")
    json.dump(doc, open(out, "w", encoding="utf-8"), separators=(",", ":"))
    print(f"{len(seasons)} club-seasons, curve {doc['curve']} -> {out}")


if __name__ == "__main__":
    main(sys.argv[1])
