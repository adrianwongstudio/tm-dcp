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
