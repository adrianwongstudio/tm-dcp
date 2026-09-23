"""Build one district's two JSON files from the dashboard's CSV exports.

One fetch per district-year. The district's own export is the authority on
which clubs were in the district that year — a club report page carries a
division and an area but no district, which is how the earlier scrape came to
file clubs under a district they were not in.
"""
import os, sys, json, base64, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import csvmap
import dashboards
import dcp

DISTINGUISHED = 5      # the threshold both movement lists pivot on


def _site_for_publishing():
    """The site config with the contact address encoded rather than plain.

    Harvesters crawl static files for anything matching an email pattern. This
    is not secrecy — anyone reading the code can undo it — but it keeps the
    address out of a regex.
    """
    out = dict(C.CONFIG.get("site", {}))
    addr = out.pop("contact_email", "")
    if addr:
        out["contact_email_enc"] = base64.b64encode(addr[::-1].encode()).decode()
    return out


def _year_record(row):
    """One club's year, as the page reads it."""
    return {"f": row["met"], "st": row["st"], "mb": row["mb"], "md": row["md"],
            "g": row["goals"], "csp": "", "d": row["d"], "a": row["a"]}


def _transitions(clubs, years):
    """Clubs that climbed from under the threshold, and slipped from above it."""
    climbed, slipped = [], []
    for c in clubs:
        for before, after in zip(years, years[1:]):
            was = c["y"].get(before, {}).get("f")
            now = c["y"].get(after, {}).get("f")
            if was is None or now is None:
                continue
            end = c["y"][after]
            rec = {"n": c["n"], "m": c["m"],
                   "d": end.get("d") or c["d"], "a": end.get("a") or c["a"],
                   "fy": before, "ty": after, "fd": was, "td": now,
                   "ch": now - was, "st": end["st"]}
            if was < DISTINGUISHED and now > was:
                climbed.append(rec)
            if was > DISTINGUISHED and now < was:
                slipped.append(rec)
    climbed.sort(key=lambda r: -r["ch"])
    slipped.sort(key=lambda r: r["ch"])
    return climbed, slipped


def build_history(district, fetch=dashboards.club_performance):
    """The data.json document for one district's finished years."""
    per_year, names, got_years = {}, {}, []
    for py in C.program_years():
        text, _ = fetch(district, py)
        rows, _asof = csvmap.read(text)
        if not rows:
            continue                       # a district younger than this year
        got_years.append(py)
        for r in rows:
            per_year.setdefault(r["n"], {})[py] = _year_record(r)
            names[r["n"]] = r["m"]         # the most recent year wins

    clubs = []
    for cid in sorted(per_year, key=lambda c: names[c].lower()):
        ys = per_year[cid]
        latest = ys[max(ys, key=lambda p: got_years.index(p))]
        clubs.append({"n": cid, "m": names[cid],
                      "d": latest["d"], "a": latest["a"], "y": ys})

    climbed, slipped = _transitions(clubs, got_years)
    return {
        "years": got_years,
        "goals": dcp.ROW_NAMES,
        "clubs": clubs,
        "imp": climbed,
        "dec": slipped,
        "district": C.district_name(district),
        "district_id": district,
        "site": _site_for_publishing(),
        "generated": C.today_local().isoformat(),
        "source": f"dashboards.toastmasters.org — {C.district_name(district)}",
    }
