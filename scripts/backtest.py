"""Back-test the forecast on the real seasons in data/seasons.json.

For each test year the club's own history and the peer pool hold only earlier
years, so nothing leaks. Truth is the published year-end goals, and the tiers
those goals and members earn under the current rules. Each forecast is scored
twice: as simulated, and recalibrated with a fit that saw earlier years only.

    uv run scripts/backtest.py            # as of ~Nov 10 (the October report)
    uv run scripts/backtest.py 253        # any day of the program year in F.MONTH_DAYS
"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import forecast as F

SEASONS = json.load(open(C.p("data", "seasons.json"), encoding="utf-8"))["seasons"]
YEAR = lambda s: int(s["py"][:4])
BY = {(s["n"], YEAR(s)): s for s in SEASONS}
CAL_DAYS = [72, 133, 194, 253, 314]       # Aug, Oct, Dec, Feb and Apr reports
CSP_KNOWN = 102                           # the plan is due Sep 30; known from the September report


def prev_goals(s):
    p = BY.get((s["n"], YEAR(s) - 1))
    return p["g"] if p else None


def truth(s):
    end = F.state(s["s"][-1][1:])
    t = F.tiers(np.array(s["g"]), np.array(end["members"]), np.array(end["members"] - end["base"]))
    return {k: int(bool(v) and s["csp"] is not False) for k, v in t.items()}


def run(year, day):
    """One record per club of `year` that has a report filed on `day`."""
    pool, own = [], {}
    for s in SEASONS:
        if YEAR(s) >= year:
            continue
        snap = F.snapshot_at(s["s"], day)
        if snap is None:
            continue
        end = F.state(s["s"][-1][1:])
        pool.append({"snap": snap, "end": end, "prev": prev_goals(s)})
        own.setdefault(s["n"], []).append((F.season_row(snap, end), year - YEAR(s)))
    peers = F.peer_pool(pool)
    out = []
    for s in SEASONS:
        now = next((x for x in s["s"] if x[0] == day), None)
        if YEAR(s) != year or now is None:
            continue
        v = F.state(now[1:])
        c = {"n": s["n"], "py": s["py"], "status": "", "prev": prev_goals(s),
             "csp": s["csp"] is not False if day >= CSP_KNOWN else True,
             **{k: v[k] for k in F.COUNTS}, "members": v["members"], "base": v["base"],
             "t1": v["t1"], "t2": v["t2"], "dues_oct": v["dues"] >= 1, "officer_list": v["olist"] >= 1}
        mine = own.get(s["n"], [])
        f = F.forecast_club(c, [r for r, _ in mine], [a for _, a in mine], peers, day)
        out.append({"year": year, "day": day, "f": f, "goals": s["g"], "last": c["prev"], "truth": truth(s),
                    "csp": c["csp"]})
    return out


def collect(years, days=CAL_DAYS):
    return [r for y in years for d in days for r in run(y, d)]


def fit(records):
    """{tier: [a, b]} from forecasts and how they turned out."""
    ok = [r for r in records if r["csp"]]           # a club without its plan is out whatever the odds
    return {k: F.fit_calibration([r["f"]["pRaw"][k] for r in ok], [r["truth"][k] for r in ok])
            for k in F.TIERS}


def _skill(p, d, base):
    return 1 - ((p - d) ** 2).mean() / ((base - d) ** 2).mean()


def report(day=133):
    years = sorted({YEAR(s) for s in SEASONS})[1:]
    everything = collect(years, sorted(set(CAL_DAYS) | {day}))
    print(f"as of day {day} of the program year; tiers under the current rules")
    tot = []
    for y in years:
        r = [x for x in everything if x["year"] == y and x["day"] == day]
        seen = [x for x in everything if x["year"] < y]
        cal = fit(seen) if seen else None
        med = np.array([x["f"]["goals"]["median"] for x in r]); act = np.array([x["goals"] for x in r])
        lo = np.array([x["f"]["goals"]["p10"] for x in r]); hi = np.array([x["f"]["goals"]["p90"] for x in r])
        has = np.array([x["last"] is not None for x in r])
        last = np.array([x["last"] if x["last"] is not None else 0 for x in r])
        raw = np.array([x["f"]["pRaw"]["distinguished"] * x["csp"] for x in r])
        d = np.array([x["truth"]["distinguished"] for x in r])
        p = np.array([F.tier_odds(x["f"]["pRaw"], x["f"]["ceil"], cal)["distinguished"] * x["csp"] for x in r])
        tot.append((med, act, lo, hi, has, last, raw, p, d, np.full(len(r), d.mean())))
        print(f"{y}-{y + 1}  n={len(r):3d}  MAE {abs(med - act).mean():.2f} vs last-year {abs(last - act)[has].mean():.2f}"
              f"  within1 {(abs(med - act) <= 1).mean():.0%}  coverage {((act >= lo) & (act <= hi)).mean():.0%}"
              f"  skill raw {_skill(raw, d, d.mean()):+.2f} cal {_skill(p, d, d.mean()):+.2f}"
              f"  Distinguished: raw {raw.sum():.0f}, cal {p.sum():.0f}, actual {d.sum()}")
    med, act, lo, hi, has, last, raw, p, d, base = (np.concatenate(x) for x in zip(*tot))
    print(f"all        n={len(act):3d}  MAE {abs(med - act).mean():.2f} vs last-year {abs(last - act)[has].mean():.2f}"
          f"  within1 {(abs(med - act) <= 1).mean():.0%}  coverage {((act >= lo) & (act <= hi)).mean():.0%}"
          f"  skill raw {_skill(raw, d, base):+.2f} cal {_skill(p, d, base):+.2f}"
          f"  Distinguished: raw {raw.sum():.0f}, cal {p.sum():.0f}, actual {d.sum()}")


if __name__ == "__main__":
    report(int(sys.argv[1]) if len(sys.argv) > 1 else 133)
