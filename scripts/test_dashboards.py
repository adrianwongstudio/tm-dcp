"""Tests for reading the district list off the dashboard home page.

Runs against a saved fixture: the parse has to keep working when the site is
down, and a test that fetches is a test that fails for reasons of its own.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dashboards as D

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "..", "tests", "fixtures", "home.html")
FAILED = []


def check(label, got, want):
    if got == want:
        print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")


def main():
    html = open(FIXTURE, encoding="utf-8", errors="replace").read()
    regions = D.parse_district_index(html)
    ids = [d for r in regions for d in r["d"]]

    check("fourteen regions", len(regions), 14)
    check("ninety-four districts", len(ids), 94)
    check("no district listed twice", len(set(ids)), 94)
    check("regions are in dashboard order", [r["r"] for r in regions][:3],
          ["Region 01", "Region 02", "Region 03"])
    check("District 21 sits in Region 01",
          next(r["r"] for r in regions if "21" in r["d"]), "Region 01")
    check("the non-numeric districts survive",
          sorted(i for i in ids if not i.isdigit()), ["F", "U"])
    check("leading zeros are kept", "02" in ids, True)
    check("District 21 is not '021' or '21 '", [i for i in ids if i.strip() == "21"], ["21"])

    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
