"""Rule and determinism tests for forecast.py. Run directly: no pytest."""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import forecast as F

PEER_END = {"base": 22, "l1": 4, "l2": 4, "l3": 2, "l4": 2, "new": 8, "members": 24, "t1": 4, "t2": 4, "dues": 2}
PEER_SNAP = {"base": 22, "l1": 1, "l2": 0, "l3": 0, "l4": 0, "new": 2, "members": 22, "t1": 4, "t2": 0, "dues": 1}
PEERS = F.peer_pool([{"snap": PEER_SNAP, "end": PEER_END}])


def club(**kw):
    c = {"n": "00000001", "py": "2026-2027", "status": "Active", "csp": True,
         "l1": 1, "l2": 0, "l3": 0, "l4": 0, "new": 2, "members": 22, "base": 22,
         "t1": 4, "t2": 0, "dues_oct": True, "officer_list": True}
    c.update(kw)
    return c


def run(c, **kw):
    return F.forecast_club(c, kw.get("own", []), kw.get("ages", []), PEERS, kw.get("day", 133))


def test_tiers():
    g, m, n = (np.array([x]) for x in (5, 19, 3))
    assert F.tiers(g, m, n)["distinguished"][0]          # net +3 rescues 19 members
    assert not F.tiers(g, m, np.array([2]))["distinguished"][0]
    assert not F.tiers(np.array([7]), m, np.array([4]))["select"][0]   # select needs +5
    assert not F.tiers(np.array([9]), m, np.array([9]))["presidents"][0]  # needs 20 members
    assert not F.tiers(np.array([10]), np.array([24]), n)["smedley"][0]
    assert F.tiers(np.array([4]), m, n, offset=1)["distinguished"][0]   # undistricted


def test_peer_replay_hits_all_goals():
    r = run(club())
    assert r["goals"]["median"] == 10 and r["pTier"]["smedley"] == 0.0  # 24 members < 25
    assert r["pTier"]["presidents"] == 1.0 and r["confidence"] == "low"


def test_locks():
    assert run(club(t1=3))["pGoal"][8] == 0.0                          # round 1 missed
    assert run(club(), day=340)["pGoal"][8] == 0.0                     # round 2 reporting shut
    assert run(club(dues_oct=False), day=300)["pGoal"][9] == 0.0       # April passed
    assert run(club(dues_oct=False), day=133)["pGoal"][9] == 1.0       # April still ahead
    assert run(club(csp=False))["pTier"]["distinguished"] == 0.0       # CSP gate
    assert run(club(status="Susp 09/30/26")) == {"status": "suspended"}


def test_deterministic_and_monotone():
    own = [[1, 1, 0, 0, 1, -2, 1, 1]] * 3
    a, b = run(club(), own=own, ages=[1, 2, 3]), run(club(), own=own, ages=[1, 2, 3])
    assert a == b and a["confidence"] == "high" and a["nSeasons"] == 3
    p = a["pTier"]
    assert p["distinguished"] >= p["select"] >= p["presidents"] >= p["smedley"]


def test_synthetic_nan_borrowed_from_peer():
    row = F.synth_row({**PEER_END}, {k: 0.3 for k in F.COUNTS})
    assert row[:5] == [3, 3, 1, 1, 6]
    assert np.isnan(row[5:]).all()
    r = run(club(), own=[row], ages=[1])
    assert r["members"]["median"] == 24                                # peer's +2


def test_snapshot_between_reports():
    snaps = [[133, 1, 0, 0, 0, 2, 20, 20, 4, 0, 1, 1], [163, 3, 0, 0, 0, 4, 22, 20, 4, 0, 1, 1],
             [375, 4, 2, 0, 0, 8, 24, 20, 4, 4, 2, 1]]
    mid = F.snapshot_at(snaps, 148)
    assert mid["l1"] == 2 and mid["new"] == 3 and mid["members"] == 21        # halfway
    assert F.snapshot_at(snaps, 133)["l1"] == 1 and F.snapshot_at(snaps, 400)["l1"] == 4
    assert F.snapshot_at(snaps, 60) is None                                   # nothing stored that early
    end = F.state(snaps[-1][1:])
    assert F.season_row(mid, end) == [2, 2, 0, 0, 5, 3, 1.0, 1.0]
    assert F.season_row(end, end) == [0, 0, 0, 0, 0, 0, 1.0, 0.0]             # nothing left to replay


def test_share_in_runs_zero_to_one():
    curve = {"days": [133, 253], **{k: [0.3, 0.6] for k in F.COUNTS}}
    assert F.share_in(curve, 0)["l1"] == 0.0 and F.share_in(curve, F.YEAR_END)["l1"] == 1.0
    assert abs(F.share_in(curve, 193)["l1"] - 0.45) < 1e-9


def test_peers_are_the_seasons_that_stood_closest():
    far = {**PEER_SNAP, "members": 8, "base": 12, "t1": 0, "dues": 0}
    stalled = {**far, "l1": 0, "new": 0}
    pool = F.peer_pool([{"snap": PEER_SNAP, "end": PEER_END, "prev": 9}] * 3
                       + [{"snap": far, "end": stalled, "prev": 1}] * 60)
    near = F.nearest(pool, club(prev=9))
    assert len(near) == F.K_NN and (near[:3, 0] == 3).all() and (near[3:, 0] == 0).all()
    assert (F.nearest(pool, club()) == near).all()                            # unknown last year: still matched


def test_calibration_and_ceiling():
    y = np.array([0, 0, 1, 0, 1, 1, 0, 1] * 50); p = np.where(y == 1, 0.4, 0.1)
    ab = F.fit_calibration(p, y)
    assert abs(F.calibrate(0.4, ab) - 1.0) < 0.05 and F.calibrate(0.1, ab) < 0.05   # 40% always happened
    raw = {"distinguished": 0.5, "select": 0.3, "presidents": 0.2, "smedley": 0.1}
    cal = {"distinguished": [0.0, 1.0], "select": [3.0, 1.0], "presidents": [0.0, 1.0], "smedley": [0.0, 1.0]}
    p = F.tier_odds(raw, 10, cal)
    assert p["distinguished"] == 0.5 and p["select"] == 0.5                   # never above the tier below
    assert F.tier_odds(raw, 8, cal)["presidents"] == 0.0 and F.tier_odds(raw, 8, cal)["select"] > 0
    r = F.forecast_club(club(t1=3, dues_oct=False), [], [], PEERS, 300, cal=cal)
    assert r["ceil"] == 8 and r["pTier"]["presidents"] == 0.0 and r["pTier"]["distinguished"] > 0
    assert F.forecast_club(club(csp=False), [], [], PEERS, 133, cal=cal)["pTier"]["distinguished"] == 0.0


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
