"""Write docs/districts.json — the index the page loads before it knows which
district it wants.

The per-district content hashes are filled in later by stamp_assets.py, once
the data files they describe exist.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import dashboards as D


def main():
    regions = D.district_index()
    if not regions:
        sys.exit("could not read the district list from the dashboard home page")
    ids = [d for r in regions for d in r["d"]]
    dest = C.p("docs", "districts.json")

    # Keep any hashes and club counts a previous run established; this script
    # knows the roster, not the data.
    old = {}
    if os.path.exists(dest):
        old = json.load(open(dest, encoding="utf-8")).get("districts", {})

    doc = {
        "generated": C.today_local().isoformat(),
        "default": C.CONFIG.get("default_district", "21"),
        "regions": regions,
        "districts": {i: old.get(i, {"name": C.district_name(i)}) for i in ids},
    }
    json.dump(doc, open(dest, "w", encoding="utf-8"), separators=(",", ":"))
    print(f"wrote {dest}  regions={len(regions)} districts={len(ids)}")


if __name__ == "__main__":
    main()
