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

    # A district dissolved in a realignment: finished years, no open year. Its
    # live.json must not exist at all, so the page can tell "no longer a
    # district" from "the in-year fetch failed".
    dead = B.build_live("121", fetch=lambda d, py: (None, "fixture"),
                        today=datetime.date(2026, 3, 15))
    check("a dissolved district yields no live clubs", dead["clubs"], [])
    check("and an aggregate that says so", dead["agg"]["clubs"], 0)
    check("and still names itself", dead["district"], "District 121")

    # write() must leave no live.json behind for such a district — a stale one
    # from a previous build would make a dissolved district look current.
    import tempfile, os as _os
    root = tempfile.mkdtemp()
    out = _os.path.join(root, "docs", "d", "121")
    _os.makedirs(out)
    stale = _os.path.join(out, "live.json")
    open(stale, "w").write("{}")
    saved = (B.C.p, B.build_history, B.build_live)
    B.C.p = lambda *parts: _os.path.join(root, *parts)
    B.build_history = lambda d, fetch=None: {"clubs": [], "years": []}
    B.build_live = lambda d, fetch=None, today=None: {"clubs": []}
    try:
        B.write("121")
        check("a stale live.json is removed, not left behind", _os.path.exists(stale), False)
        check("data.json is still written",
              _os.path.exists(_os.path.join(out, "data.json")), True)
    finally:
        B.C.p, B.build_history, B.build_live = saved

    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
