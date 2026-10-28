"""Tests for reading the Find a Club response.

The rest of the board is built from a CSV with fixed columns. This source is
hand-filled by club officers, so almost every field is optional and several
arrive in more than one shape: a club number comes padded or bare, a division
comes as a Name or only as an Id, and a club with no address still answers,
carrying a coordinate pair of nulls or of zeros. Each of those is a row in
the fixture, because each of them would otherwise put a wrong pin on the map
rather than fail loudly.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clublocs

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests", "fixtures")
FAILED = []


def check(label, got, want):
    if got == want:
        print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")


def main():
    with open(os.path.join(FIX, "findaclub.json"), encoding="utf-8") as fh:
        payload = json.load(fh)

    rows = clublocs.parse_clubs(payload)
    by_number = {r["n"]: r for r in rows}

    check("seven rows in, three clubs out", len(rows), 3)
    check("rows come back sorted by club number",
          [r["n"] for r in rows], sorted(r["n"] for r in rows))

    check("a padded club number is kept as published",
          "00000038" in by_number, True)
    check("a bare club number is padded to eight, to match data.json",
          "01134527" in by_number, True)

    check("a club with null coordinates is dropped",
          "00009999" in by_number, False)
    check("and so is one parked at 0,0",
          "00008888" in by_number, False)
    check("a prospective club is not a club yet",
          "00007777" in by_number, False)
    check("a club listed twice gets one pin, not two",
          [r["n"] for r in rows].count("00000059"), 1)
    check("and it is the first row that wins",
          by_number["00000059"]["m"], "Vancouver Toastmasters Club")

    vancouver = by_number["00000059"]
    check("coordinates are numbers, rounded to five places",
          (vancouver["lat"], vancouver["lng"]), (49.27217, -123.1566))
    check("division and area come across",
          (vancouver["d"], vancouver["a"]), ("E", "41"))
    check("the address line joins only the parts that were filled in",
          vancouver["ad"],
          "2401 Point Grey Rd, Kitsilano Yacht Club, Vancouver, BC V6K 1A1")
    check("a club that meets in person carries no online flag",
          "v" in vancouver, False)
    check("an empty website is left out rather than written as an empty string",
          "w" in vancouver, False)

    victoria = by_number["00000038"]
    check("an online club is flagged", victoria.get("v"), 1)
    check("a city-only address does not print stray commas",
          victoria["ad"], "Victoria, BC")
    check("meeting day and time are carried as published",
          (victoria["day"], victoria["t"]), ("Tuesday", "5:15 pm"))
    check("a website is carried when there is one",
          victoria.get("w"), "https://example-first-canadian.org")

    toasted = by_number["01134527"]
    check("a division given only as an Id still reads",
          (toasted["d"], toasted["a"]), ("C", "21"))
    check("an irregular meeting day is not normalised away",
          toasted["day"], "1st & 3rd Thursday")

    check("a bare array is accepted as well as a wrapped one",
          len(clublocs.parse_clubs(payload["Clubs"])), 3)
    check("a payload with no Clubs array is a failure, not an empty district",
          clublocs.parse_clubs({"Error": "nope"}), None)
    check("and so is a payload that is not JSON we recognise",
          clublocs.parse_clubs("nope"), None)

    check("the search URL names the district",
          clublocs.search_url("21").endswith("district=21"), True)

    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
