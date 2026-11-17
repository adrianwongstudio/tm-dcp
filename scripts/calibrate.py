"""Refit the tier-odds calibration -> data/calibration.json.

Replays the forecast on every past season in data/seasons.json, each one using
only the years before it, at five dates across the year, and fits how often
"p% likely" actually happened. forecast.py applies the result to the simulated
odds. Run each August, after build_seasons.py has added the year just closed.

    uv run scripts/calibrate.py
"""
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import backtest as B

OUT = C.p("data", "calibration.json")
MIN_RECORDS = 500


def main():
    years = sorted({B.YEAR(s) for s in B.SEASONS})[1:]
    records = [r for r in B.collect(years) if r["f"]["status"] == "active"]
    if len(records) < MIN_RECORDS:
        sys.exit(f"only {len(records)} past forecasts to learn from; keeping {OUT} as it is")
    doc = {"fitted": datetime.date.today().isoformat(), "n": len(records),
           "years": [f"{y}-{y + 1}" for y in years], "tiers": B.fit(records)}
    json.dump(doc, open(OUT, "w", encoding="utf-8"), indent=1)
    print(f"{len(records)} past forecasts over {len(years)} years -> {OUT}\n{doc['tiers']}")


if __name__ == "__main__":
    main()
