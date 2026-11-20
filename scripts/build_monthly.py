"""Archive every club's month-end DCP report, for every district, five years back.

The dashboard serves a stored report per month-end when asked with that date:

    .../export.aspx?type=CSV&report=clubperformance~{district}~{MM/DD/YYYY}~{MM/DD/YYYY}~{py}

Writes data/monthly/<py>/<district>.json.gz as {"YYYY-MM": [[club, [12 rows],
member_base, members, csp, status, division, area, goals_met], ...]}. Resumable: a month
already stored is not fetched again. A month is only fetched once it has been
over for MIN_AGE_DAYS, so the report has been published.

    uv run scripts/build_monthly.py                  # all districts, all months
    uv run scripts/build_monthly.py --only 21 --years 2025-2026
"""
import argparse, calendar, datetime, gzip, json, os, queue, sys, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import csvmap
from build_all import districts_from_index

THREADS = 4
MIN_AGE_DAYS = 3


def month_ends(py, today):
    """Month-end dates of a program year that are old enough to be published."""
    out = []
    for m, y in C.months_of(py):
        end = datetime.date(y, m, calendar.monthrange(y, m)[1])
        if (today - end).days >= MIN_AGE_DAYS:
            out.append(end)
    return out


def url(district, py, end):
    stem = (f"{C.BASE}/export.aspx" if py == C.current_program_year()
            else f"{C.BASE}/{py}/export.aspx")
    d = end.strftime("%m/%d/%Y")
    return f"{stem}?type=CSV&report=clubperformance~{district}~{d}~{d}~{py}"


def slim(rows):
    return [[r["n"], r["goals"], r["mb"], r["md"], r["csp"], r["st"], r["d"], r["a"], r["met"]] for r in rows]


def path(py, district):
    return C.p("data", "monthly", py, f"{district}.json.gz")


def load(py, district):
    p = path(py, district)
    return json.load(gzip.open(p, "rt", encoding="utf-8")) if os.path.exists(p) else {}


def save(py, district, doc):
    p = path(py, district)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with gzip.open(p, "wt", encoding="utf-8") as fh:
        json.dump(doc, fh, separators=(",", ":"), sort_keys=True)


def build(district, py, today):
    """Fetch the months of one district-year not yet stored. Returns (new, failed)."""
    doc = load(py, district)
    new = failed = 0
    for end in month_ends(py, today):
        key = end.strftime("%Y-%m")
        if key in doc:
            continue
        text = C.get(url(district, py, end))
        if text is None:
            failed += 1
            continue
        rows, _, _ = csvmap.read(text)
        doc[key] = slim(rows)
        new += 1
    if new:
        save(py, district, doc)
    return new, failed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="district ids")
    ap.add_argument("--years", nargs="*", help="program years, e.g. 2025-2026")
    args = ap.parse_args()

    _, ids = districts_from_index()
    years = args.years or C.program_years() + [C.current_program_year()]
    work = queue.Queue()
    for d in args.only or ids:
        for py in years:
            work.put((d, py))
    today, lock, tally = C.today_local(), threading.Lock(), {"new": 0, "failed": 0}

    def worker():
        while True:
            try:
                d, py = work.get_nowait()
            except queue.Empty:
                return
            new, failed = build(d, py, today)
            with lock:
                tally["new"] += new
                tally["failed"] += failed
                if new or failed:
                    print(f"  {d:>3} {py}: {new} months stored, {failed} failed", flush=True)

    threads = [threading.Thread(target=worker) for _ in range(THREADS)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    print(f"stored {tally['new']} district-months, {tally['failed']} failed")
    if tally["failed"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
