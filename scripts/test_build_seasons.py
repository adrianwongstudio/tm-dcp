"""build_seasons.py against a tiny made-up archive. Run directly: no pytest."""
import os, sys, json, gzip, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import forecast as F
import build_seasons as S

V = [1, 0, 0, 0, 0, 0, 2, 0, 4, 0, 1, 1]
END = [4, 2, 1, 2, 1, 0, 4, 3, 4, 5, 2, 1]


def test_archive_becomes_seasons_once_the_year_is_finished():
    with tempfile.TemporaryDirectory() as root:
        real, C.p = C.p, lambda *parts: os.path.join(root, *parts)
        try:
            for py, did in (("2026-2027", "21"), ("2027-2028", "21")):
                os.makedirs(C.p("data", "snapshots", py, did))
                for date in ("-11-09", "-11-16", "-12-07"):
                    path = C.p("data", "snapshots", py, did, py[:4] + date + ".json.gz")
                    with gzip.open(path, "wt", encoding="utf-8") as fh:
                        json.dump([["00000001", V, 20, 21, "Y", ""], ["00000002", V, 20, 21, "N", ""]], fh)
            os.makedirs(C.p("docs", "d", "21"))
            done = {"f": 7, "md": 24, "mb": 20, "g": END, "csp": "Y"}
            json.dump({"clubs": [{"n": "00000001", "y": {"2026-2027": done}},
                                 {"n": "00000002", "y": {"2026-2027": {**done, "f": None}}}]},
                      open(C.p("docs", "d", "21", "data.json"), "w"))
            got = S.from_archive(set())
            assert [(s["n"], s["py"]) for s in got] == [("00000001", "2026-2027")]   # open year, unfinished club: no
            s = got[0]
            assert [x[0] for x in s["s"]] == [132, 160, F.YEAR_END]                  # a week apart is thinned out
            assert s["g"] == 7 and s["csp"] is True
            end = F.state(s["s"][-1][1:])
            assert end["l2"] == 3 and end["l4"] == 1 and end["new"] == 7 and end["members"] == 24
            assert F.season_row(F.snapshot_at(s["s"], 132), end) == [3, 3, 2, 1, 5, 3, 1.0, 1.0]
            assert S.from_archive({("00000001", "2026-2027")}) == []                  # already held
            assert S.curve(got)["l1"][3] == 0.25                                     # 1 of 4 in by the October report
        finally:
            C.p = real


def test_monthly_rows():
    src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "seasons.json")
    doc = json.load(open(src, encoding="utf-8"))
    assert doc["v"] == 2 and len(doc["seasons"]) > 900
    for s in doc["seasons"]:
        days = [x[0] for x in s["s"]]
        assert days == sorted(days) and days[-1] == F.YEAR_END and all(len(x) == 1 + len(F.FIELDS) for x in s["s"])


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
