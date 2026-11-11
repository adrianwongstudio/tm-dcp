"""Back-test the forecast on District 21's real Nov-to-Jun seasons.

For each test year the club's own history and the peer pool hold only earlier
years, so nothing leaks. Truth is the district's published year-end result.
Prints MAE of median goals against last year's score, P10-P90 coverage, and the
Brier score of P(Distinguished) against the plain base rate.
"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import forecast as F

SEASONS = json.load(open(C.p("data", "seasons.json"), encoding="utf-8"))["seasons"]
HIST = {c["n"]: c["y"] for c in json.load(open(C.p("docs", "d", "21", "data.json"), encoding="utf-8"))["clubs"]}


def state(s, y):
    sn = s["snap"]
    return {"n": s["n"], "py": s["py"], "status": "", "csp": True, **{k: sn[k] for k in F.COUNTS},
            "members": sn["members"], "base": y["mb"] or sn["members"], "t1": sn["t1"],
            "t2": sn["t2"], "dues_oct": sn["dues"] >= 1, "officer_list": True}


def run(test_py):
    year = int(test_py[:4])
    earlier = [s for s in SEASONS if int(s["py"][:4]) < year]
    peers = F.peer_pool(earlier)
    out = []
    for s in (x for x in SEASONS if x["py"] == test_py):
        y = HIST.get(s["n"], {}).get(test_py)
        prev = HIST.get(s["n"], {}).get(f"{year - 1}-{year}")
        if not y or y["f"] is None or not prev or prev["f"] is None:
            continue
        mine = [x for x in earlier if x["n"] == s["n"]]
        rows = [F.season_row(x["snap"], x["end"]) for x in mine]
        ages = [year - int(x["py"][:4]) for x in mine]
        f = F.forecast_club(state(s, y), rows, ages, peers, 133)
        out.append((f, y["f"], prev["f"], int(bool(y["st"]))))
    return out


def report(test_py):
    r = run(test_py)
    med = np.array([f["goals"]["median"] for f, *_ in r]); act = np.array([a for _, a, _, _ in r])
    last = np.array([p for _, _, p, _ in r])
    lo = np.array([f["goals"]["p10"] for f, *_ in r]); hi = np.array([f["goals"]["p90"] for f, *_ in r])
    p = np.array([f["pTier"]["distinguished"] for f, *_ in r]); d = np.array([x for *_, x in r])
    brier, base = ((p - d) ** 2).mean(), ((d.mean() - d) ** 2).mean()
    print(f"{test_py}  n={len(r):3d}  MAE model {abs(med - act).mean():.2f} vs last-year {abs(last - act).mean():.2f}"
          f"  coverage {((act >= lo) & (act <= hi)).mean():.0%}"
          f"  Brier skill {1 - brier / base:+.2f}  sumP {p.sum():.0f} vs actual {d.sum()}")


if __name__ == "__main__":
    for py in ("2022-2023", "2023-2024", "2024-2025", "2025-2026"):
        report(py)
