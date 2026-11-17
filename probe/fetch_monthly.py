"""One-off: month-end club reports for a few districts' finished years -> probe/<district>.csv.

Same columns as d21-dcp's output/monthly_data.csv, so build_seasons.from_monthly
and the back-test read it unchanged. Clubs and years come from docs/d/<id>/data.json.

    python probe/fetch_monthly.py 10,2 02 71 80 70     # October and February reports
"""
import csv, json, os, sys, time, calendar, queue, threading, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse as P

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://dashboards.toastmasters.org"
UA = {"User-Agent": "Mozilla/5.0 (tm-dcp forecast back-test)"}
COLS = ["Level 1 awards", "Level 2 awards", "More Level 2 awards", "Level 3 awards",
        "Level 4, Path Completion, or DTM award", "One more Level 4, Path Completion, or DTM award",
        "New members", "More new members", "Club officer roles trained June-August",
        "Club officer roles trained November-February", "Membership-renewal dues on time",
        "Club officer list on time"]
MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
THREADS = 6


def get(url):
    for a in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode("utf-8", "replace")
        except Exception:
            time.sleep(2 * (a + 1))
    return None


def job(n, py, month):
    year = int(py[:4]) + (month < 7)
    day = f"{month}/{calendar.monthrange(year, month)[1]}/{year}"
    page = get(f"{BASE}/{py}/ClubReport.aspx?id={n}&month={month}&day={day}")
    if page is None:
        return None, "fail"
    d = P.parse(page)
    if d.get("goals_met") is None and not d.get("goals"):
        return None, "empty"
    todate = [(d["goals"][i]["todate"] if i < len(d["goals"]) else "") for i in range(12)]
    return {"Club No": n, "Program Year": py, "Month": f"{MON[month]} {year}", "As Of": d.get("asof") or "",
            "DCP Status": d.get("status") or "", "Club Success Plan": d.get("csp", ""),
            "Membership Base": d.get("mem_base"), "Membership To Date": d.get("members"),
            "DCP Goals Met": d.get("goals_met"), **dict(zip(COLS, todate))}, "ok"


def main(months, dids):
    os.makedirs(os.path.join(ROOT, "probe"), exist_ok=True)
    for did in dids:
        hist = json.load(open(os.path.join(ROOT, "docs", "d", did, "data.json"), encoding="utf-8"))["clubs"]
        work = queue.Queue()
        for c in hist:
            for py, v in c["y"].items():
                if v.get("f") is not None:
                    for m in months:
                        work.put((c["n"], py, m))
        total, rows, tally, lock = work.qsize(), [], {}, threading.Lock()

        def worker():
            while True:
                try:
                    j = work.get_nowait()
                except queue.Empty:
                    return
                r, why = job(*j)
                with lock:
                    tally[why] = tally.get(why, 0) + 1
                    if r:
                        rows.append(r)

        t0 = time.time()
        ts = [threading.Thread(target=worker, daemon=True) for _ in range(THREADS)]
        [t.start() for t in ts]; [t.join() for t in ts]
        rows.sort(key=lambda r: (r["Club No"], r["Program Year"], r["Month"]))
        with open(os.path.join(ROOT, "probe", f"{did}.csv"), "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0]) if rows else ["Club No"]); w.writeheader(); w.writerows(rows)
        print(f"District {did}: {total} pages, {tally}, {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main([int(x) for x in sys.argv[1].split(",")], sys.argv[2:])
