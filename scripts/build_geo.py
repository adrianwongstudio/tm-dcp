"""Where every club meets — one geo.json per district, refreshed monthly.

The board itself is rebuilt weekly from the club performance CSV, which moves
every week because the numbers on it do. Where a club meets does not: a club
charters, moves hall once in a decade, or closes. So this runs on its own
schedule, once a month, against its own source, and writes its own file.

    docs/d/<id>/geo.json    {"district","generated","source","clubs":[…]}

A run is a full replacement of that file, which is what makes the monthly
pass do both halves of the job without keeping any state: a club chartered
since last month appears because the API now lists it, and a club that closed
disappears because the API no longer does. The diff against what was on disk
is printed rather than stored — it is there so a person reading the run log
can see what moved, and so an obviously wrong answer can be refused.

Only the districts that exist today are fetched. A dissolved district keeps
its five finished years on the board, but it has no clubs to put on a map.
"""
import os, sys, json, argparse, threading, queue, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import clublocs

THREADS = 4

# A district that answers with nothing is almost always the API having a bad
# minute, not 200 clubs closing at once. One or two is a bad afternoon; a
# tenth of them is a broken run that must not reach the site.
EMPTY_SHARE = 10

# A district losing most of its pins in a month is the same kind of lie in
# the other direction: the fetch succeeded, the payload was short. Districts
# past this keep the file they had and are reported.
KEEP_SHARE = 0.60
KEEP_FLOOR = 12


def geo_path(district):
    return C.p("docs", "d", str(district), "geo.json")


def existing(district):
    """The clubs already on disk for a district, keyed by number. {} if none."""
    path = geo_path(district)
    if not os.path.exists(path):
        return {}
    try:
        doc = json.load(open(path, encoding="utf-8"))
    except Exception:
        return {}
    return {c["n"]: c for c in doc.get("clubs", []) if isinstance(c, dict) and c.get("n")}


def changes(before, after):
    """(added, removed, moved) club numbers between two keyed sets."""
    old, new = set(before), {c["n"] for c in after}
    moved = [
        c["n"] for c in after
        if c["n"] in before
        and (c["lat"], c["lng"]) != (before[c["n"]].get("lat"), before[c["n"]].get("lng"))
    ]
    return sorted(new - old), sorted(old - new), sorted(moved)


def write(district):
    """Fetch one district and write its geo.json.

    Returns a result dict the run summary reads. The file is left exactly as
    it was on anything short of a clean, plausible answer — a stale pin is a
    club that has not moved since last month, and an absent file is a map
    with a hole in it.
    """
    did = str(district)
    before = existing(did)
    clubs, url = clublocs.district_locations(did)

    if clubs is None:
        return {"d": did, "ok": False, "why": "fetch failed", "kept": bool(before)}

    if not clubs:
        return {"d": did, "ok": False, "why": "no clubs returned", "kept": bool(before),
                "empty": True}

    # The one case where a successful fetch is still refused.
    if before and len(clubs) < max(KEEP_FLOOR, len(before) * KEEP_SHARE):
        return {"d": did, "ok": False, "kept": True,
                "why": f"{len(clubs)} clubs against {len(before)} on disk"}

    added, removed, moved = changes(before, clubs)

    doc = {
        "district": did,
        "generated": C.stamp(),
        "source": url,
        "clubs": clubs,
    }
    path = geo_path(did)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(doc, open(path, "w", encoding="utf-8"), separators=(",", ":"))

    return {"d": did, "ok": True, "n": len(clubs), "was": len(before),
            "added": added, "removed": removed, "moved": moved}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="district ids; default is every current one")
    args = ap.parse_args()

    index = C.p("docs", "districts.json")
    if not os.path.exists(index):
        sys.exit("run scripts/districts.py first — docs/districts.json is missing")
    doc = json.load(open(index, encoding="utf-8"))
    current = [d for r in doc["regions"] for d in r["d"]]

    todo = args.only or current
    work = queue.Queue()
    for d in todo:
        work.put(d)

    results, lock = [], threading.Lock()

    def worker():
        while True:
            try:
                did = work.get_nowait()
            except queue.Empty:
                return
            try:
                out = write(did)
            except Exception:
                out = {"d": did, "ok": False, "why": "crashed", "kept": True}
                with lock:
                    print(traceback.format_exc(), flush=True)
            with lock:
                results.append(out)
                if out["ok"]:
                    note = ""
                    if out["added"] or out["removed"]:
                        note = f"  +{len(out['added'])} / -{len(out['removed'])}"
                    if out["moved"]:
                        note += f"  ~{len(out['moved'])} moved"
                    print(f"  {did:>3}  {out['n']:4d} clubs{note}", flush=True)
                else:
                    kept = "kept last month's file" if out.get("kept") else "no file"
                    print(f"  {did:>3}  SKIPPED — {out['why']} ({kept})", flush=True)

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(THREADS)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    good = [r for r in results if r["ok"]]
    bad = [r for r in results if not r["ok"]]

    total = sum(r["n"] for r in good)
    new = sorted(n for r in good for n in r["added"])
    gone = sorted(n for r in good for n in r["removed"])

    print(f"\n{len(good)}/{len(todo)} districts  ·  {total} clubs located")
    print(f"  chartered or newly listed: {len(new)}")
    print(f"  no longer listed:          {len(gone)}")
    if bad:
        print(f"  skipped: {[r['d'] for r in bad]}")

    # Same refusal the weekly build makes, for the same reason: a run that
    # mostly failed must not be committed over a run that mostly worked.
    if len(bad) > max(1, len(todo) // EMPTY_SHARE):
        sys.exit(f"{len(bad)} districts did not build — refusing to call this a run")


if __name__ == "__main__":
    main()
