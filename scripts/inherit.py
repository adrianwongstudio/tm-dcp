"""Carry a new district's record in from the districts its clubs came from.

The 2026-2027 realignment created thirty districts — 201 through 231 — that
have no finished years of their own. Toastmasters publishes a district's
archive only once a program year has closed, and nothing fills it
retrospectively, so every retrospective section on the board came up empty for
them and the page said so.

But the clubs are not new. 4,664 of the 4,702 clubs in those thirty districts
have a five-year record sitting under whichever district used to hold them.
This pass assembles that record and writes it as the new district's data.json,
so the four retrospective sections have something real to draw.

Every carried year is re-stamped with the club's division and area **today**.
A reader of District 227 wants to know how the clubs now in their Area 04 have
been doing, not how District 121's Division A did — and the four districts
feeding 227 reuse each other's division letters, so the alignment of the day
would collide anyway. That re-stamping is the one thing on this page that is
not literally what the archive says, so the document admits it: `inherited`
and `carried` travel with it, and the page prints the provenance above the
board rather than passing the record off as the district's own.

Runs after crosslink.py. The order matters. crosslink surveys which district
holds which club in which year; if this pass ran first, that survey would see
District 227 holding 2021-2025 and start telling District 121's clubs they had
been in 227 those years, which is false.
"""
import os, sys, json, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import build_district as B
import dcp


def _load(did, name):
    path = C.p("docs", "d", did, name)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _districts():
    root = C.p("docs", "d")
    if not os.path.isdir(root):
        sys.exit("no docs/d — run scripts/build_all.py first")
    return sorted(d for d in os.listdir(root)
                  if os.path.isdir(os.path.join(root, d)))


def needs_carrying(hist):
    """A district with an archive of its own is not a candidate.

    Only an empty `years` qualifies. A missing document is a build that did not
    finish, not a new district, and guessing at one would be worse than leaving
    the page as it is.
    """
    return bool(hist) and not hist.get("years")


def build(did, roster, archive_of):
    """The data.json document for a district whose own archive is empty.

    `roster` is the district's live clubs — the ones it has now, carrying the
    division and area it has now, and the `o` list crosslink wrote saying which
    other districts hold them. `archive_of(district)` returns that district's
    clubs keyed by club number, or None.
    """
    years, clubs, carried = set(), [], collections.Counter()

    for club in sorted(roster, key=lambda c: c["m"].lower()):
        div, area = club.get("d") or "—", club.get("a") or "—"
        found = {}
        # `o` runs newest district first, so the district that held the club
        # most recently owns any year more than one of them claims.
        for source, _years in (club.get("o") or []):
            archive = archive_of(source)
            record = archive.get(club["n"]) if archive else None
            if not record:
                continue
            took = 0
            for py, year in record.get("y", {}).items():
                if py in found:
                    continue
                found[py] = dict(year, d=div, a=area)
                took += 1
            if took:
                carried[source] += 1
        if not found:
            continue                    # nothing to show; not a row on the board
        years.update(found)
        out = {"n": club["n"], "m": club["m"], "d": div, "a": area, "y": found}
        if club.get("o"):
            out["o"] = club["o"]        # the drawer still names where each year sat
        clubs.append(out)

    years = sorted(years)
    climbed, slipped = B.transitions(clubs, years)
    sources = [[d, n] for d, n in carried.most_common()]
    name = C.district_name(did)
    return {
        "years": years,
        "goals": dcp.ROW_NAMES,
        "clubs": clubs,
        "imp": climbed,
        "dec": slipped,
        "district": name,
        "district_id": did,
        "site": B._site_for_publishing(),
        "generated": C.today_local().isoformat(),
        "inherited": bool(sources),
        "carried": sources,
        "source": ("dashboards.toastmasters.org — "
                   + ", ".join(C.district_name(d) for d, _ in sources)
                   if sources else f"dashboards.toastmasters.org — {name}"),
    }


def main():
    archives, loaded = {}, {}

    def archive_of(did):
        """A source district's clubs by number, loaded once and kept."""
        if did not in archives:
            doc = _load(did, "data.json")
            archives[did] = {c["n"]: c for c in doc["clubs"]} if doc else None
            loaded[did] = True
        return archives[did]

    done = 0
    for did in _districts():
        if not needs_carrying(_load(did, "data.json")):
            continue
        live = _load(did, "live.json")
        if not live:
            print(f"  {did:>3}  no open year either — nothing to carry from")
            continue
        doc = build(did, live["clubs"], archive_of)
        if not doc["years"]:
            print(f"  {did:>3}  no club brings a record")
            continue
        with open(C.p("docs", "d", did, "data.json"), "w", encoding="utf-8") as fh:
            json.dump(doc, fh, separators=(",", ":"))
        done += 1
        print(f"  {did:>3}  {len(doc['clubs']):4d}/{len(live['clubs'])} clubs, "
              f"{len(doc['years'])} years from "
              + ", ".join(f"D{d}:{n}" for d, n in doc["carried"]))
    print(f"carried a record into {done} new districts "
          f"from {len([d for d in archives if archives[d]])} older ones")


if __name__ == "__main__":
    main()
