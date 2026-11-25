"""The only thing that talks to dashboards.toastmasters.org.

Two endpoints carry this whole site: the home page, which lists the districts
grouped by region, and the club performance CSV export, which carries a
district's entire year in one file.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C

# Region headings and district links appear in document order, so a single
# pass over the two patterns together reconstructs the grouping. The <select>
# lower down the page has the same 94 ids but throws the regions away.
_TOKEN = re.compile(r"(Region\s+\d+)|District\.aspx\?id=([0-9A-Za-z]+)&hideclub")


def parse_district_index(html):
    """[{"r": "Region 01", "d": ["02", "21", ...]}] in the page's own order."""
    regions, current, seen = [], None, set()
    for region, did in _TOKEN.findall(html):
        if region:
            label = re.sub(r"\s+", " ", region).strip()
            if current is None or current["r"] != label:
                current = {"r": label, "d": []}
                regions.append(current)
        elif current is not None and did not in seen:
            seen.add(did)
            current["d"].append(did)
    return [r for r in regions if r["d"]]


def district_index():
    """The live district list. None if the home page cannot be read."""
    html = C.get(f"{C.BASE}/")
    return parse_district_index(html) if html else None


class FetchError(RuntimeError):
    """A district-year could not be fetched. Distinct from a district-year with
    no clubs, which the dashboard answers with a header-only CSV."""


def club_performance(district, program_year):
    """(csv text, source url) for one district-year.

    Raises FetchError if the dashboard never answered, so a network failure
    cannot be mistaken for a district too young to have that year.

    A closed year is served from its own archive path; the open year is only
    served from the unprefixed one.
    """
    stem = (f"{C.BASE}/export.aspx" if program_year == C.current_program_year()
            else f"{C.BASE}/{program_year}/export.aspx")
    url = f"{stem}?type=CSV&report=clubperformance~{district}~~~{program_year}"
    text = C.get(url)
    if text is None:
        raise FetchError(f"{district} {program_year}: no answer from {url}")
    return text, url


_GOAL_CELL = re.compile(r"images/[dsp]\.png' /> (\d+)")
_FIGURE = re.compile(r"(Base|Paid Clubs|Distinguished Clubs)<br /><span[^>]*>(\d+)</span>")
_UNIT = re.compile(r"Grid_Title_top[67]'>.*?\b(Division|Area) (\w+)", re.S)


def parse_division_goals(html):
    """The division and area goal tiers and actuals, as the district page shows them.

    Each division and each area is preceded by a goal row holding six numbers:
    paid goals for Distinguished, Select and President's, then the same three
    for Distinguished Clubs. Returns {"A": {"base", "paid", "dist", "goals":
    {"paid": [d, s, p], "dist": [d, s, p]}, "areas": {"01": {...}}}}.
    """
    divisions, division, goals = {}, None, None
    # Split on the row opener, not on whole rows: the Division Goals cells sit
    # after a closing tag with no row of their own.
    for row in re.split(r"<tr\b", html)[1:]:
        if "label_goals" in row:
            goals = [int(n) for n in _GOAL_CELL.findall(row)]
            continue
        unit = _UNIT.search(row)
        if unit is None or goals is None:
            continue
        kind, name = unit.groups()
        figures = {k: int(v) for k, v in _FIGURE.findall(row)}
        record = {"base": figures.get("Base"), "paid": figures.get("Paid Clubs"),
                  "dist": figures.get("Distinguished Clubs"),
                  "goals": {"paid": goals[:3], "dist": goals[3:6]}}
        goals = None
        if kind == "Division":
            division = record
            division["areas"] = {}
            divisions[name] = division
        elif division is not None:
            division["areas"][name] = record
    return divisions


def division_goals(district):
    """Division and area goals for the open year. None if the page never answered."""
    html = C.get(f"{C.BASE}/Division.aspx?id={district}")
    return parse_division_goals(html) if html else None
