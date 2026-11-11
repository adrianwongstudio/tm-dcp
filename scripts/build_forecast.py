"""Every district's live.json -> forecast.json, and a weekly snapshot archive.

Reads docs/d/<id>/live.json (today) and data.json (five finished years), plus
data/seasons.json (District 21's real Nov-to-Jun seasons). A club with real
seasons uses them; every other club gets seasons synthesized from its
year-end history. Run after build_all.py.
"""
import os, sys, json, gzip, datetime, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import forecast as F

SEASONS = json.load(open(C.p("data", "seasons.json"), encoding="utf-8"))


def end_metrics(g, members):
    """Year-end cumulative counts from the twelve report rows."""
    return {"l1": g[0], "l2": g[1] + g[2], "l3": g[3], "l4": g[4] + g[5],
            "new": g[6] + g[7], "members": members, "t2": g[9], "dues": g[10]}


def current_state(c, py):
    v = c["v"]
    return {"n": c["n"], "py": py, "status": c.get("status", ""), "csp": c["csp"] == "Y",
            "l1": v[0], "l2": v[1] + v[2], "l3": v[3], "l4": v[4] + v[5],
            "new": v[6] + v[7], "members": c["md"] or 0, "base": c["mb"] or 0,
            "t1": v[8], "t2": v[9], "dues_oct": v[10] >= 1, "officer_list": v[11] >= 1}


def season_age(py, season):
    return season - int(py[:4])


def own_seasons(club, hist, season):
    """(rows, ages) for one club: real seasons if District 21 has them,
    otherwise synthesized from the finished years in data.json."""
    rows, ages = [], []
    for s in REAL.get(club, []):
        rows.append(F.season_row(s["snap"], s["end"]))
        ages.append(season_age(s["py"], season))
    if rows:
        return rows, ages
    for py, y in (hist or {}).items():
        if all(x is not None for x in y["g"]) and y["md"] is not None:
            rows.append(F.synth_row(end_metrics(y["g"], y["md"]), SEASONS["curve"]))
            ages.append(season_age(py, season))
    return rows, ages


REAL = {}
for _s in SEASONS["seasons"]:
    REAL.setdefault(_s["n"], []).append(_s)
PEERS = F.peer_pool(SEASONS["seasons"])


def day_of_py(asof_iso, season):
    return (datetime.date.fromisoformat(asof_iso) - datetime.date(season, 7, 1)).days + 1


def district_summary(clubs):
    """Expected Distinguished-or-better clubs, with an 80% band."""
    ps = [c["forecast"]["pTier"]["distinguished"] for c in clubs if c["forecast"]["status"] == "active"]
    mean = sum(ps)
    sd = math.sqrt(sum(p * (1 - p) for p in ps))
    return {"expected": round(mean, 1), "p10": round(mean - 1.2816 * sd), "p90": round(mean + 1.2816 * sd)}


def archive(did, live):
    """Keep this week's raw state, so later years have same-date history."""
    path = C.p("data", "snapshots", live["py"], did, f"{live['asof_iso']}.json.gz")
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    slim = [[c["n"], c["v"], c["mb"], c["md"], c["csp"], c.get("status", "")] for c in live["clubs"]]
    with gzip.open(path, "wt", encoding="utf-8") as fh:
        json.dump(slim, fh, separators=(",", ":"))


def build(did):
    live_path = C.p("docs", "d", did, "live.json")
    if not os.path.exists(live_path):
        return 0
    live = json.load(open(live_path, encoding="utf-8"))
    hist = {c["n"]: c["y"] for c in json.load(open(C.p("docs", "d", did, "data.json"),
                                                     encoding="utf-8"))["clubs"]}
    season = int(live["py"][:4])
    day = day_of_py(live["asof_iso"], season)
    clubs = []
    for c in live["clubs"]:
        own, ages = own_seasons(c["n"], hist.get(c["n"]), season)
        clubs.append({"n": c["n"], "forecast": F.forecast_club(
            current_state(c, live["py"]), own, ages, PEERS, day)})
    for c in clubs:
        p = c["forecast"].get("pTier")
        if p and not p["distinguished"] >= p["select"] >= p["presidents"] >= p["smedley"]:
            raise ValueError(f"{did} {c['n']}: tier probabilities not monotone: {p}")
    doc = {"py": live["py"], "asof": live["asof_iso"], "method": "analog-bootstrap v1",
           "district": district_summary(clubs), "clubs": {c["n"]: c["forecast"] for c in clubs}}
    with open(C.p("docs", "d", did, "forecast.json"), "w", encoding="utf-8") as fh:
        json.dump(doc, fh, separators=(",", ":"))
    archive(did, live)
    return len(clubs)


def main(ids):
    total = 0
    for did in ids:
        n = build(did)
        total += n
        print(f"  {did:>3} {n:4d} clubs", flush=True)
    print(f"{total} club forecasts")


if __name__ == "__main__":
    ids = sys.argv[1:] or sorted(d for d in os.listdir(C.p("docs", "d")))
    main(ids)
