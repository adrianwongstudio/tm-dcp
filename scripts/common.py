"""Shared ground for every script in this repo.

Anything that more than one script needs to agree on lives here: where the
repo is, which years we are reporting, and how to talk to the dashboard.

Nothing here knows about a particular district. A district is an argument,
never a setting — that is the whole difference between this repo and the
single-district one it grew out of.
"""
import os, json, time, calendar, datetime, urllib.request
try:
    from zoneinfo import ZoneInfo
except ImportError:                     # pragma: no cover - Python < 3.9
    ZoneInfo = None

# ---------------------------------------------------------------- paths ----
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def p(*parts):
    """A path relative to the repo root, so scripts run from any directory."""
    return os.path.join(ROOT, *parts)


# --------------------------------------------------------------- config ----
with open(p("config.json"), encoding="utf-8") as fh:
    CONFIG = json.load(fh)

SITE = CONFIG.get("site", {})
OUTPUT = CONFIG.get("output", {})

TIMEZONE = CONFIG.get("timezone") or "UTC"


def tz():
    """The board's own timezone, so timestamps read local to its author."""
    if ZoneInfo is None:
        return None
    try:
        return ZoneInfo(TIMEZONE)
    except Exception:
        return None


def now_local():
    """Timezone-aware now."""
    return datetime.datetime.now(tz() or datetime.timezone.utc)


def today_local():
    return now_local().date()


def stamp(fmt="%Y-%m-%d %H:%M %Z"):
    """A build timestamp a reader will recognise."""
    return now_local().strftime(fmt).strip()


# ---------------------------------------------------------------- years ----
def program_years(today=None):
    """Finished program years, oldest first. The open year is not among them."""
    h = CONFIG["history"]
    start = int(h["start_year"])
    return [f"{y}-{y+1}" for y in range(start, start + int(h["years"]))]


def season_start(today=None):
    """The calendar year a program year begins in. July starts a new one."""
    today = today or today_local()
    return today.year if today.month >= 7 else today.year - 1


def current_program_year(today=None):
    s = season_start(today)
    return f"{s}-{s+1}"


def months_of(program_year):
    """(month, calendar_year) for a program year, July through June."""
    start = int(str(program_year)[:4])
    return [(m, start) for m in range(7, 13)] + [(m, start + 1) for m in range(1, 7)]


def last_day(month, year):
    """The dashboard wants M/D/YYYY, using the last day of the month."""
    return f"{month}/{calendar.monthrange(year, month)[1]}/{year}"


def district_name(did):
    """The dashboard publishes no district names, only numbers."""
    return f"District {did}"


# ------------------------------------------------------------- dashboard ----
BASE = "https://dashboards.toastmasters.org"
UA = {"User-Agent": "Mozilla/5.0 (Toastmasters DCP board)"}


def get(url, timeout=45, attempts=3):
    """Fetch a URL as text, retrying briefly. None if it never lands."""
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers=UA)
            return urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "replace")
        except Exception:
            if attempt == attempts - 1:
                return None
            time.sleep(1.5 * (attempt + 1))


__all__ = [
    "ROOT", "p", "CONFIG", "SITE", "OUTPUT", "TIMEZONE", "tz", "now_local",
    "today_local", "stamp", "program_years", "season_start",
    "current_program_year", "months_of", "last_day", "district_name",
    "BASE", "UA", "get",
]
