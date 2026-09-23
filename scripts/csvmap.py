"""Read a club performance CSV into the shape the site's JSON wants.

The column headings drift between program years — "Level 2s" became "Level 2s
or EOM", "Level 4s, Level 5s, or DTM award" became "Level 4s, Path
Completions, or DTM Awards" — and closed years drop CSP and Net Growth
altogether. Matching by position would line up for most columns and be
silently wrong for the rest, so every column is matched by a normalised
heading and anything unmatched comes back None.
"""
import csv, io, re


def _key(s):
    """Fold a heading to something stable across years: lowercase alphanumerics."""
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


# The twelve report rows, in the order the DCP prints them.
#
# Each row is a list of COLUMNS, and each column a list of the headings that
# column has been published under. A row's value is the sum of its columns —
# which matters for exactly one row: the club report prints a single "Renewal
# dues on time" row, and the export splits it into the October and April
# rounds. Summing them reproduces the report (verified against 109 clubs of
# District 21's 2023-2024, including the 26 where the two rounds differ).
GOAL_HEADINGS = [
    [["level1s"]],
    [["level2s", "level2soreom"]],
    [["addlevel2s", "addlevel2soreom"]],
    [["level3s"]],
    [["level4slevel5sordtmaward", "level4spathcompletionsordtmawards"]],
    [["addlevel4slevel5sordtmaward", "addlevel4spathcompletionsordtmaward"]],
    [["newmembers"]],
    [["addnewmembers"]],
    [["offtrainedround1"]],
    [["offtrainedround2"]],
    [["memduesontimeoct"], ["memduesontimeapr"]],
    [["offlistontime"]],
]

META = {
    "n":  ["clubnumber"],
    "m":  ["clubname"],
    "d":  ["division"],
    "a":  ["area"],
    "status": ["clubstatus"],
    "met": ["goalsmet"],
    "mb": ["membase"],
    "md": ["activemembers"],
    "ng": ["netgrowth"],
    "csp": ["csp"],
    "st": ["clubdistinguishedstatus"],
}

# The export prints a one-letter recognition code; the page prints the label.
STATUS = {"D": "Distinguished", "S": "Select Distinguished",
          "P": "President's Distinguished", "H": "Smedley Distinguished"}

ASOF = re.compile(r"As of (\d{1,2})/(\d{1,2})/(\d{4})")
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _int(v):
    try:
        return int(str(v).strip())
    except Exception:
        return None


def _asof(text):
    """'Month of Sep, As of 09/22/2026' -> '22-Sep-2026', the site's format."""
    m = ASOF.search(text)
    if not m:
        return ""
    mo, day, yr = int(m.group(1)), int(m.group(2)), m.group(3)
    return f"{day:02d}-{MONTHS[mo - 1]}-{yr}"


def read(text):
    """(rows, asof). Rows carry only what the site uses, already typed."""
    if not text:
        return [], ""
    reader = csv.reader(io.StringIO(text.lstrip("﻿")))
    try:
        header = next(reader)
    except StopIteration:
        return [], ""
    idx = {_key(h): i for i, h in enumerate(header)}

    def col(names):
        for n in names:
            if n in idx:
                return idx[n]
        return None

    meta_at = {k: col(v) for k, v in META.items()}
    goals_at = [[col(alts) for alts in spec] for spec in GOAL_HEADINGS]

    def at(row, i):
        return row[i].strip() if i is not None and i < len(row) else ""

    def goal(row, cols):
        """A report row: the sum of the export columns that make it up.

        None only when no column matched at all — a row that matched and read
        blank is a zero, not a gap, and must not be confused with one.
        """
        vals = [_int(at(row, i)) for i in cols if i is not None]
        return sum(v or 0 for v in vals) if vals else None

    rows = []
    for row in reader:
        num = at(row, meta_at["n"])
        if not num.isdigit():
            continue                      # the trailing "As of" line, and blanks
        code = at(row, meta_at["st"]).upper()
        rows.append({
            "n": num.zfill(8),
            "m": at(row, meta_at["m"]) or f"Club {num}",
            "d": at(row, meta_at["d"]),
            "a": at(row, meta_at["a"]),
            "status": at(row, meta_at["status"]),
            "goals": [goal(row, cols) for cols in goals_at],
            "met": _int(at(row, meta_at["met"])),
            "mb": _int(at(row, meta_at["mb"])),
            "md": _int(at(row, meta_at["md"])),
            "ng": _int(at(row, meta_at["ng"])),
            "csp": at(row, meta_at["csp"]).upper()[:1],
            "st": STATUS.get(code, ""),
        })
    return rows, _asof(text)
