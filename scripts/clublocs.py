"""The only thing that talks to the Find a Club API.

The club performance CSV that builds the rest of this board carries a club's
number, its name and its place in the district, and nothing about where it is.
Toastmasters publishes that separately, through the search behind
*Find a Club*, which answers for a whole district in one request and gives
each club a latitude and a longitude outright — so nothing here geocodes an
address, and no third-party geocoder is in the loop.

One request per district, 94 of them, run monthly. The response is a JSON
object with a `Clubs` array; everything below reads that array and nothing
else.
"""
import os, sys, json, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C

BASE = "https://www.toastmasters.org"

# The search is built for a map, so it wants a point to measure from. Any
# point will do when a district is named: `advanced=1` makes the district the
# filter and the distance from 1°N 1°E is simply carried on each row, where
# this script ignores it.
SEARCH = (BASE + "/api/sitecore/FindAClub/Search"
          "?advanced=1&latitude=1&longitude=1&district={district}")


def search_url(district):
    return SEARCH.format(district=district)


def fetch(district, timeout=60, attempts=3):
    """(payload, url) for one district. Payload is None if it never lands.

    `common.get` is pointed at the dashboard host and returns text; this is a
    different host answering JSON, so the request is made here and decoded
    here. The retry is the same shape, because the failure is the same one:
    an occasional refusal under a burst of 94.
    """
    url = search_url(district)
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers={
                **C.UA, "Accept": "application/json"})
            raw = urllib.request.urlopen(req, timeout=timeout).read()
            return json.loads(raw.decode("utf-8", "replace")), url
        except Exception:
            if attempt == attempts - 1:
                return None, url
            time.sleep(2.0 * (attempt + 1))


# ------------------------------------------------------------- reading ----
def _dig(node, *path):
    """A value several keys down, or None if any step is missing or not a map."""
    for key in path:
        if not isinstance(node, dict):
            return None
        node = node.get(key)
    return node


def _text(value):
    """A trimmed string, or "" — the API uses null and whitespace alike."""
    return str(value).strip() if value not in (None, "") else ""


def _coord(value):
    """A finite number, or None. The API sends numbers, but not always."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    # 0,0 is the Atlantic. It is what an unset pair looks like, never a club.
    return number if -180.0 <= number <= 180.0 else None


def club_number(club):
    """The eight-digit number the rest of the board keys clubs by.

    `DisplayFriendlyFormat` is the one already padded; `Value` is the same
    number without its leading zeros, so it is the fallback and is padded
    here rather than left to disagree with `data.json`.
    """
    ident = _dig(club, "Identification", "Id") or {}
    friendly = _text(ident.get("DisplayFriendlyFormat"))
    if friendly:
        return friendly
    raw = _text(ident.get("Value"))
    return raw.zfill(8) if raw.isdigit() else raw


def _classification(club, key):
    """Division "B", area "10" — the Name, falling back to the Id."""
    node = _dig(club, "Classification", key) or {}
    return _text(node.get("Name")) or _text(node.get("Id"))


def _address_line(address):
    """Street, city, region, postal code — whatever of it the club filled in.

    An online-only club often has a city and nothing else, and a club that
    meets in a member's back room sometimes has only a postal code. Joining
    what is there beats printing a line of commas around the gaps.
    """
    region = _text(_dig(address, "PrimaryRegion", "Name"))
    parts = [
        _text(address.get("Street")),
        _text(address.get("AdditionalLines")),
        _text(address.get("City")),
        " ".join(p for p in (region, _text(address.get("PostalCode"))) if p),
    ]
    return ", ".join(p for p in parts if p)


def read_club(club):
    """One API row -> the record geo.json carries, or None if it has no place.

    A club with no usable coordinates is dropped rather than parked at 0,0:
    the map's job is to say where a club is, and a pin in the Gulf of Guinea
    says something false rather than nothing.
    """
    if not isinstance(club, dict):
        return None
    if club.get("IsProspective"):
        return None

    number = club_number(club)
    if not number:
        return None

    address = _dig(club, "Address") or {}
    lat = _coord(_dig(address, "Coordinates", "Latitude"))
    lng = _coord(_dig(address, "Coordinates", "Longitude"))
    if lat is None or lng is None or (lat == 0.0 and lng == 0.0):
        return None

    record = {
        "n": number,
        "m": _text(_dig(club, "Identification", "Name")),
        "d": _classification(club, "Division"),
        "a": _classification(club, "Area"),
        # Five decimal places is about a metre. The API sends more, and the
        # extra digits are 94 files' worth of noise.
        "lat": round(lat, 5),
        "lng": round(lng, 5),
    }

    # Everything past here is optional, and left out when empty rather than
    # written as "", so a club that published nothing costs nothing.
    line = _address_line(address)
    city = _text(address.get("City"))
    country = _text(club.get("CountryName"))
    day = _text(club.get("MeetingDay"))
    when = _text(club.get("MeetingTime"))
    site = _text(club.get("Website"))

    if line:
        record["ad"] = line
    if city:
        record["c"] = city
    if country:
        record["co"] = country
    if day:
        record["day"] = day
    if when:
        record["t"] = when
    if site:
        record["w"] = site
    # Written only when true, and read as a flag: most clubs are not online,
    # and `"v": 1` on the few that are is smaller than `"v": false` on the rest.
    if club.get("AllowsVirtualAttendance") is True:
        record["v"] = 1

    return record


def parse_clubs(payload):
    """The `Clubs` array -> records, de-duplicated by club number, sorted.

    A district occasionally answers with the same club twice. The board keys
    everything by club number, so a repeat would be a second pin on top of
    the first; the first row wins and the rest are dropped.
    """
    if isinstance(payload, dict):
        rows = payload.get("Clubs")
    elif isinstance(payload, list):
        rows = payload
    else:
        rows = None
    if not isinstance(rows, list):
        return None

    out, seen = [], set()
    for row in rows:
        record = read_club(row)
        if record and record["n"] not in seen:
            seen.add(record["n"])
            out.append(record)
    out.sort(key=lambda r: r["n"])
    return out


def district_locations(district):
    """(records, url) for one district. Records is None if the fetch failed.

    An empty list is a real answer — a district whose clubs have all gone
    online publishes no coordinates — and is not the same as None.
    """
    payload, url = fetch(district)
    if payload is None:
        return None, url
    return parse_clubs(payload), url


__all__ = ["BASE", "SEARCH", "search_url", "fetch", "club_number",
           "read_club", "parse_clubs", "district_locations"]
