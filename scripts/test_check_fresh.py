"""Tests for the staleness check, on throwaway directories."""
import os, sys, json, tempfile, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_fresh

FAILED = []


def check(label, got, want):
    if got == want:
        print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")


def main():
    today = datetime.date(2026, 11, 10)
    with tempfile.TemporaryDirectory() as root:
        for did, built in (("21", "2026-11-09"), ("57", "2026-11-05"), ("02", "2026-11-07")):
            os.makedirs(os.path.join(root, did))
            with open(os.path.join(root, did, "live.json"), "w") as fh:
                json.dump({"today": built}, fh)
        os.makedirs(os.path.join(root, "01"))      # dissolved: no live.json
        got = check_fresh.stale(root, today)
        check("only the old districts are reported", got, [("57", "2026-11-05")])
        check("a looser limit reports none", check_fresh.stale(root, today, max_age=10), [])
    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
