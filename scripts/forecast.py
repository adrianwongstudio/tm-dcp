"""Analog-season forecast of a club's June 30 DCP result.

Each draw replays what one past club-season did between today's date and June
30 (the club's own season, or that of a club that stood where this one stands
now) on top of today's counts, then scores the simulated year end under the
official rules. The tier odds are then recalibrated against how past forecasts
turned out. See plans/forecast-method.md.

A season row is [dl1, dl2, dl3, dl4, dnew, dmembers, t2_ok, apr_ok]: the gains
in cumulative counts, the change in members, and whether round-2 officer
training and April dues landed. NaN marks a field a synthesized season cannot
know; it is borrowed from a peer season.
"""
import hashlib
import numpy as np

N_SIMS, DECAY, K_SHRINK, K_NN = 2000, 0.75, 1.5, 40
COUNTS = ["l1", "l2", "l3", "l4", "new"]
# One stored snapshot of a club: [day of program year, *FIELDS].
FIELDS = COUNTS + ["members", "base", "t1", "t2", "dues", "olist"]
TIERS = ["distinguished", "select", "presidents", "smedley"]
# Day of program year (Jul 1 = 1) of each deadline that still matters.
DEC31, APR1, MAY31 = 184, 275, 335
# A month's report is filed about ten days into the next month; the June
# report, the year end, is filed under YEAR_END.
MONTH_DAYS = [41, 72, 102, 133, 163, 194, 225, 253, 284, 314, 345]
YEAR_END = 375
SEMIANNUAL_P = 0.05
MAX_GAP = 45          # a season with no snapshot this close to the day is not replayed


# ------------------------------------------------------------ seasons ----
def state(vals):
    """{field: value} from a stored snapshot's values (without its day)."""
    return dict(zip(FIELDS, vals))


def snapshot_at(snaps, day):
    """Where a past season stood on `day`, read off its stored snapshots.

    snaps is [[day, *FIELDS], ...] in date order, the last one the year end.
    Between two snapshots the state is interpolated, so a weekly forecast moves
    smoothly instead of jumping when the calendar passes a month end. None when
    the season has nothing stored near that day.
    """
    days = [s[0] for s in snaps]
    if day >= days[-1]:
        return state(snaps[-1][1:])
    if day <= days[0]:
        return state(snaps[0][1:]) if days[0] - day <= MAX_GAP else None
    i = next(k for k, d in enumerate(days) if d > day)
    lo, hi = snaps[i - 1], snaps[i]
    if hi[0] - lo[0] > 2 * MAX_GAP and min(day - lo[0], hi[0] - day) > MAX_GAP:
        return None
    w = (day - lo[0]) / (hi[0] - lo[0])
    return {k: a + w * (b - a) for k, a, b in zip(FIELDS, lo[1:], hi[1:])}


def season_row(snap, end):
    """One analog from a snapshot and its year end (dicts of metrics)."""
    gains = [max(0, round(end[k] - snap[k])) for k in COUNTS]
    return gains + [round(end["members"] - snap["members"]),
                    float(end["t2"] >= 4), float(end["dues"] - snap["dues"] >= 0.5)]


def share_in(curve, day):
    """{count: share of its year-end value already in by `day`}."""
    days = [0] + curve["days"] + [YEAR_END]
    return {k: float(np.interp(day, days, [0.0] + curve[k] + [1.0])) for k in COUNTS}


def synth_row(end, share):
    """An analog for a club with only year-end history: counts from the curve,
    the three fields the curve cannot give left as NaN."""
    gains = [round(end[k] * (1 - share[k])) for k in COUNTS]
    return gains + [np.nan] * 3


# -------------------------------------------------------------- peers ----
def peer_feats(s, prev=None):
    """What makes two club-seasons alike on the same date: awards and new
    members so far (capped where more stops mattering), size, net growth,
    training, dues, and last year's goals."""
    return [min(s["l1"], 6), min(s["l2"], 6), min(s["l3"], 4), min(s["l4"], 4), min(s["new"], 10),
            s["members"], s["members"] - s["base"], float(s["t1"] >= 4), float(s["dues"] >= 1),
            np.nan if prev is None else prev]


def peer_pool(seasons):
    """Past club-seasons as a searchable pool. Each season is
    {"snap", "end"} with an optional "prev" (the goals of the year before)."""
    X = np.array([peer_feats(s["snap"], s.get("prev")) for s in seasons], dtype=float)
    seen = ~np.isnan(X[:, -1])
    fill = float(X[seen, -1].mean()) if seen.any() else 0.0
    X[~seen, -1] = fill
    mu, sd = X.mean(0), X.std(0)
    sd[sd == 0] = 1.0
    return {"rows": np.array([season_row(s["snap"], s["end"]) for s in seasons], dtype=float),
            "Z": (X - mu) / sd, "mu": mu, "sd": sd, "fill": fill}


def nearest(peers, c):
    """Rows of the K_NN past seasons that stood closest to where club c stands."""
    x = np.array(peer_feats({**c, "dues": float(c["dues_oct"])}, c.get("prev")), dtype=float)
    if np.isnan(x[-1]):
        x[-1] = peers["fill"]
    dist = (((x - peers["mu"]) / peers["sd"] - peers["Z"]) ** 2).sum(1)
    return peers["rows"][np.argsort(dist, kind="stable")[:K_NN]]


# ---------------------------------------------------------- the rules ----
def tiers(goals, members, net, offset=0):
    """Official 2025-26 and 2026-27 levels; offset=1 outside a district."""
    return {
        "distinguished": (goals >= 5 - offset) & ((members >= 20) | (net >= 3)),
        "select": (goals >= 7 - offset) & ((members >= 20) | (net >= 5)),
        "presidents": (goals >= 9 - offset) & (members >= 20),
        "smedley": (goals >= 10 - offset) & (members >= 25),
    }


# -------------------------------------------------------- calibration ----
def _logit(p):
    p = np.clip(np.asarray(p, dtype=float), 0.005, 0.995)
    return np.log(p / (1 - p))


def calibrate(p, ab):
    """Simulated odds -> odds that match how often past forecasts came true."""
    return 1 / (1 + np.exp(-(ab[0] + ab[1] * _logit(p))))


def fit_calibration(p, y, steps=50):
    """[a, b] of calibrate() by logistic regression of outcomes on logit(p)."""
    X = np.column_stack([np.ones(len(p)), _logit(p)])
    y, w = np.asarray(y, dtype=float), np.array([0.0, 1.0])
    for _ in range(steps):
        q = 1 / (1 + np.exp(-X @ w))
        H = X.T @ (X * (q * (1 - q))[:, None]) + 1e-6 * np.eye(2)
        w = w + np.linalg.solve(H, X.T @ (y - q))
    return [round(float(v), 4) for v in w]


def tier_odds(raw, ceil, cal=None, offset=0):
    """Published odds per tier from the simulated ones: recalibrated, zero
    where the goals still reachable fall short, and never rising with the tier."""
    p, cap = {}, 1.0
    for k, need in zip(TIERS, (5, 7, 9, 10)):
        v = float(calibrate(raw[k], cal[k])) if cal and k in cal else raw[k]
        p[k] = cap = 0.0 if ceil < need - offset else round(min(v, cap), 3)
    return p


# ----------------------------------------------------------- forecast ----
def _seed(club, py):
    return int(hashlib.sha1(f"{club}{py}".encode()).hexdigest()[:8], 16)


def _draw_rows(rng, own, ages, peer):
    """N_SIMS season rows: own seasons with weight W/(W+k), else a peer's."""
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


def forecast_club(c, own, ages, peers, day, offset=0, cal=None):
    """c: current state, with "prev" (last year's goals) if known. own/ages:
    the club's season rows and how many years back each is (1 = last year).
    day: day of program year of the snapshot. cal: {tier: [a, b]} or None."""
    if str(c["status"]).startswith("Susp"):
        return {"status": "suspended"}
    rng = np.random.default_rng(_seed(c["n"], c["py"]))
    rows, p_own = _draw_rows(rng, np.asarray(own, float).reshape(-1, 8), ages, nearest(peers, c))

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

    raw = {k: float(v.mean()) for k, v in tiers(goals, members, net, offset).items()}
    # Goals 9 and 10 can be lost for good; a tier that needs more goals than are left is out.
    ceil = 10 - int(c["t1"] < 4 or (c["t2"] < 4 and day > MAY31)) \
              - int((not c["dues_oct"] and day > APR1) or (not c["officer_list"] and day > DEC31))
    p = tier_odds(raw, ceil, cal, offset) if c["csp"] else dict.fromkeys(TIERS, 0.0)
    n_own = len(own)
    return {
        "status": "active",
        "goals": {"median": _pct(goals, 50), "mean": round(float(goals.mean()), 2),
                  "p10": _pct(goals, 10), "p90": _pct(goals, 90)},
        "members": {"median": _pct(members, 50), "p10": _pct(members, 10),
                    "p90": _pct(members, 90)},
        "pTier": p,
        "pRaw": {k: round(v, 4) for k, v in raw.items()}, "ceil": ceil,
        "pGoal": [round(float(t.mean()), 3) for t in tests],
        "confidence": "high" if n_own >= 3 else "medium" if n_own else "low",
        "nSeasons": n_own, "pOwn": round(p_own, 2),
    }
