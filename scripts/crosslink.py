"""Link a club to itself across districts.

A club number is stable; a district is not. The 2026-2027 realignment moved
**6,823 of 20,868 clubs** into a different district, so a club's five finished
years can sit under one district and its year in progress under another — the
same club, looking like two unrelated ones because every view on this board is
scoped to a district.

This pass reads every district's files, works out which districts hold each
club in which years, and writes that back onto the club records that need it
as `o`: the other districts holding this club, and the years each one has.
Only a club that actually moved carries the key, so the cost is a few KB in
the districts that were realigned and nothing anywhere else.

Runs after build_all.py and before stamp_assets.py, because it rewrites the
files whose hashes that script takes.
"""
import os, sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C


def _districts():
    root = C.p("docs", "d")
    if not os.path.isdir(root):
        sys.exit("no docs/d — run scripts/build_all.py first")
    return sorted(d for d in os.listdir(root)
                  if os.path.isdir(os.path.join(root, d)))


def _load(did, name):
    path = C.p("docs", "d", did, name)
    if not os.path.exists(path):
        return None, path
    with open(path, encoding="utf-8") as fh:
        return json.load(fh), path


def survey(dids):
    """{club number: {district: [program years]}} across the whole board."""
    where = collections.defaultdict(lambda: collections.defaultdict(set))
    for did in dids:
        hist, _ = _load(did, "data.json")
        if hist:
            for c in hist["clubs"]:
                where[c["n"]][did].update(c["y"].keys())
        live, _ = _load(did, "live.json")
        if live:
            for c in live["clubs"]:
                where[c["n"]][did].add(live["py"])
    return where


def main():
    dids = _districts()
    where = survey(dids)
    moved = {n: d for n, d in where.items() if len(d) > 1}
    print(f"  {len(where)} clubs, {len(moved)} in more than one district")

    def elsewhere(club, did):
        """[[district, [years, newest first]]] for every OTHER district, the
        district holding the club most recently first."""
        other = moved.get(club)
        if not other:
            return None
        out = [[d, sorted(ys, reverse=True)] for d, ys in other.items() if d != did]
        out.sort(key=lambda r: r[1][0], reverse=True)
        return out or None

    touched = 0
    for did in dids:
        for name in ("data.json", "live.json"):
            doc, path = _load(did, name)
            if not doc:
                continue
            n = 0
            for c in doc["clubs"]:
                o = elsewhere(c["n"], did)
                if o:
                    c["o"] = o
                    n += 1
                else:
                    c.pop("o", None)
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(doc, fh, separators=(",", ":"))
            touched += n
    print(f"  wrote {touched} cross-district club links")


if __name__ == "__main__":
    main()
