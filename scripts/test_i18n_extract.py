"""Tests that the string collector reads every file the board's English is in.

The board's JavaScript used to be one docs/app.js and is now a dozen modules
under docs/js/. The collector kept reading app.js alone, so every string that
moved took itself out of the catalogue on the way: the map's own words, the
recognition levels, the counting words. Nothing broke that a reader could
see — those strings simply stopped being translatable and stayed English.

These drive the two readers that take JavaScript, because a catalogue that
silently shrinks is exactly the failure this script exists to catch.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i18n_extract as I
import common as C

FAILED = []


def check(label, got, want):
    if got == want:
        print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")


def js_text():
    return "".join(open(p, encoding="utf-8").read() for p in I.js_sources())


def test_js_sources():
    names = [os.path.basename(p) for p in I.js_sources()]
    check("app.js is still read", "app.js" in names, True)
    check("the split modules are read too", "map.js" in names, True)
    check("every module is read, not just the one",
          {"charts.js", "clubtable.js", "masthead.js", "live.js"} <= set(names), True)
    check("the list is sorted", names, sorted(names))


def test_t_calls_in_a_module():
    keys = I.from_js(C.p("docs", "js", "map.js"))
    check("a T() string in map.js is found", "Also meets online" in keys, True)
    check("and another", "No score this year" in keys, True)


def test_data_arrays_in_modules():
    """SHORT, GOAL10, NUM and LVL all moved out of app.js as well."""
    found = I.from_data(js_text())
    check("the recognition levels are found", "Select" in found, True)
    check("the goal names are found", "Club officers trained" in found, True)
    check("the counting words are found", "three" in found, True)


def main():
    for t in (test_js_sources, test_t_calls_in_a_module, test_data_arrays_in_modules):
        print(t.__name__)
        t()
    print("FAILED" if FAILED else "all passed")
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
