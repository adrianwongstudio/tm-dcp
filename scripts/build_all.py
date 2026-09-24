"""Build every district the dashboard currently lists.

Threaded because each district is four independent fetches and the work is
entirely network-bound, but kept to a handful of workers: this is somebody
else's server and the whole run is only a few hundred requests.

Resumable: --only rebuilds named districts, and a district that fails leaves
the files it already had in place rather than replacing them with nothing.
"""
import os, sys, json, argparse, threading, queue, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import build_district
import gen_inyear_xlsx

THREADS = 4


def districts_from_index():
    """Every district on the board: the ones listed today, and the ones the
    archive still holds five finished years for."""
    path = C.p("docs", "districts.json")
    if not os.path.exists(path):
        sys.exit("run scripts/districts.py first — docs/districts.json is missing")
    doc = json.load(open(path, encoding="utf-8"))
    return doc, [d for r in doc["regions"] for d in r["d"]] + list(doc.get("retired", []))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="district ids; default is all of them")
    ap.add_argument("--skip-xlsx", action="store_true", help="JSON only, for a fast refresh")
    args = ap.parse_args()

    doc, ids = districts_from_index()
    todo = args.only or ids
    work = queue.Queue()
    for d in todo:
        work.put(d)

    results, failures, lock = {}, [], threading.Lock()

    def worker():
        while True:
            try:
                did = work.get_nowait()
            except queue.Empty:
                return
            try:
                clubs, live, years = build_district.write(did)
                # No open year, no workbook: the workbook is this year's
                # conversation with a club officer, and there is none to have.
                if live and not args.skip_xlsx:
                    gen_inyear_xlsx.build(did)
                with lock:
                    results[did] = {"clubs": live or clubs, "years": years, "live": live}
                    print(f"  {did:>3}  {clubs:4d} clubs / {years} years / {live:4d} live", flush=True)
            except Exception:
                with lock:
                    failures.append(did)
                    print(f"  {did:>3}  FAILED\n{traceback.format_exc()}", flush=True)

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(THREADS)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    for did, info in results.items():
        entry = doc["districts"].setdefault(did, {"name": C.district_name(did)})
        entry.update(info)
    json.dump(doc, open(C.p("docs", "districts.json"), "w", encoding="utf-8"),
              separators=(",", ":"))

    gone = sum(1 for d, i in results.items() if not i["live"])
    print(f"built {len(results)}/{len(todo)} ({gone} with no open year); "
          f"failed {len(failures)}: {failures}")
    # A handful of districts failing is a bad afternoon at Toastmasters; a
    # tenth of them failing is a broken run and must not reach the site.
    if len(failures) > max(1, len(todo) // 10):
        sys.exit(f"{len(failures)} districts failed — refusing to call this a build")


if __name__ == "__main__":
    main()
