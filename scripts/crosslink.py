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

It also writes `ay`, the club's year-end score for the years this district
does not hold it: `{"2021-2022": [2, "121"]}`, the score and the district that
recorded it. A club's DCP record is the club's, not the district's, so a club
that transferred in should not read as five blank years on a page about that
club. This is deliberately only the club's own number: the board, the division
averages, the goal gap and the movement lists all stay scoped to the years the
district really had, because those are claims about a district and this is not.
3,496 cells across the whole board, so the cost is a few hundred bytes each.

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
    """Two maps across the whole board, from one sweep of the files.

    `where`  {club: {district: {program years}}} - who held the club when.
    `scores` {district: {club: {program year: goals met}}} - the number itself,
             kept thin on purpose: one int per club-year rather than the whole
             record, so the entire board fits in memory without trouble.
    """
    where = collections.defaultdict(lambda: collections.defaultdict(set))
    scores = {}
    for did in dids:
        hist, _ = _load(did, "data.json")
        if hist:
            per = scores.setdefault(did, {})
            for c in hist["clubs"]:
                where[c["n"]][did].update(c["y"].keys())
                per[c["n"]] = {y: v.get("f") for y, v in c["y"].items()}
        live, _ = _load(did, "live.json")
        if live:
            for c in live["clubs"]:
                where[c["n"]][did].add(live["py"])
    return where, scores


def main():
    dids = _districts()
    where, scores = survey(dids)
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

    touched = carried = 0
    for did in dids:
        for name in ("data.json", "live.json"):
            doc, path = _load(did, name)
            if not doc:
                continue
            years = doc.get("years") or []
            n = 0
            for c in doc["clubs"]:
                o = elsewhere(c["n"], did)
                if o:
                    c["o"] = o
                    n += 1
                else:
                    c.pop("o", None)
                # the club's own score for the years this district has no row
                # for it. `o` runs newest district first, so the most recent
                # one to hold the club owns a year more than one of them has.
                away = {}
                for y in (y for y in years if y not in c.get("y", {})):
                    for src, _ys in (o or []):
                        f = scores.get(src, {}).get(c["n"], {}).get(y)
                        if f is not None:
                            away[y] = [f, src]
                            break
                if away:
                    c["ay"] = away
                    carried += len(away)
                else:
                    c.pop("ay", None)
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(doc, fh, separators=(",", ":"))
            touched += n
    print(f"  wrote {touched} cross-district club links "
          f"and {carried} scores a club brought with it")


if __name__ == "__main__":
    main()
