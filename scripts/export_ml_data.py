"""Export every club's DCP data to one Excel workbook for model development.

Sheets:
  club_weeks    weekly snapshots (data/snapshots): 12 rows, 10 goals, members
  club_years    finished program years, all districts (docs/d/*/data.json)
  months_<py>   month-end reports, all districts, one sheet per program year
                (data/monthly, from build_monthly.py)
  d21_seasons   District 21's real Nov snapshot vs year-end (data/seasons.json)

Run: uv run scripts/export_ml_data.py
"""
import glob, gzip, json, os, re
from openpyxl import Workbook

import common as C
from dcp import TARGETS, GOAL_ROWS, ROW_NAMES

OUT = C.p("data", "ml", "dcp_club_data.xlsx")
ROWS = [f"r{i + 1}" for i in range(12)]
GOALS = [f"g{i + 1}" for i in range(10)]


def goals(v):
    """Ten 0/1 goal flags from the twelve row values."""
    met = [v[i] is not None and v[i] >= TARGETS[i] for i in range(12)]
    return [int(all(met[i] for i in rows)) for rows in GOAL_ROWS]


def club_weeks(ws):
    ws.append(["py", "district", "snapshot_date", "club"] + ROWS + GOALS
              + ["goals_met", "member_base", "members", "csp", "status"])
    for path in sorted(glob.glob(C.p("data", "snapshots", "*", "*", "*.json.gz"))):
        parts = path.split(os.sep)
        py, did, date = parts[-3], parts[-2], parts[-1][:10]
        for n, v, mb, md, csp, status in json.load(gzip.open(path, "rt", encoding="utf-8")):
            g = goals(v)
            ws.append([py, did, date, n] + v + g + [sum(g), mb, md, csp, status])


def club_months(ws, py):
    ws.append(["py", "district", "month", "club", "division", "area"] + ROWS + GOALS
              + ["goals_met", "member_base", "members", "csp", "status"])
    for path in sorted(glob.glob(C.p("data", "monthly", py, "*.json.gz"))):
        did = os.path.basename(path)[:-len(".json.gz")]
        doc = json.load(gzip.open(path, "rt", encoding="utf-8"))
        for month, clubs in sorted(doc.items()):
            for n, v, mb, md, csp, status, div, area, met in clubs:
                g = goals(v)
                ws.append([py, did, month, n, div, area] + v + g + [met, mb, md, csp, status])


def club_years(ws):
    ws.append(["py", "district", "club", "name", "division", "area"] + ROWS + GOALS
              + ["goals_met", "member_base", "members", "csp", "status"])
    for path in sorted(glob.glob(C.p("docs", "d", "*", "data.json"))):
        did = path.split(os.sep)[-2]
        for c in json.load(open(path, encoding="utf-8"))["clubs"]:
            for py, y in sorted(c["y"].items()):
                g = goals(y["g"])
                ws.append([py, did, c["n"], c["m"], y["d"], y["a"]] + y["g"] + g
                          + [y["f"], y["mb"], y["md"], y["csp"], y["st"]])


def d21_seasons(ws):
    snap_keys = ["l1", "l2", "l3", "l4", "new", "members", "base", "t1", "t2", "dues"]
    ws.append(["py", "club"] + [f"nov_{k}" for k in snap_keys] + [f"end_{k}" for k in snap_keys])
    for s in json.load(open(C.p("data", "seasons.json"), encoding="utf-8"))["seasons"]:
        ws.append([s["py"], s["n"]] + [s["snap"][k] for k in snap_keys] + [s["end"][k] for k in snap_keys])


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    wb = Workbook(write_only=True)
    sheets = [("club_weeks", club_weeks), ("club_years", club_years), ("d21_seasons", d21_seasons)]
    for d in sorted(glob.glob(C.p("data", "monthly", "*"))):
        py = os.path.basename(d)
        sheets.append((f"months_{py}", lambda ws, py=py: club_months(ws, py)))
    for name, fn in sheets:
        ws = wb.create_sheet(name)
        fn(ws)
    wb.save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
