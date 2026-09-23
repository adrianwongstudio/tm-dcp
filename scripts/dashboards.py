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


def club_performance(district, program_year):
    """(csv text, source url) for one district-year. Text is None on failure.

    A closed year is served from its own archive path; the open year is only
    served from the unprefixed one.
    """
    stem = (f"{C.BASE}/export.aspx" if program_year == C.current_program_year()
            else f"{C.BASE}/{program_year}/export.aspx")
    url = f"{stem}?type=CSV&report=clubperformance~{district}~~~{program_year}"
    return C.get(url), url
