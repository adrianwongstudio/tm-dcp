"""Fail if any district's open-year file was not rebuilt by the latest run.

A district that fails to fetch keeps its previous files, which is right for the
reader and invisible to everyone else. Every live.json carries the date it was
built, so a stale one is one whose date is older than the run that should have
rewritten it. Run last in a refresh workflow, after the commit, so the data
still publishes and the job goes red.
"""
import os, sys, json, glob, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C

MAX_AGE_DAYS = 3


def stale(root=None, today=None, max_age=MAX_AGE_DAYS):
    """[(district id, date built)] for every live.json older than max_age days."""
    today = today or C.today_local()
    paths = glob.glob(os.path.join(root or C.p("docs", "d"), "*", "live.json"))
    out = []
    for path in sorted(paths):
        with open(path, encoding="utf-8") as fh:
            built = datetime.date.fromisoformat(json.load(fh)["today"])
        if (today - built).days > max_age:
            out.append((os.path.basename(os.path.dirname(path)), built.isoformat()))
    return out


def main():
    old = stale()
    for did, built in old:
        print(f"  district {did}: last rebuilt {built}")
    if old:
        sys.exit(f"{len(old)} districts were not refreshed by this run")
    print("every district was refreshed")


if __name__ == "__main__":
    main()
