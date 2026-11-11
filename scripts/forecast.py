"""Analog-year bootstrap forecast of a club's June 30 DCP result.

Each draw replays one past November-to-June season (the club's own, or a
similar club's) on top of where the club stands today, then scores the
simulated year end under the official rules. See plans/forecast-method.md.

A season row is [dl1, dl2, dl3, dl4, dnew, dmembers, t2_ok, apr_ok]: the gains
in cumulative counts, the change in members, and whether round-2 officer
training and April dues landed. NaN marks a field a synthesized season cannot
know; it is borrowed from a peer season.
"""
import hashlib
import numpy as np

N_SIMS, DECAY, K_SHRINK = 2000, 0.75, 1.5
COUNTS = ["l1", "l2", "l3", "l4", "new"]
BANDS = [(0, 7), (8, 12), (13, 19), (20, 24), (25, 10**6)]
# Day of program year (Jul 1 = 1) of each deadline that still matters.
DEC31, APR1, MAY31 = 184, 275, 335
SEMIANNUAL_P = 0.05


def band(members):
    return next(i for i, (lo, hi) in enumerate(BANDS) if lo <= members <= hi)


def season_row(snap, end):
    """One analog from a snapshot and its year end (dicts of metrics)."""
    gains = [max(0, end[k] - snap[k]) for k in COUNTS]
    return gains + [end["members"] - snap["members"],
                    float(end["t2"] >= 4), float(end["dues"] > snap["dues"])]


def synth_row(end, curve):
    """An analog for a club with only year-end history: counts from the curve,
    the three fields the curve cannot give left as NaN."""
    gains = [round(end[k] * (1 - curve[k])) for k in COUNTS]
    return gains + [np.nan] * 3


def peer_pool(seasons):
    """{band: array of season rows}, bucketed by members at the snapshot."""
    pool = {}
    for s in seasons:
        pool.setdefault(band(s["snap"]["members"]), []).append(season_row(s["snap"], s["end"]))
    return {b: np.array(r, dtype=float) for b, r in pool.items()}


def tiers(goals, members, net, offset=0):
    """Official 2025-26 and 2026-27 levels; offset=1 outside a district."""
    return {
        "distinguished": (goals >= 5 - offset) & ((members >= 20) | (net >= 3)),
        "select": (goals >= 7 - offset) & ((members >= 20) | (net >= 5)),
        "presidents": (goals >= 9 - offset) & (members >= 20),
        "smedley": (goals >= 10 - offset) & (members >= 25),
    }


def _seed(club, py):
    return int(hashlib.sha1(f"{club}{py}".encode()).hexdigest()[:8], 16)


def _draw_rows(rng, own, ages, peers, members):
    """N_SIMS season rows: own seasons with weight W/(W+k), else a peer's."""
    peer = peers.get(band(members))
    if peer is None:
        peer = next(iter(peers.values()))
    rows = peer[rng.integers(len(peer), size=N_SIMS)]
    if len(own) == 0:
        return rows, 0.0
    w = DECAY ** (np.asarray(ages) - 1)
    p_own = w.sum() / (w.sum() + K_SHRINK)
    mine = own[rng.choice(len(own), size=N_SIMS, p=w / w.sum())]
    mine = np.where(np.isnan(mine), rows, mine)
    return np.where((rng.random(N_SIMS) < p_own)[:, None], mine, rows), p_own


def _pct(x, q):
    return int(np.percentile(x, q))


def forecast_club(c, own, ages, peers, day, offset=0):
    """c: current state. own/ages: the club's season rows and how many years
    back each is (1 = last year). day: day of program year of the snapshot."""
    if str(c["status"]).startswith("Susp"):
        return {"status": "suspended"}
    rng = np.random.default_rng(_seed(c["n"], c["py"]))
    rows, p_own = _draw_rows(rng, np.asarray(own, float).reshape(-1, 8), ages, peers, c["members"])

    cnt = {k: c[k] + rows[:, i] for i, k in enumerate(COUNTS)}
    members = np.maximum(0, c["members"] + rows[:, 5])
    net = members - c["base"]

    g9 = (c["t1"] >= 4) & ((c["t2"] >= 4) | ((day <= MAY31) & (rows[:, 6] > 0)))
    dues = c["dues_oct"] | ((day <= APR1) & (rows[:, 7] > 0))
    listed = c["officer_list"] | ((day <= DEC31) & (rng.random(N_SIMS) < SEMIANNUAL_P))
    tests = [cnt["l1"] >= 4, cnt["l2"] >= 2, cnt["l2"] >= 4, cnt["l3"] >= 2,
             cnt["l4"] >= 1, cnt["l4"] >= 2, cnt["new"] >= 4, cnt["new"] >= 8,
             g9, dues & listed]
    goals = np.sum(tests, axis=0)

    eligible = c["csp"]
    p = {k: round(float(v.mean()), 3) if eligible else 0.0
         for k, v in tiers(goals, members, net, offset).items()}
    n_own = len(own)
    return {
        "status": "active",
        "goals": {"median": _pct(goals, 50), "mean": round(float(goals.mean()), 2),
                  "p10": _pct(goals, 10), "p90": _pct(goals, 90)},
        "members": {"median": _pct(members, 50), "p10": _pct(members, 10),
                    "p90": _pct(members, 90)},
        "pTier": p,
        "pGoal": [round(float(t.mean()), 3) for t in tests],
        "confidence": "high" if n_own >= 3 else "medium" if n_own else "low",
        "nSeasons": n_own, "pOwn": round(p_own, 2),
    }
