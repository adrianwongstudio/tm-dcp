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
UPDATES = CONFIG.get("updates", {})
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


# -------------------------------------------------------------- updates ----
# The schedule the refresh workflow actually keeps, said once so the page can
# repeat it. It is a weekly instant, not a date: readers are spread across the
# world, and 16:00 UTC Sunday is Monday morning in Sydney. The build resolves
# it to a UTC instant and the page turns that into the reader's own day and
# clock, so neither end has to reason about the other's offset.
WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
            "Saturday", "Sunday")


def _schedule_zone():
    """The timezone the schedule is written in — the workflow's cron, so UTC."""
    name = UPDATES.get("timezone") or "UTC"
    if ZoneInfo is not None:
        try:
            return ZoneInfo(name)
        except Exception:
            pass
    return datetime.timezone.utc


def _schedule_time():
    """(hour, minute) the refresh runs at. Midnight if it is not named."""
    raw = str(UPDATES.get("time") or "00:00")
    try:
        hh, _, mm = raw.partition(":")
        return int(hh), int(mm or 0)
    except ValueError:
        return 0, 0


def _as_utc(moment):
    return moment.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _named_instant(text, zone):
    """A date or datetime the owner wrote, read in the schedule's own zone.

    A bare date means the usual time on that day — "we are back on the 5th"
    rather than "we are back at midnight on the 5th".
    """
    try:
        moment = datetime.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if "T" not in text and " " not in text:
        hh, mm = _schedule_time()
        moment = moment.replace(hour=hh, minute=mm)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=zone)
    return moment


def next_update(now=None):
    """(instant, repeat) — when the data is next due, UTC, and how often.

    `updates.weekday` and `updates.time` are the standing promise, and the
    instant returned is simply the next time it comes round. `repeat` is 7
    with it, because the page must be able to carry the promise forward on
    its own: a build is what re-dates this field, and the moment it names
    always arrives before the next build does. Without the repeat the line
    would go blank every week between the hour it promised and the run that
    delivered it — and stay blank for a week if a run were missed.

    `updates.next` overrides the standing promise for a pause or a one-off,
    and comes back with a repeat of 0, since a date said once does not come
    round again. It is spent after it passes, and the weekday takes over.
    """
    now = now or now_local()
    zone = _schedule_zone()

    named = (UPDATES.get("next") or "").strip()
    if named:
        moment = _named_instant(named, zone)
        if moment and moment > now:
            return _as_utc(moment), 0

    want = (UPDATES.get("weekday") or "").strip().lower()
    days = [d.lower() for d in WEEKDAYS]
    if want not in days:
        return "", 0
    hh, mm = _schedule_time()
    local = now.astimezone(zone)
    due = local.replace(hour=hh, minute=mm, second=0, microsecond=0)
    due += datetime.timedelta(days=(days.index(want) - local.weekday()) % 7)
    if due <= now:
        due += datetime.timedelta(days=7)
    return _as_utc(due), 7


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
    "ROOT", "p", "CONFIG", "SITE", "UPDATES", "OUTPUT", "TIMEZONE", "tz", "now_local",
    "today_local", "stamp", "WEEKDAYS", "next_update",
    "program_years", "season_start",
    "current_program_year", "months_of", "last_day", "district_name",
    "BASE", "UA", "get",
]
