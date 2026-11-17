"""Past club-seasons with their in-year snapshots -> data/seasons.json.

The dashboard serves only year-end values for finished years, so in-year
history comes from two places:

  * District 21's monthly archive (the sibling d21-dcp repo), given as an
    argument: every month end of 2021-22 onward.
  * This repo's own weekly archive, data/snapshots/, for every district, once
    the year it belongs to has finished and its year end is in data.json.

Each season keeps a list of snapshots [[day of program year, *FIELDS], ...],
the last one the year end, plus the published goals and the Club Success Plan
flag. Also writes the share of each year-end count that is already in by each
month, used to synthesize seasons for clubs with only year-end history.

    uv run scripts/build_seasons.py ../d21-dcp/output/monthly_data.csv   # rebuild D21, then add the archive
    uv run scripts/build_seasons.py                                      # keep what is there, add the archive
"""
import csv, datetime, gzip, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import forecast as F

OUT = C.p("data", "seasons.json")
MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"]
THIN = 21             # days between the archive snapshots kept for one season


def _i(v):
    return int(v) if str(v).strip().lstrip("-").isdigit() else 0


def month_values(r):
    """FIELDS from one row of the monthly archive."""
    g = lambda k: _i(r[k])
    return [g("Level 1 awards"),
            g("Level 2 awards") + g("More Level 2 awards"),
            g("Level 3 awards"),
            g("Level 4, Path Completion, or DTM award") + g("One more Level 4, Path Completion, or DTM award"),
            g("New members") + g("More new members"),
            g("Membership To Date"), g("Membership Base"),
            g("Club officer roles trained June-August"),
            g("Club officer roles trained November-February"),
            g("Membership-renewal dues on time"), g("Club officer list on time")]


def report_values(v, members, base):
    """FIELDS from the twelve report rows of live.json / data.json."""
    return [v[0], v[1] + v[2], v[3], v[4] + v[5], v[6] + v[7], members, base, v[8], v[9], v[10], v[11]]


def from_monthly(path):
    """District 21's month-by-month rows (CSV, or the same rows as JSON)."""
    with open(path, encoding="utf-8") as fh:
        rows = json.load(fh) if path.endswith(".json") else list(csv.DictReader(fh))
    by = {}
    for r in rows:
        by.setdefault((str(r["Club No"]).zfill(8), r["Program Year"]), {})[r["Month"][:3]] = r
    out = []
    for (n, py), m in sorted(by.items()):
        if "Jun" not in m:
            continue
        snaps = [[d] + month_values(m[k]) for k, d in zip(MONTHS, F.MONTH_DAYS) if k in m]
        if not snaps:
            continue
        csp = m["Jun"].get("Club Success Plan") or ""
        out.append({"n": n, "py": py, "s": snaps + [[F.YEAR_END] + month_values(m["Jun"])],
                    "g": _i(m["Jun"]["DCP Goals Met"]),
                    "csp": None if not csp else csp == "Requirement Met"})
    return out


def from_archive(have):
    """Seasons of finished years from data/snapshots, skipping any in `have`."""
    root, out = C.p("data", "snapshots"), []
    if not os.path.isdir(root):
        return out
    for py in sorted(os.listdir(root)):
        start = datetime.date(int(py[:4]), 7, 1)
        for did in sorted(os.listdir(os.path.join(root, py))):
            data = C.p("docs", "d", did, "data.json")
            if not os.path.exists(data):
                continue
            ends = {c["n"]: c["y"].get(py) for c in json.load(open(data, encoding="utf-8"))["clubs"]}
            snaps = {}
            for name in sorted(os.listdir(os.path.join(root, py, did))):
                day = (datetime.date.fromisoformat(name[:10]) - start).days + 1
                with gzip.open(os.path.join(root, py, did, name), "rt", encoding="utf-8") as fh:
                    for n, v, mb, md, *_ in json.load(fh):
                        s = snaps.setdefault(n, [])
                        if day < F.YEAR_END - THIN and (not s or day - s[-1][0] >= THIN):
                            s.append([day] + report_values(v, md or 0, mb or 0))
            for n, s in snaps.items():
                y = ends.get(n)
                if (n, py) in have or not y or y.get("f") is None or y.get("md") is None \
                        or any(x is None for x in y["g"]):
                    continue
                csp = y.get("csp") or ""
                out.append({"n": n, "py": py, "g": y["f"], "csp": None if not csp else csp == "Y",
                            "s": s + [[F.YEAR_END] + report_values(y["g"], y["md"], y["mb"] or 0)]})
    return out


def curve(seasons):
    """Share of each year-end count already in by each month's report."""
    out = {"days": F.MONTH_DAYS}
    for k in F.COUNTS:
        out[k] = []
        for day in F.MONTH_DAYS:
            num = den = 0.0
            for s in seasons:
                snap = F.snapshot_at(s["s"], day)
                if snap is not None:
                    num += snap[k]; den += F.state(s["s"][-1][1:])[k]
            out[k].append(round(num / den, 3) if den else 0.0)
    return out


def main(monthly=None):
    if monthly:
        seasons = from_monthly(monthly)
    else:
        seasons = json.load(open(OUT, encoding="utf-8"))["seasons"]
    added = from_archive({(s["n"], s["py"]) for s in seasons})
    seasons = sorted(seasons + added, key=lambda s: (s["py"], s["n"]))
    doc = {"v": 2, "curve": curve(seasons), "seasons": seasons}
    json.dump(doc, open(OUT, "w", encoding="utf-8"), separators=(",", ":"))
    print(f"{len(seasons)} club-seasons ({len(added)} from the weekly archive) -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
