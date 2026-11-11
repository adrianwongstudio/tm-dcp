"""Rule and determinism tests for forecast.py. Run directly: no pytest."""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import forecast as F

PEER_END = {"base": 22, "l1": 4, "l2": 4, "l3": 2, "l4": 2, "new": 8, "members": 24, "t2": 4, "dues": 2}
PEER_SNAP = {"base": 22, "l1": 1, "l2": 0, "l3": 0, "l4": 0, "new": 2, "members": 22, "t2": 0, "dues": 1}
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
    assert np.isnan(row[5:]).all()
    r = run(club(), own=[row], ages=[1])
    assert r["members"]["median"] == 24                                # peer's +2


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
