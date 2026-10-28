"""Tests for the monthly location build.

The run is a full replacement of each district's geo.json, so the only thing
standing between a bad afternoon at the API and a map with holes in it is the
set of refusals here. Each one is driven against a stubbed fetch, because the
real one is a request to somebody else's server and these have to run
anywhere.
"""
import os, sys, json, shutil, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clublocs
import build_geo

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests", "fixtures")
FAILED = []


def check(label, got, want):
    if got == want:
        print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")


def stub(clubs):
    """Make district_locations answer with these records and nothing else."""
    build_geo.clublocs.district_locations = lambda d: (clubs, "stub://" + str(d))


def club(number, lat=49.0, lng=-123.0, name="Club"):
    return {"n": number, "m": name, "d": "B", "a": "10", "lat": lat, "lng": lng}


def read(did):
    return json.load(open(build_geo.geo_path(did), encoding="utf-8"))


def main():
    real = clublocs.district_locations
    sandbox = tempfile.mkdtemp()
    original_p = build_geo.C.p
    build_geo.C.p = lambda *parts: os.path.join(sandbox, *parts)

    try:
        # --- the parser feeds the builder ----------------------------------
        with open(os.path.join(FIX, "findaclub.json"), encoding="utf-8") as fh:
            parsed = clublocs.parse_clubs(json.load(fh))
        stub(parsed)
        out = build_geo.write("21")
        check("a first run writes every club it was given", out["n"], len(parsed))
        check("and reports them all as new", len(out["added"]), len(parsed))
        check("the file names its district", read("21")["district"], "21")
        check("and records where it came from", read("21")["source"], "stub://21")

        # --- a second run is the add/remove pass ---------------------------
        twenty = [club(f"{i:08d}") for i in range(1, 21)]
        stub(twenty)
        build_geo.write("55")
        stub(twenty[1:] + [club("00000099")])          # one gone, one new
        out = build_geo.write("55")
        check("a club that stopped being listed is removed",
              out["removed"], [twenty[0]["n"]])
        check("a club that appeared is added", out["added"], ["00000099"])
        check("and the file holds exactly what was returned",
              len(read("55")["clubs"]), 20)

        # --- a club that moved hall ----------------------------------------
        moved = [dict(c) for c in twenty]
        moved[3] = dict(moved[3], lat=50.5)
        stub(twenty)
        build_geo.write("56")
        stub(moved)
        out = build_geo.write("56")
        check("a club whose coordinates changed is reported as moved",
              out["moved"], [twenty[3]["n"]])

        # --- the refusals ---------------------------------------------------
        stub(twenty)
        build_geo.write("77")
        before = read("77")["clubs"]

        stub(None)                                      # fetch failed
        out = build_geo.write("77")
        check("a failed fetch does not write", out["ok"], False)
        check("and leaves last month's file alone", read("77")["clubs"], before)

        stub([])                                        # answered with nothing
        out = build_geo.write("77")
        check("an empty answer is refused", out["ok"], False)
        check("and still leaves the file alone", read("77")["clubs"], before)

        stub(twenty[:5])                                # most of the pins gone
        out = build_geo.write("77")
        check("a run that loses most of a district is refused", out["ok"], False)
        check("the reason names both counts", "5 clubs against 20" in out["why"], True)
        check("and the file is still last month's", read("77")["clubs"], before)

        stub(twenty[:14])                               # a plausible shrink
        out = build_geo.write("77")
        check("a district that merely shrank is accepted", out["ok"], True)
        check("and six clubs come off the map", len(out["removed"]), 6)

        # --- a district with no file yet ------------------------------------
        stub([club("00001111")])
        out = build_geo.write("99")
        check("a small district is fine when there is nothing to compare",
              out["ok"], True)

    finally:
        build_geo.C.p = original_p
        clublocs.district_locations = real
        build_geo.clublocs.district_locations = real
        shutil.rmtree(sandbox, ignore_errors=True)

    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
