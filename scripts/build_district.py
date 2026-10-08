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
    """One club's year, as the page reads it.

    The Club Success Plan was an open-year field only until 2025-2026, when the
    export began publishing it for the closed year too. Hardcoding it empty —
    which the spec called for on the evidence of 2023-2024 — now throws away a
    real column, so it is carried through and the page decides what a blank
    means: a year that did not publish it, rather than a club without a plan.
    """
    return {"f": row["met"], "st": row["st"], "mb": row["mb"], "md": row["md"],
            "g": row["goals"], "csp": row["csp"], "d": row["d"], "a": row["a"]}


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


def build_live(district, fetch=dashboards.club_performance, today=None):
    """The live.json document: where the district stands in the open year."""
    today = today or C.today_local()
    season = C.season_start(today)
    py = f"{season}-{season + 1}"
    end = datetime.date(season + 1, 6, 30)
    win = dcp.windows(season)

    text, _ = fetch(district, py)
    rows, asof = csvmap.read(text)

    out = []
    for r in rows:
        vals = r["goals"]
        st, why = dcp.goal_states(vals, win, today, end)
        hdr = r["met"]
        # A club chartered mid-window has its training goal waived, so the
        # dashboard can credit a goal the rows say is unmet. Trust the header.
        if hdr is not None and sum(x == "m" for x in st) < hdr and st[8] != "m":
            st[8], why[8] = "m", "credited (club chartered mid-window)"
        met = sum(x == "m" for x in st)
        ceil = met + sum(x == "o" for x in st)
        if hdr is not None and met != hdr:
            met, ceil = hdr, max(ceil, hdr)

        ng = r["ng"]
        if ng is None and r["mb"] is not None and r["md"] is not None:
            ng = r["md"] - r["mb"]
        memok = bool(r["md"] is not None and (r["md"] >= 20 or (ng is not None and ng >= 5)))
        out.append({
            "n": r["n"], "m": r["m"], "d": r["d"], "a": r["a"],
            "met": met, "ceil": ceil, "st": st, "why": why, "v": vals,
            "mb": r["mb"], "md": r["md"], "ng": ng, "memok": memok,
            "best": next((n for t, n in dcp.LEVELS if ceil >= t), None),
            "now": next((n for t, n in dcp.LEVELS if met >= t), None),
            "asof": asof, "csp": r["csp"],
        })
    out.sort(key=lambda c: (c["ceil"], c["met"], -len(c["m"])))

    # Reachability alone says little early in the year, when nothing has died.
    # What bites is the next window to shut and who loses a goal when it does.
    close = []
    for i in (8, 9, 10, 11):
        act, _dead, opens = win[i]
        if act < today:
            continue
        n = sum(1 for c in out if c["v"][i] is not None and c["v"][i] < dcp.TARGETS[i])
        if n:
            close.append({"lbl": dcp.ROW_NAMES[i], "date": act.isoformat(),
                          "days": (act - today).days, "clubs": n,
                          "open": today >= opens, "opens": opens.isoformat()})
    close.sort(key=lambda x: x["days"])

    for c in out:
        nd = [(win[i][0], dcp.ROW_NAMES[i]) for g in dcp.GOALS for i in g["r"]
              if not (c["v"][i] is not None and c["v"][i] >= dcp.TARGETS[i])
              and win[i][0] >= today]
        c["nd"], c["ndl"] = (min(nd)[0].isoformat(), min(nd)[1]) if nd else ("", "")

    agg = {"clubs": len(out),
           "dist_now": sum(1 for c in out if c["met"] >= DISTINGUISHED),
           "dist_live": sum(1 for c in out if c["met"] < DISTINGUISHED and c["ceil"] >= DISTINGUISHED),
           "dist_out": sum(1 for c in out if c["ceil"] < DISTINGUISHED),
           "at_risk": sum(1 for c in out if c["ceil"] < DISTINGUISHED),
           "train_dead": sum(1 for c in out if c["st"][8] == "d"),
           "train_open": sum(1 for c in out if c["st"][8] == "o"),
           "memok": sum(1 for c in out if c["memok"]),
           "avg_met": round(sum(c["met"] for c in out) / max(len(out), 1), 2),
           "close": close}

    return {"py": py, "asof": asof, "today": today.isoformat(),
            "end": end.isoformat(), "days": (end - today).days,
            "acts": [win[i][0].isoformat() for i in range(12)],
            "targets": dcp.TARGETS, "rows": dcp.ROW_NAMES,
            "goals": dcp.GOAL_NAMES, "clubs": out, "agg": agg,
            "generated": C.stamp(), "timezone": C.TIMEZONE,
            "source": f"dashboards.toastmasters.org - {C.district_name(district)}",
            "district": C.district_name(district)}


def write(district):
    """Both files for one district. Returns (history clubs, live clubs, years).

    A district dissolved in a realignment has finished years and no open one.
    Its live.json is removed rather than written empty, so the page can tell
    "no longer a district" from "the in-year fetch failed" — which look the
    same to a reader and mean opposite things.
    """
    out_dir = C.p("docs", "d", district)
    os.makedirs(out_dir, exist_ok=True)
    hist = build_history(district)
    live = build_live(district)
    with open(os.path.join(out_dir, "data.json"), "w", encoding="utf-8") as fh:
        json.dump(hist, fh, separators=(",", ":"))

    live_path = os.path.join(out_dir, "live.json")
    if live["clubs"]:
        with open(live_path, "w", encoding="utf-8") as fh:
            json.dump(live, fh, separators=(",", ":"))
    else:
        for stale in (live_path, os.path.join(out_dir, "inyear.xlsx")):
            if os.path.exists(stale):
                os.remove(stale)
    return len(hist["clubs"]), len(live["clubs"]), len(hist["years"])


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/build_district.py <district id>")
    h, l, y = write(sys.argv[1])
    print(f"district {sys.argv[1]}: {h} clubs over {y} finished years, {l} live")
