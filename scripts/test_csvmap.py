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

    # Recognition codes, including the one 2025-2026 introduced. Driven from a
    # synthetic file rather than a third fixture: the point is the code column,
    # and every other column is already exercised above.
    head = ("District,Division,Area,Club Number,Club Name,Club Status,Mem. Base,"
            "Active Members,Goals Met,Level 1s,Level 2s,Add. Level 2s,Level 3s,"
            "Level 4s. Level 5s. or DTM award,Add. Level 4s. Level 5s. or DTM award,"
            "New Members,Add. New Members,Off. Trained Round 1,Off. Trained Round 2,"
            "Mem. dues on time Oct,Mem. dues on time Apr,Off. List On Time,"
            "Club Distinguished Status")
    body = "\n".join(
        f"21,A,01,0000000{i},Club {i},Active,20,20,10,4,2,2,2,1,1,4,4,4,4,1,1,1,{code}"
        for i, code in enumerate(["D", "S", "P", "M", "H", "", "Z"], start=1))
    rows2, _ = csvmap.read(head + "\n" + body + "\n")
    labels = [r["st"] for r in rows2]
    check("the four recognition codes map to their labels", labels[:4],
          ["Distinguished", "Select Distinguished", "President's Distinguished",
           "Smedley Distinguished"])
    check("M is Smedley, the code 2025-2026 introduced", labels[3], "Smedley Distinguished")
    check("an empty code stays an empty label", labels[5], "")
    check("an unknown code is recorded, not silently dropped",
          "Z" in csvmap.UNKNOWN_STATUS, True)
    check("and a known code is not recorded as unknown",
          csvmap.UNKNOWN_STATUS & {"D", "S", "P", "M", "H"}, set())

    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
