"""Clubs under 8 members on 1 October of this program year, with last year's count from whichever district held the club then.

The dashboard does not reflect the October renewals until mid-month (District
21's 2025 report still showed September's counts on 10/10 and the renewed
counts from 10/15), so a report dated 10/01 is stale. The count is read from the
10/20 report instead and shown as the 1 October count. Each district-year is
fetched once and kept in data/oct20/; a year whose 10/20 has not arrived yet is
skipped. A club with no members is
not running and is left out, as everywhere else on the site.
"""
import datetime, glob, gzip, json, os
from concurrent.futures import ThreadPoolExecutor
import common as C
import csvmap

LIMIT = 8
DAY = 20


def _url(py, district):
    stem = f"{C.BASE}/export.aspx" if py == C.current_program_year() else f"{C.BASE}/{py}/export.aspx"
    return f"{stem}?type=CSV&report=clubperformance~{district}~10/{DAY}/{py[:4]}~10/{DAY}/{py[:4]}~{py}"


def _snap(py, district):
    """{club: (members, division, area)} from the 10/20 report of a program year."""
    p = C.p("data", "oct20", py, f"{district}.json.gz")
    if os.path.exists(p):
        return {n: tuple(v) for n, v in json.load(gzip.open(p, "rt", encoding="utf-8")).items()}
    if C.today_local() < datetime.date(int(py[:4]), 10, DAY + 1):
        return {}
    text = C.get(_url(py, district))
    if text is None:
        return {}
    rows, _, _ = csvmap.read(text)
    out = {r["n"]: (r["md"], r["d"], r["a"]) for r in rows}
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with gzip.open(p, "wt", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    return out


def fetch_year(py, ids):
    """Make sure every district's report for `py` is cached.

    A club that changed district has its last-year count in the old district's
    report, so the comparison needs every district, dissolved ones included.
    """
    with ThreadPoolExecutor(4) as pool:
        list(pool.map(lambda d: _snap(py, d), ids))


_INDEX = {}


def _members_by_club(py):
    """{club: members} across every cached district report of a program year."""
    if py not in _INDEX:
        out = {}
        for p in glob.glob(C.p("data", "oct20", py, "*.json.gz")):
            for n, v in json.load(gzip.open(p, "rt", encoding="utf-8")).items():
                out[n] = v[0]
        _INDEX[py] = out
    return _INDEX[py]


def build(district, py, names):
    """The oct1 block: clubs short of LIMIT this year, with [this year, last year] counts.

    Last year's count is found by club number in whichever district held the
    club then. `names` maps club number to club name.
    """
    y = int(py[:4])
    cur = _snap(py, district)
    prev = _members_by_club(f"{y - 1}-{y}")
    clubs = []
    for n, (members, d, a) in cur.items():
        if members and members < LIMIT:
            clubs.append({"n": n, "m": names.get(n, n), "d": d, "a": a,
                          "c": [members, prev.get(n)]})
    clubs.sort(key=lambda c: (c["c"][0], c["m"]))
    return {"years": [y, y - 1], "limit": LIMIT, "clubs": clubs}
