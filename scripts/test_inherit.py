"""Tests for carrying a new district's record in from the districts it came from.

Built on hand-made archives rather than the real files. Every rule this pass
has — which district wins a year two of them hold, whose division a carried
year is filed under, which clubs are dropped — is clearest when each number in
the fixture was picked to prove exactly one of them.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import inherit as I

FAILED = []


def check(label, got, want):
    if got == want:
        print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")


def yr(f, d, a, st=""):
    """A year record shaped the way build_district writes one."""
    return {"f": f, "st": st, "mb": 20, "md": 18, "g": list(range(12)),
            "csp": "", "d": d, "a": a}


# Alpha spent 2023-2025 in District 121 and 2022-2023 in District 92, and 92
# also carries a 2024-2025 row for it — the overlap the precedence rule settles.
ARCHIVES = {
    "121": {"A1": {"y": {"2024-2025": yr(7, "A", "01"),
                         "2023-2024": yr(3, "A", "01")}}},
    "92":  {"A1": {"y": {"2024-2025": yr(99, "C", "09"),
                         "2022-2023": yr(8, "C", "09")}},
            "B2": {"y": {"2024-2025": yr(8, "B", "02", "Select Distinguished"),
                         "2023-2024": yr(2, "B", "02")}}},
}

ROSTER = [
    {"n": "A1", "m": "Alpha", "d": "G", "a": "04",
     "o": [["121", ["2024-2025", "2023-2024"]], ["92", ["2022-2023"]]]},
    {"n": "B2", "m": "Bravo", "d": "G", "a": "04",
     "o": [["92", ["2024-2025", "2023-2024"]]]},
    {"n": "C3", "m": "Charlie", "d": "H", "a": "01"},
    {"n": "D4", "m": "Delta", "d": "H", "a": "02",
     "o": [["121", ["2024-2025"]]]},
]


def main():
    doc = I.build("299", ROSTER, ARCHIVES.get)
    by = {c["n"]: c for c in doc["clubs"]}

    check("the union of every year carried, oldest first", doc["years"],
          ["2022-2023", "2023-2024", "2024-2025"])

    # `o` is newest-district-first, so the district that held the club most
    # recently owns a year both of them claim.
    check("the most recent district wins a year two of them hold",
          by["A1"]["y"]["2024-2025"]["f"], 7)
    check("and the older district still supplies the years only it has",
          by["A1"]["y"]["2022-2023"]["f"], 8)

    check("a carried year is filed under the club's division and area today",
          [(v["d"], v["a"]) for v in by["A1"]["y"].values()],
          [("G", "04")] * 3)
    check("and so is the club itself", (by["A1"]["d"], by["A1"]["a"]), ("G", "04"))

    check("a club with no record anywhere is left out", "C3" in by, False)
    check("so is one whose old district has no row for it", "D4" in by, False)
    check("clubs are sorted by name",
          [c["m"] for c in doc["clubs"]], ["Alpha", "Bravo"])

    check("the club's other districts ride along for the drawer",
          by["A1"]["o"], ROSTER[0]["o"])

    # Bravo 2 -> 8 and Alpha 3 -> 7 both climb from under Distinguished;
    # Alpha 8 -> 3 slips from above it. Movement is recomputed on the carried
    # years, not inherited from any one source district.
    check("climbers, biggest gain first",
          [(r["n"], r["ch"]) for r in doc["imp"]], [("B2", 6), ("A1", 4)])
    check("and the slip", [(r["n"], r["ch"]) for r in doc["dec"]], [("A1", -5)])
    check("movement names today's division too",
          (doc["imp"][0]["d"], doc["imp"][0]["a"]), ("G", "04"))

    check("the document says the record was carried", doc["inherited"], True)
    check("and names the districts it came from, most clubs first",
          doc["carried"], [["92", 2], ["121", 1]])
    check("the district is still its own", (doc["district_id"], doc["district"]),
          ("299", "District 299"))
    check("twelve goal rows survive", len(by["A1"]["y"]["2023-2024"]["g"]), 12)

    # A district with an archive of its own is not a candidate at all.
    check("a district with finished years is left alone",
          I.needs_carrying({"years": ["2024-2025"], "clubs": [1]}), False)
    check("one with an empty archive is not",
          I.needs_carrying({"years": [], "clubs": []}), True)
    check("and a district with no data.json at all is skipped",
          I.needs_carrying(None), False)

    # Nothing to carry must still leave a document a browser can render.
    bare = I.build("299", [{"n": "Z9", "m": "Zulu", "d": "H", "a": "01"}], ARCHIVES.get)
    check("a district with nothing to carry builds anyway",
          (bare["years"], bare["clubs"], bare["carried"]), ([], [], []))
    check("and does not claim a carried record", bare["inherited"], False)

    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
