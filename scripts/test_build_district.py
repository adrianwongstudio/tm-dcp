"""Tests for assembling a district's finished years from CSVs.

Driven from the two saved fixtures rather than the network, and asserted
against District 21's real 2023-2024 numbers, which were cross-checked
against the shipped site: 109 clubs, all agreeing on goals, division and area.
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
    """2023-2024 comes from the fixture; every other year is a dead endpoint."""
    if program_year == "2023-2024":
        return open(os.path.join(FIX, "cp_closed.csv"), encoding="utf-8-sig").read(), "fixture"
    return None, "fixture"


def main():
    doc = B.build_history("21", fetch=fake_fetch)
    clubs = doc["clubs"]
    by = {c["n"]: c for c in clubs}

    check("only the year that returned data is present",
          sorted({py for c in clubs for py in c["y"]}), ["2023-2024"])
    check("one club record per club in that year", len(clubs), 109)
    check("clubs are sorted by name",
          [c["m"] for c in clubs] == sorted((c["m"] for c in clubs), key=str.lower), True)

    first = by["00000038"]["y"]["2023-2024"]
    check("year-end goals", first["f"], 9)
    check("that year's alignment, not today's", (first["d"], first["a"]), ("A", "01"))
    check("twelve underlying rows", len(first["g"]), 12)
    check("recognition label", first["st"], "President's Distinguished")
    check("no monthly series survives", "s" in first, False)
    # 2023-2024 does not publish the column; 2025-2026 onwards does, and a
    # blank must mean "the year did not say", never "the club had no plan".
    check("a year without the column carries no success plan", first["csp"], "")

    check("top-level alignment is the latest year's",
          (by["00000038"]["d"], by["00000038"]["a"]), ("A", "01"))
    check("a single year yields no transitions", (doc["imp"], doc["dec"]), ([], []))
    check("district id is a string", doc["district_id"], "21")
    check("district name", doc["district"], "District 21")

    # A district that returns nothing at all must still produce a valid document.
    empty = B.build_history("227", fetch=lambda d, py: (None, "fixture"))
    check("a district with no data still builds", empty["clubs"], [])
    check("and claims no years", empty["years"], [])

    # The hero's update note. The build resolves the workflow's own schedule
    # to a single UTC instant; the page is what turns it into the reader's
    # day and clock, so this end only has to land on the right moment.
    utc = datetime.timezone.utc
    at = lambda s: datetime.datetime.fromisoformat(s).replace(tzinfo=utc)
    saved = dict(B.C.UPDATES)
    try:
        B.C.UPDATES.update({"cadence": "New data every {day}", "weekday": "Sunday",
                            "time": "16:00", "timezone": "UTC", "next": ""})
        check("the hour named, not midnight",
              B.C.next_update(at("2026-10-14T09:00")), "2026-10-18T16:00:00Z")
        check("on the day itself, before the run, it is still today's",
              B.C.next_update(at("2026-10-11T15:40")), "2026-10-11T16:00:00Z")
        check("and the run that built the page is never the next one",
              B.C.next_update(at("2026-10-11T16:00")), "2026-10-18T16:00:00Z")
        B.C.UPDATES["next"] = "2027-01-05"
        check("a bare date the owner names lands at the usual hour",
              B.C.next_update(at("2026-10-14T09:00")), "2027-01-05T16:00:00Z")
        B.C.UPDATES["next"] = "2026-10-15T22:30"
        check("and a time with it is taken as written",
              B.C.next_update(at("2026-10-14T09:00")), "2026-10-15T22:30:00Z")
        B.C.UPDATES["next"] = "2026-01-01"
        check("an override that has gone hands back to the weekday",
              B.C.next_update(at("2026-10-14T09:00")), "2026-10-18T16:00:00Z")
        B.C.UPDATES.update({"weekday": "", "next": ""})
        check("no weekday and no override promises nothing",
              B.C.next_update(at("2026-10-14T09:00")), "")
        check("but the cadence still travels, for the page to judge",
              B._site_for_publishing()["update_cadence"], "New data every {day}")
    finally:
        B.C.UPDATES.clear()
        B.C.UPDATES.update(saved)

    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
