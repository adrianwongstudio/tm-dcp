# Forecasting Every Toastmasters Club's June 30 DCP Result: A Simple, Back-Testable Method for the Club Health Board

The method I recommend is an **"analog-year bootstrap"**. For each club, take how much it gained between this calendar point (about November 11) and June 30 in each of its last five years. Apply those gains to where the club stands today. Blend in peer clubs' gains to avoid over-trusting thin histories. Then score each simulated year-end with the official 2025-26/2026-27 rules. This gives a goal forecast with a range and a probability for each tier. It runs in well under a minute for every district on a free GitHub Actions runner, in Python with NumPy.

## TL;DR

- **Recommended model:** a goal-by-goal Monte Carlo (about 2,000 draws per club). Each draw replays one of the club's own last five November-to-June "seasons", weighted toward recent years. Thin histories are shrunk toward a peer pool of similar-size clubs. Every draw is then scored under the official rules. Distinguished needs 5 goals plus 20 members or net growth of 3. Select needs 7 goals plus 20 or net +5. President's needs 9 goals plus 20 members. Smedley needs all 10 goals plus 25 members. All levels also need the Club Success Plan by Sept 30. Output per club: median goals with a P10–P90 range, and P(≥Distinguished), P(≥Select), P(≥President's) and P(Smedley).
- **Why this model:** it builds in seasonality (education awards bunch late in the year), the hard deadlines (officer-training rounds, Oct 1/Apr 1 dues, officer list) and the April membership drop. It does this without a hand-tuned seasonality curve or an ML server. It is explainable, because each draw is "a year like your 2024-25". It can be back-tested by forecasting each prior year from its own November snapshot and scoring MAE, interval coverage and Brier score against "last year's score" and naive run-rate baselines.
- **Gap-based suggestions:** the same simulation drives rule-based suggestions tied to each goal and its deadline. As of November 11, the most time-critical are Round 2 officer training (Nov 1–Feb 28), the April 1 renewal (which also earns Goal 10 for clubs that missed October), Talk Up Toastmasters (Feb 1–Mar 31), Beat the Clock (May 1–Jun 30), closing Pathways levels before the June 30, 11:59 p.m. MT cutoff, and Club Coach eligibility for clubs with 3–12 members.

---

## 1. What the rules are in 2026-27 (verified) and what is uncertain

### 1.1 Official rules the model must encode

The Distinguished Club Program manual (Item 1111, Rev. 06/2026, effective July 1, 2026) and the official DCP FAQ define these rules.

**Qualifying requirements (all three are needed for any recognition):**
1. The club is in good standing (Policy 2.0).\[1\]
2. The club has 20 members, or net growth of at least 3 new, dual or reinstating members, as of June 30.\[1\]
3. The Club Success Plan (CSP) was submitted by September 30.\[1\]\[2\] Newly chartered clubs have 90 days from charter. Clubs that charter after April 1 get automatic credit.\[1\]

**The 10 goals:**

| # | Goal | Window / deadline | Modelled as |
|---|---|---|---|
| 1 | Four Level 1 awards | Jul 1–Jun 30 | L1 count ≥ 4 |
| 2 | Two Level 2 awards | Jul 1–Jun 30 | L2 count ≥ 2 |
| 3 | Two more Level 2 awards | Jul 1–Jun 30 | L2 count ≥ 4 |
| 4 | Two Level 3 awards | Jul 1–Jun 30 | L3 count ≥ 2 |
| 5 | One Level 4, Path Completion or DTM | Jul 1–Jun 30 | L4+ count ≥ 1 |
| 6 | One more Level 4, Path Completion or DTM | Jul 1–Jun 30 | L4+ count ≥ 2 |
| 7 | Four new, dual or reinstating members | Applications and dues received by Jun 30 | new ≥ 4 |
| 8 | Four more | same | new ≥ 8 |
| 9 | ≥4 officer roles trained in **each** of two periods | Round 1: Jun 1–Aug 31. Round 2: Nov 1–Feb 28/29 | R1 ≥ 4 AND R2 ≥ 4 |
| 10 | On-time dues (8 names, ≥3 renewing) for one period **and** an on-time officer list | Dues by Oct 1 or Apr 1. List by Jun 30 of the prior year (annual elections), or Jun 30 prior / Dec 31 current (semiannual) | (Oct OR Apr) AND list |

**Recognition levels (membership measured as of June 30):**

| Level | Goals | Membership | CSP |
|---|---|---|---|
| Distinguished | 5 | 20 members or net growth +3 | by Sep 30 |
| Select Distinguished | 7 | 20 members or net growth +5 | by Sep 30 |
| President's Distinguished | 9 | 20 members | by Sep 30 |
| Smedley Distinguished | 10 | 25 members | by Sep 30 |

**Rule details that affect the model:**
- **Membership base.** The base is paid members on June 30 of the prior year. It can be revised upward during the year when late renewals for the prior year arrive. Net growth is year-end members minus base. Transfer and honorary members do not count.\[1\]
- **New clubs.** Newly chartered clubs get a minimum membership base of 20.\[1\]
- **Education credit.**
  - Only one award type per member per year counts.\[1\]
  - Credit goes to one club only.\[1\]
  - Awards count only for members in good standing.\[1\]
  - Applications must be received by June 30.\[1\]\[3\]
  - The FAQ adds that the deadline is 11:59 p.m. Mountain Time with "no grace period", and that an officer-approved award appears in the Distinguished Performance Reports within 24 hours.\[4\]
- **Officer training.**
  - Credit requires live training by authorized district representatives, and only for the office each person was elected to.\[1\]\[5\]
  - Districts can submit Round 1 credits through October 31 and Round 2 credits through May 31.\[6\] So a club's Round 2 count on the dashboard can lag well past February.
- **Clubs outside a district** can earn each level with one fewer goal.\[1\]
- **Previous years are frozen.** The FAQ confirms the new requirements and the Smedley level started in 2025-26, and that earlier years' DCP achievements "are static and will not be modified."\[4\] Your 2021-22 to 2024-25 history was earned under the old single membership rule (20 members or net +5) and with no CSP gate.\[7\]

### 1.2 Recent changes

- **2025-26 (Board decision, in force since July 1, 2025):**
  - Smedley level added.\[8\]\[9\]
  - Membership requirements now differ by level.\[1\]\[8\]
  - CSP by Sept 30 became mandatory.\[8\]
  - The district target rose to 45% of clubs Distinguished.\[7\]\[10\]
  - Before this, there was "only one membership requirement for all levels": 20 paid members or net +5.\[3\]\[7\]
- **2026-27:** the June 2026 Leader Letter told clubs to review the latest DCP manual and "check out the updated FAQs for changes to the Distinguished Club Program."\[11\] I read both. The 2026-27 manual's goals, tier table and qualifying requirements match the 2025-26 rules. **I found no new 2026-27 rule change to the 10 goals or the tier thresholds.** Treat this as "no change identified" rather than "confirmed no change". Re-check the manual's revision date in each yearly rebuild.
- **Pathways changes that shift the education baseline:**
  - From October 2025, each level requires designated meeting roles. Levels 3–5 now also require a 10-to-15-minute presentation from the Toastmasters Education Series.\[12\]\[13\]
  - Two vintage paths launched in April 2026. Toastmasters says members "will earn Distinguished Club Program credit" in them.\[14\]\[15\]
  - The standard path price rose from $20 to $35 on July 1, 2026.\[12\]
  - The first "exploration" launched August 4, 2026.\[14\] **I could not confirm whether explorations earn DCP credit.**
  - These are plausible structural breaks: higher requirements could slow Level 3–5 completions. This is speculation that the back-test should check, not an established effect.

### 1.3 Conflicts and outdated statements to ignore

- Some district pages still describe the old rule. The Houston page says 20 members or "net growth of at least five new members", alongside the newer three-member rule.\[16\] One D17 page lists the training periods as "June–August and December–February".\[9\] The official manual says Round 2 runs **November 1**–February 28/29.\[1\] Code from the manual, not district pages.
- Rules on the dashboard export:
  - The tm-dcp README notes that the dashboard export prints 12 or 13 goal columns but awards 10 goals. The two training rows earn one goal, as do the two administrative rows.\[17\]
  - The status code for Smedley (`M`) appeared only from 2025-26.\[17\]

---

## 2. What the data can and cannot support

**What the dashboard holds today.** The tm-dcp site builds from one club-performance CSV per district-year and refreshes every Sunday at 09:00 Pacific. Its finished years store only **year-end** values; the README states that the monthly per-club series "is not reproduced here".\[17\] A November forecast really needs **prior years' November snapshots**, so this is the single most important data gap.

**Three ways to close it, in order of preference:**
1. **Backfill archived snapshots.** The dashboard UI exposes prior program years with month and "as of" selectors. Archived report URLs embed a date slot, for example `clubreport~01508580~6/30/2011~~2010-2011`.\[18\]\[19\] That suggests `clubperformance~{district}~{m/d/yyyy}~~{py}` may return a dated district CSV. **This is unverified. Test it on one district before building on it.** If it works, fetch month-end snapshots (Jul–Jun) for the five finished years once, about 162 × 5 × 12 ≈ 9,700 small CSVs, in the "Rebuild history" workflow.
2. **Use the single-district monthly archive.** The sibling repo `d21-dcp` already holds month-by-month data for District 21: "226 clubs, 11,821 club-months".\[20\] This is enough to build and sanity-check a global seasonality curve, but it is one district's behaviour.
3. **Start archiving every weekly CSV now.** Store them gzipped outside `docs/`, so that from 2027-28 every club has native same-date history.

**Base rates for sanity checks:**

| Program year | Distinguished-or-better clubs | Paid clubs | Share |
|---|---|---|---|
| 2024-25 (CEO Report, Aug 2025) | 6,737 | 13,833 | ≈48.7%\[21\] |
| 2025-26 (unverified; from a third-party transcription) | 6,587 (2,349 D, 1,037 S, 1,289 P, 1,912 Smedley) | 13,708 | ≈48.1%\[22\] |

- 2024-25 is the last year before the rule change.
- The 2025-26 figures come from the `toast-stats` project's transcription of the August 2026 CEO Report.\[22\] I could not open the official PDF to confirm them. Use them as a calibration target only after verifying.
- An older third-party summary, from the marshalls.org TmTools site, puts it this way: "On average, about half of all clubs earn Distinguished, at some level."\[23\]

**Seasonality evidence is thin and anecdotal.** I found no official month-by-month distribution of goal completion. A Toastmaster magazine article (June 2025) quotes a former District Governor whose district statistician found "the majority of education awards were typically earned in the final two months of the year."\[24\] Officer guidance from Saturn Forge, an independent officer-training site, plans Level 4/5 goals for "June".\[25\] **The model should therefore learn seasonality from your own snapshots, not assume a curve.**

**Retention matters for June membership.** Toastmasters' 2024 fact sheet reports a **56.0%** retention rate, "based upon renewing members in two consecutive renewal periods".\[26\] A club's November count is therefore a poor guide to its June 30 count, because the April renewal cycle intervenes. This is why the model treats membership change from November to June as a club-specific quantity to replay rather than to extrapolate.

**Live illustration (District 02, as of 10-Nov-2026):**
- Paid clubs: base 195, to date 159.\[19\]
- Membership payments: base 6,294, to date 3,306.\[19\]
- Distinguished clubs to date: 0, against a Distinguished District target of 88.\[19\]
- Several clubs show "Susp 09/30/26".\[19\]

Mid-year official counts are therefore uninformative about year-end recognition. A forecast adds real value here: summing P(Distinguished) across D02's clubs gives an expected count to compare against the 88 needed.

---

## 3. Candidate approaches compared

| Approach | How it works | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. Naive run-rate** | goals_now × (365 / days elapsed) | Trivial | Badly wrong. Goals are step functions with hard windows. Education awards are late-loaded, so this underestimates education. Training and admin are early-loaded, so it double-counts them. Ignores the April membership reset | Back-test baseline only |
| **B. Persistence / shrunk history** | Weighted mean of the club's last 5 year-end scores, shrunk to the peer mean | Strong, cheap baseline. Captures club "type" | Ignores this year's progress, deadlines missed and CSP status | Baseline. Also used as the prior |
| **C. Seasonality-scaled pace blend** | expected_end = now + hist_mean × (1 − s(t)), with s(t) a district/global completion curve, blended with B | Simple. Uses current progress | Gives a point estimate only. Tier probabilities need ad-hoc variance. One curve for all clubs. Ratio blows up at small counts | Good fallback if no same-date history exists |
| **D. Analog-year bootstrap Monte Carlo (recommended)** | Replay the club's own Nov→Jun gains from past years, plus peer gains for shrinkage, on today's state. Score each draw by the exact rules | Club-specific seasonality for free. Keeps correlation between education, membership and training within a year. Exact tier logic, including membership OR net growth. Natural ranges and probabilities. Explainable ("4 of your last 5 seasons…") | Needs same-date snapshots (or option C to synthesize them). At most 5 analogs per club, so shrinkage is essential | **Recommend** |
| **E. Gradient-boosted classifier** | Features → P(tier) | Potentially sharper | Needs a training pipeline, harder to explain, overfits structural breaks (2025 rule change, Pathways 2025), still needs per-goal rules | Not now. Revisit after 2 years of D's back-test logs |

**Why D:** the user's constraints were own history, five years, seasonality, simple and explainable, static hosting, and weekly runs. Approach D is the only candidate that satisfies all of them and gives tier probabilities that follow directly from the official rules rather than being bolted on.

---

## 4. Assumptions and boundary rules (explicit)

**Time and seasonality**
1. **Seasonality is learned per club** from its gains between the same day-of-program-year (±7 days) and June 30 in each prior year. If no same-date snapshot exists for a year, synthesize it as `snap ≈ end × s_g(t)`, using the global per-goal curve s_g(t) from `d21-dcp` and archived snapshots (approach C). Flag that club's forecast as "Medium" confidence.
2. **Align by the CSV's "as of" date, not the run date.** Dashboards pause at the start of each month while the prior month is closed, so the data can lag the calendar.

**Goal windows and locks (as of Nov 11, 2026)**
3. **Goal 9.** If Round 1 is under 4, Goal 9 is **lost** for the year: the Round 1 window closed Aug 31 and credits were reportable until Oct 31. If Round 1 is at least 4, P(Round 2 ≥ 4) comes from the analogs. Treat Round 2 as still open until the **May 31** reporting cutoff, even though training itself ends Feb 28/29.\[6\]
4. **Goal 10, dues.** If the Oct 1 dues were not on time, the only path left is the **Apr 1** renewal. Its probability comes from the analogs' April record.
5. **Goal 10, officer list.** If the list is missing, it is recoverable only by semiannual clubs by **Dec 31**. Elections cadence is not in the CSV, so use a small peer-based probability until Dec 31, then 0.
6. **CSP gate.** A club with CSP = N gets P(any tier) = 0. Still forecast its goals, since goals matter for area and district quality. Exception: clubs chartered in the last 90 days, or after April 1.

**Caps and structure**
7. **Caps.** Goals are capped at 10, and goal pairs are nested (Goal 3 implies Goal 2; Goal 6 implies Goal 5; Goal 8 implies Goal 7). Simulate cumulative counts (L1, L2, L3, L4+, new members), never goals directly.
8. **Membership.** June members = today's members + the analog's (June − Nov) change, floored at 0. Use the current base (it can still rise from late prior-year renewals). Net = June members − base. Tier conditions come from §1.1.
9. **Non-district clubs.** For clubs not in a district, lower each tier threshold by 1 goal. Assumption: dashboard District "U" = undistricted. Verify this.

**History, weighting and shrinkage**
10. **History window: at most 5 finished years.** Weights decay by 0.75 per year back (1.00, 0.75, 0.56, 0.42, 0.32), so the latest season counts about 3× the oldest. This handles officer and member turnover and the 2025 Pathways and rule breaks.
11. **Shrinkage (regression to the mean).**
    - Each draw uses the club's own analog with probability `W/(W + k)`, where W is the summed weight of the club's usable years and k = 1.5 pseudo-years. Otherwise it uses a peer analog.
    - A club with 5 years uses itself about 70% of the time. A club with 1 year uses itself 40% of the time. A brand-new club uses peers 100% of the time.
    - Tune k in the back-test.
12. **Peer pool.** All prior-year club-seasons (5-year window) worldwide, bucketed by current membership band (≤7, 8–12, 13–19, 20–24, ≥25). Optionally restrict to the same region if the bucket has more than 200 seasons. Do not key peers on district: the 2026-27 realignment moved **6,823 of 20,868 clubs** to a different district. History follows the club number, as `crosslink.py` already does.\[17\]
13. **Missing years** simply drop out, and the weights renormalize. A club closed and re-chartered under a new number is treated as new.

**Special cases**
14. **New clubs (chartered this year).** Peers only, drawn from prior years' charter-year clubs chartered in the same quarter. Apply charter rules:
    - Membership base is at least 20.\[1\]
    - Officer-list credit is automatic.\[1\]
    - Goal 10 is automatic if chartered Oct 1–Jun 30.\[1\]
    - Training: a Sep–Feb charter gets both rounds credited by attending Round 2. A Mar–Jun charter gets both credited by a charter training session.\[1\]
15. **Suspended or ineligible clubs** (status "Susp …" in the CSV): P(tier) = 0 and the forecast is hidden. Show "Reinstate to compete". Clubs below 8 paid members get a good-standing risk flag, because a club is "paid and in good standing" with dues for a minimum of eight members.\[4\]\[27\]
16. **Retroactive scoring.** Back-tests apply **current** rules to all years. For pre-2025-26 years, assume CSP was met, since it was not recorded then. State this in the method notes.

**Output stability**
17. **Deterministic random seed per club** (hash of club number + program year), so forecasts move only when data moves, not from simulation noise.

---

## 5. The algorithm

### 5.1 Pseudocode

```
for each district (weekly):
  load live CSV (as-of date t) → current state per club
  load ≤5 prior years: same-date snapshot (or synthesized) + year-end values
  build PEER pool: for every prior club-season, delta = end − snap (per metric),
                   t2_ok, apr_ok; bucket by membership band at snap
for each club:
  if suspended: emit {status:"suspended"}; continue
  own = [(delta_y, t2_ok_y, apr_ok_y, weight=0.75^(age−1)) for usable years]
  p_own = W/(W+1.5)
  repeat N=2000:
     analog = own (weighted) with prob p_own else random peer from same band
     counts_end = counts_now + analog.delta   (education/new clipped ≥0; members ≥0)
     g9  = R1_now≥4 AND (R2_now≥4 OR (t ≤ May31 AND analog.t2_ok))
     g10 = (duesOct_now OR (t ≤ Apr1 AND analog.apr_ok)) AND (list_now OR semiannual_chance)
     goals = Σ goal tests (cap 10)
     tiers via §1.1 (CSP, good standing, members, net)
  emit median/mean/P10/P90 of goals, P(≥ each tier), P(each goal), membership P10–P90,
       confidence (High: ≥3 own seasons; Medium: 1–2 or synthesized; Low: peers only)
```

### 5.2 Working Python (NumPy, vectorized per club)

```python
# scripts/forecast.py — analog-year bootstrap for DCP year-end forecasts
import hashlib, json
import numpy as np

N_SIMS, DECAY, K_SHRINK = 2000, 0.75, 1.5
COLS = ["l1", "l2", "l3", "l4", "new", "members"]          # cumulative counts
BANDS = [(0, 7), (8, 12), (13, 19), (20, 24), (25, 10**6)]

def band(m):
    return next(i for i, (lo, hi) in enumerate(BANDS) if lo <= m <= hi)

def season_row(snap, end):
    """One analog: Nov→Jun gains + whether R2 training and April dues landed."""
    d = [max(0, end[k] - snap[k]) for k in COLS[:-1]] + [end["members"] - snap["members"]]
    return d + [int(end["t2"] >= 4), int(bool(end["dues_apr"]))]

def build_peer_pool(all_history):
    """all_history: iterable of (snap, end) for every prior club-season in window."""
    pool = {i: [] for i in range(len(BANDS))}
    for snap, end in all_history:
        pool[band(snap["members"])].append(season_row(snap, end))
    return {b: np.array(rows, dtype=float) for b, rows in pool.items() if rows}

def tiers(goals, members, net, offset=0):
    """Official 2025-26 / 2026-27 levels; offset=1 for clubs outside a district."""
    return {
        "distinguished": (goals >= 5 - offset) & ((members >= 20) | (net >= 3)),
        "select":        (goals >= 7 - offset) & ((members >= 20) | (net >= 5)),
        "presidents":    (goals >= 9 - offset) & (members >= 20),
        "smedley":       (goals >= 10 - offset) & (members >= 25),
    }

def forecast_club(c, history, peers, day_of_py, semiannual_p=0.05, offset=0):
    """c: current state dict; history: list of {age, snap, end} (≤5, own club)."""
    if c["status"].startswith("Susp"):
        return {"status": "suspended"}
    seed = int(hashlib.sha1(f'{c["id"]}{c["py"]}'.encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)

    own = [h for h in history if h.get("snap") and h.get("end")][:5]
    own_rows = np.array([season_row(h["snap"], h["end"]) for h in own], float).reshape(-1, 8)
    w = np.array([DECAY ** (h["age"] - 1) for h in own])
    W = w.sum()
    p_own = W / (W + K_SHRINK) if len(own) else 0.0

    peer = peers.get(band(c["members"])) or next(iter(peers.values()))
    use_own = rng.random(N_SIMS) < p_own
    rows = peer[rng.integers(len(peer), size=N_SIMS)]
    if len(own):
        own_pick = own_rows[rng.choice(len(own), size=N_SIMS, p=w / W)]
        rows = np.where(use_own[:, None], own_pick, rows)

    l1, l2, l3, l4, new = (c[k] + rows[:, i] for i, k in enumerate(COLS[:-1]))
    members = np.maximum(0, c["members"] + rows[:, 5])
    net = members - c["base"]

    r2_open = day_of_py <= 334                       # ~May 31: Round-2 reporting cutoff
    g9 = (c["t1"] >= 4) & ((c["t2"] >= 4) | (r2_open & (rows[:, 6] > 0)))
    apr_open = day_of_py <= 274                      # Apr 1
    dues = c["dues_oct"] | (apr_open & (rows[:, 7] > 0))
    dec_open = day_of_py <= 183                      # Dec 31
    olist = c["officer_list"] | (dec_open & (rng.random(N_SIMS) < semiannual_p))
    g10 = dues & olist

    goal_tests = [l1 >= 4, l2 >= 2, l2 >= 4, l3 >= 2, l4 >= 1, l4 >= 2,
                  new >= 4, new >= 8, g9, g10]
    goals = np.minimum(np.sum(goal_tests, axis=0), 10)

    eligible = bool(c["csp"])                        # CSP by Sep 30 (or charter rule)
    t = tiers(goals, members, net, offset)
    p = {k: float(np.mean(v)) if eligible else 0.0 for k, v in t.items()}
    pct = lambda x, q: int(np.percentile(x, q))
    return {
        "goals": {"median": pct(goals, 50), "mean": round(float(goals.mean()), 2),
                  "p10": pct(goals, 10), "p90": pct(goals, 90)},
        "members": {"median": pct(members, 50), "p10": pct(members, 10), "p90": pct(members, 90)},
        "pTier": {k: round(v, 3) for k, v in p.items()},
        "pGoal": [round(float(np.mean(g)), 3) for g in goal_tests],
        "confidence": "high" if len(own) >= 3 else "medium" if len(own) else "low",
        "nSeasons": len(own), "pOwn": round(p_own, 2), "method": "analog-bootstrap v1",
    }
```

**Notes on the code:**
- Day-of-program-year counts days since July 1 (Dec 31 ≈ 183, Apr 1 ≈ 274, May 31 ≈ 334).
- `tiers()` returns cumulative "at least" probabilities. Smedley is a subset of President's, and so on.
- **Verify the column semantics against your `csvmap.py`/`dcp.py` before going live.** The club report for Medley Toastmasters shows "Level 2 awards · 2 · 2" then "More Level 2 awards · 2 · 8".\[28\] The code assumes the "more" columns hold counts **beyond** the first threshold, so the cumulative count is the sum. The same applies to new members.

### 5.3 Back-testing and validation

**Design:**
- For each test year from 2022-23 to 2025-26, take the snapshot nearest Nov 11. Forecast using only that year's prior seasons (inside the 5-year window) and a peer pool built only from prior years, so there is no leakage.
- Compare against the actual June 30 results.
- 2021-22 can only test the peers-only path.
- 2025-26 is the only year scored under the rules as actually applied, so report it separately.

**Metrics and targets:**

| Metric | What it checks | Target / decision rule |
|---|---|---|
| MAE of median goals | Point accuracy | Must beat baseline B (persistence) and A (run-rate) |
| P10–P90 coverage | Interval honesty | 75–85%. If below, raise K_SHRINK or add peer draws; if above, lower it |
| Brier score per tier, and Brier skill vs base rate | Probability accuracy | BSS > 0 vs "district base rate" climatology |
| Reliability diagram (10 bins) | Calibration ("70%" should happen ~70% of the time) | Points near the diagonal |
| District sum check | Σ P(≥Distinguished) vs actual Distinguished count | Within ±5% per district |

The Brier score, introduced by Glenn W. Brier in "Verification of forecasts expressed in terms of probability" (Monthly Weather Review, 1950), is the standard proper score for binary-event probabilities. Its reliability component measures exactly the "says 70%, happens 70%" property you want to display.\[29\]\[30\]

**Stratify the results** by confidence band, membership band, new vs established clubs, and pre/post-2025 years. Then tune DECAY (0.6–0.9) and K_SHRINK (0.5–3) on the 2022-23 to 2024-25 years and confirm on 2025-26. Publish the back-test table on the site's "How to read" disclosure.

---

## 6. Implementation on the existing static site

### 6.1 Data layout

These choices fit the current `docs/d/<id>/` structure:

```
data/snapshots/<py>/<district>/<yyyy-mm-dd>.csv.gz   # weekly archive (not under docs/)
docs/d/<id>/forecast.json                            # one file per district, ~30–80 KB
```

**Per-club record in `forecast.json`:**

```json
{
  "club": "00002136", "asOf": "2026-11-10", "py": "2026-2027",
  "now": {"goals": 3, "members": 31, "base": 24, "net": 7, "csp": true,
          "l1": 2, "l2": 1, "l3": 0, "l4": 0, "new": 4, "t1": 7, "t2": 0,
          "duesOct": true, "duesApr": false, "officerList": true, "status": "active"},
  "locks": {"g9": "open", "g10": "met", "csp": "met"},
  "forecast": {"goals": {"median": 7, "mean": 6.8, "p10": 5, "p90": 9},
               "members": {"median": 24, "p10": 19, "p90": 29},
               "pTier": {"distinguished": 0.86, "select": 0.61, "presidents": 0.22, "smedley": 0.04},
               "pGoal": [0.9, 0.8, 0.5, 0.6, 0.5, 0.3, 1.0, 0.7, 0.8, 1.0],
               "confidence": "high", "nSeasons": 4, "pOwn": 0.62},
  "needs": {"membersFor20": 0, "netFor3": 0, "membersFor25": 0},
  "suggestions": [{"id": "TRAIN_R2", "goal": 9, "deadline": "2027-02-28", "priority": 1}]
}
```

The figures above are illustrative, not real forecasts.

### 6.2 GitHub Actions (weekly, same cadence as the current refresh)

Add three steps to the existing "Refresh in-year data" workflow, between `build_all.py` and `stamp_assets.py`:

```yaml
on:
  schedule:
    - cron: "0 16 * * 0"   # Sun 16:00 UTC = 09:00 PDT (08:00 PST) — GitHub cron is UTC
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install numpy
      - run: python3 scripts/districts.py
      - run: python3 scripts/build_all.py
      - run: python3 scripts/archive_snapshot.py   # gzip this week's CSVs into data/snapshots
      - run: python3 scripts/forecast.py           # writes docs/d/<id>/forecast.json
      - run: python3 scripts/test_forecast.py      # rule unit tests + "no NaN, probs monotone"
      - run: python3 scripts/crosslink.py
      - run: python3 scripts/stamp_assets.py       # must stay last (hashes forecast.json too)
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add docs data && git commit -m "Weekly refresh $(date -u +%F)" || exit 0
          git push
```

**Changes to "Rebuild history"** (on demand, plus August 15):
- Backfill the prior years' dated snapshots, once the URL pattern is verified (§2).
- Re-run the back-test and write `docs/backtest.json`.

**Guardrails to keep:**
- The workflow already refuses to commit if more than a tenth of districts return no clubs.\[17\] Add the same rule for forecasts, plus a check that P(≥Distinguished) ≥ P(≥Select) ≥ P(≥President's) ≥ P(Smedley) for every club.

### 6.3 Performance

- About 13,700 active clubs × 2,000 draws × 8 columns is roughly 220 million cheap array operations, a few seconds to under a minute in NumPy on a standard runner.
- Peer pools are built once per run (about 70,000 club-seasons).
- Browser payload rises by one district file. The README puts today's per-visitor download at roughly 250 KB, and a 30–80 KB forecast file keeps that small.\[17\]
- Keep raw snapshot archives out of `docs/`, so Pages does not serve or cache them. If repo size becomes a concern, consider a separate branch or release assets.

### 6.4 How to show it on the dashboard

- **Club row (The Year in Progress):**
  - A "**Forecast 7 · range 5–9**" badge next to "goals so far", with a confidence dot (High / Medium / Low).
  - The existing ten squares, with an extra state: open goals tinted by P(goal) (e.g., ≥70% solid outline, 30–70% dashed, <30% faint). This also explains the forecast goal by goal.
- **Four tier bars:**
  - "≥Distinguished 86% · ≥Select 61% · ≥President's 22% · Smedley 4%".
  - Labels: **On track** (≥80%), **Winnable** (40–79%), **At risk** (10–39%), **Out of reach** (<10%, or locked by CSP, suspension or a closed window). Show the lock reason in words.
- **Membership needle:** projected June members (P10–P90) against both lines, the 20-member line and base + 3. Add plain text such as "needs 2 more net members for Distinguished".
- **Area and division views:**
  - Sort by **leverage**: clubs with P(≥Distinguished) between 30% and 70% are where a visit changes the outcome most.
  - Show Σ P(≥Distinguished) against the Distinguished Area/Division target.
- **District view:** expected Distinguished clubs (Σ P) with an 80% band, against the DRP target (45% of base; 88 clubs for D02 this year).\[7\]\[19\]
- **Honesty copy in the "How to read" disclosure:**
  - "A forecast, not a result."
  - "Built from this club's last five seasons and similar clubs worldwide."
  - "Back-tested accuracy: …" (from `backtest.json`).

---

## 7. Rule-based suggestions mapped to goals and timing

Each rule fires from the current state plus the forecast. Show at most three per club, ordered by (deadline soonest) × (gain in P(tier) if completed). Estimate that gain by re-running the simulation with the goal forced to "met". This is cheap, and it tells officers which single action moves them most.

| Trigger (computed) | Goal | Window | Suggested action (source) |
|---|---|---|---|
| CSP = N | Gate | Closed Sep 30 | Recognition is impossible this year without it, per the manual and FAQ. Keep pursuing goals for club quality. Contact the district or WHQ only if the dashboard flag looks wrong. No late-submission route is documented. |
| R1 < 4 | 9 | Closed | Goal 9 is lost. Do not spend effort here. Redirect to education and membership. Still train officers for quality. |
| R1 ≥ 4, R2 < 4, Nov 1–Feb 28 | 9 | **Now** | Book at least 4 officers into a district Round 2 session before Feb 28/29. Credit needs live training by authorized district reps, for the office held.\[1\]\[5\] Watch for make-up sessions, which District 47 ran in late February 2026.\[31\] |
| Oct dues not on time, before Apr 1 | 10 | Apr 1 | Collect April–September dues with at least 8 names (3+ renewing) by **April 1**.\[1\] This one action can save Goal 10, and it protects June membership. |
| Officer list missing, before Dec 31 | 10 | Dec 31 (semiannual clubs only) | Submit the officer list in Club Central by Dec 31 if the club elects semiannually. Otherwise the goal is lost. Remind officers that next year's list is due **June 30**.\[4\] |
| new < 4 or < 8 | 7–8 | Feb 1–Mar 31; May 1–Jun 30 | Run an open house plus Speechcraft. District 101 advises an open house "every six months".\[2\] A District 42 club went "from almost suspended to almost Distinguished" with an open house followed by an 8-week Speechcraft.\[32\] Time drives to Talk Up Toastmasters (Feb 1–Mar 31) and Beat the Clock (May 1–Jun 30). Toastmaster magazine (Mar 2024) says clubs that add five new, dual or reinstated members in the window receive a ribbon, and for Beat the Clock the May 2026 Leader Letter adds that dues must be paid by June 30; qualifying clubs also get 10% off their next club order. Reinstating lapsed members counts too. |
| Projected June members < 20 and net < 3 | Gate | Apr 1 renewal; Jun 30 | Show "needs X net members". Prioritise April renewals (retention is 56% across renewal periods), personal calls to lapsed members, and a Moments of Truth self-assessment of first impressions, orientation and membership strength.\[26\]\[33\]\[34\] |
| 3 ≤ members ≤ 12 | All | Any time | Request a **Club Coach** through the district. Per the Club Coach FAQ, the club must have at least 3 but no more than 12 members in good standing at appointment, must not be suspended or closed, and must not already have two coaches. Toastmaster magazine (Feb 2026) adds that at least one officer must have completed the Club Coach Program Training module in Base Camp. |
| L1 < 4 or L2 < 4 | 1–3 | Monthly; peak May–Jun | VPE lists members within one level of completion. Assign mentors to members approaching Level 1 and 2 (District 71 VPE guidance).\[35\] Ensure levels are **approved in Base Camp and submitted in Club Central**, since credit is per level, not per project.\[36\]\[37\] Spread credit, because only one award type per member per year counts. |
| L3 < 2 or L4+ < 2 | 4–6 | Mar–Jun | Identify members at Level 3+. Note that since Oct 2025, Levels 3–5 require a 10–15-minute Education Series presentation.\[12\] Schedule those slots early, since this was a new requirement and may lengthen completion times (unverified effect). |
| Any open education goal, from May 1 | 1–6 | Jun 30, 11:59 p.m. MT | Final push: no grace period. Awards count only for members in good standing, so April renewals must be paid first. Allow 24 hours for approved awards to appear.\[1\]\[4\] |
| goals ≥ 9 projected, members 20–24 | Smedley | Jun 30 | "Smedley within reach: needs 25 members and all 10 goals."\[1\] Show the member gap. |
| Status "Susp …" or < 8 paid | Gate | ASAP | Reinstate dues for at least 8 members to return to good standing.\[27\] Hide the forecast until active. |

These suggestions draw on the official toolset: the DCP manual and Club Success Plan, Moments of Truth (Item 290, which the manual calls "the roadmap"), the membership-building programs, Club Coach, and Area Director visits. Item 219 tells Area Directors to visit every club at least twice a year, with visit reports (Item 1471) due by November 30 and May 31, and Item 1111 notes they may ask to review the Club Success Plan. District practice shows consistent habits behind clubs that repeat at President's Distinguished: following the Club Success Plan, open houses, and DCP scoreboards at every executive meeting.\[34\]\[38\] These are anecdotes from district booklets, not controlled evidence.

---

## 8. Recommendations (in order)

1. **This week:**
   - Test the dated-CSV URL pattern on one district and one prior year.
   - Start archiving every weekly CSV.
   - Ship approach C (seasonality-scaled pace blended with history) as a "beta" if same-date snapshots cannot be fetched. It needs only year-end history plus a global curve from `d21-dcp`.
2. **Within a month:** backfill snapshots, run the back-test, tune DECAY and K_SHRINK, and switch to approach D once it beats baselines A and B on MAE and Brier skill and reaches 75–85% interval coverage.
3. **Display probabilities only with the calibration statement** and confidence dots. Lead area-director views with the 30–70% "leverage" band rather than the leaderboard.
4. **Re-verify the rules every July:** manual revision date, FAQ, and the CSV status codes (Smedley `M` was added in 2025-26).\[17\] Treat any rule change as a reason to down-weight older seasons.

## 9. Caveats

- **Unverified data source.** The prior-year dated snapshot URL is an inference from archived report URLs. Without it, early forecasts depend on a District-21-derived seasonality curve.
- **2025-26 tier counts are unverified.** The per-level counts (1,912 Smedley, and so on) are a third-party transcription.\[22\] The official August 2026 CEO Report could not be opened.
- **Uncertain structural shifts.** The effects of the Oct 2025 Pathways requirements and the July 2026 price increase on completion rates are unknown. Five seasons of history straddle both and the 2025 rule change, so recency weighting and back-testing on 2025-26 matter.
- **Explorations.** Whether explorations earn DCP credit is unconfirmed.
- **Fields missing from the CSV.** The CSV does not record semiannual elections or a club's April-renewal intent, so those parts of Goal 10 and membership rest on peer rates.
- **Self-fulfilling forecasts.** Forecasts can change behaviour: a club told "Out of reach" may give up. Keep "Out of reach" only for genuinely locked outcomes (CSP, closed windows, suspension) and phrase the rest as "at risk — here's the fastest fix".

## Sources

1. [Distinguished Club Program How to Be a Distinguished Club](https://content.toastmasters.org/image/upload/1111-distinguished-club-program.pdf)
2. [Five Best Practices of Distinguished Clubs](https://d101tm.org/five-best-practices-of-distinguished-clubs/)
3. [www.toastmasters.org/members Distinguished Club Program and Club Success Plan](http://www.divisionhtoastmasters.yolasite.com/resources/Education/DCPManual.pdf)
4. [Toastmasters International -Distinguished Club Program](https://www.toastmasters.org/footer/faq/Distinguished%20Club%20Program)
5. [Program Quality - Toastmasters District 123](https://toastmasters123.org/program-quality/)
6. [Toastmasters International -District Events](https://www.toastmasters.org/footer/faq/District%20Events)
7. [Toastmasters International -What Recognition Updates Mean](https://www.toastmasters.org/magazine/magazine-issues/2025/august/what-recognition-updates-mean)
8. [Toastmasters International -What Recognition Updates Mean](https://toastmasters.org/magazine/magazine-issues/2025/july/what-recognition-updates-mean)
9. [Toastmasters Distinguished Club Program (DCP) - D17 WA](https://toastmastersd17.org/dcp/)
10. [2026 Newsletter Archive](https://d207tm.org/2026-newsletter-archive/)
11. [Club News - June 2026](https://www.toastmasters.org/Membership/Leadership/the-leader-letter/leader-letter-june-2026/club-news-june-2026/)
12. [Toastmasters International -Pathways Additions on Their Way](https://www.toastmasters.org/magazine/magazine-issues/2026/may/pathways-additions-on-their-way)
13. [Pathways - Toastmasters District 26](https://www.d26toastmasters.org/pathways-2/)
14. [Toastmasters International -pathways-updates](https://www.toastmasters.org/education/pathways/pathways-updates)
15. [Toastmasters International -pathways-updates](https://www.toastmasters.org/es-mx/education/pathways/pathways-updates)
16. [What is the Distinguished Club Program (DCP)](https://toastmastershouston.com/distinguished-clubs/)
17. [GitHub - adrianwongstudio/tm-dcp: Distinguished Club Program club health board for all 94 Toastmasters districts](https://github.com/adrianwongstudio/tm-dcp)
18. [Club Alignment Membership Goals](https://dashboards.toastmasters.org/2010-2011/export.aspx?type=PDF&report=clubreport%7E01508580%7E6%2F30%2F2011%7E%7E2010-2011)
19. [District Performance](https://dashboards.toastmasters.org/District.aspx?id=02&hideclub=1)
20. [GitHub - adrianwongstudio/d21-dcp: Month-by-month Distinguished Club Program data for 181 Toastmasters District 21 clubs, 2021-22 through 2025-26 · GitHub](https://github.com/adrianwongstudio/d21-dcp)
21. [CEO REPORT AUGUST 2025](https://content.toastmasters.org/image/upload/ceo-report-august-2025.pdf)
22. [Sprint (#1426) — validate the distinguished calculators against the CEO Report's five published years (external oracle) · Issue #1429 · taverns-red/toast-stats · GitHub](https://github.com/taverns-red/toast-stats/issues/1429)
23. [TmTools -- Tools for Toastmasters](https://www.marshalls.org/tmtools/)
24. [Toastmasters International -Gain Skills by Finishing Strong](https://www.toastmasters.org/magazine/magazine-issues/2025/june/gain-skills-by-finishing-strong)
25. [2\. The DCP & Club Success Plan - All Officers - Saturn Forge](https://saturnforge.com/extras/learn/mod/book/view.php?id=86&chapterid=194)
26. [\>244,600 \>1,100 3 out of 4 Achieved Distinguished FACT SHEET Members \>272,000](https://content.toastmasters.org/image/upload/Fact-Sheet-Infographic-202407.pdf)
27. [A Message from the District Director June 2026 — South Carolina Toastmasters District 58](https://www.toastmasters-d58.org/a-message-from-the-district-director-june-2026/)
28. [01128480 Medley Toastmasters Club Smedley Distinguished](https://dashboards.toastmasters.org/ClubReport.aspx?id=01128480)
29. [Simulations evaluating resampling methods for causal discovery: ensemble performance and calibration](https://arxiv.org/pdf/1910.02047)
30. [Foundation Model Forecasts: Form and Function](https://arxiv.org/pdf/2510.19345)
31. [Winter Make-Up Club Officer Training Dates](https://www.toastmastersd47.org/winter-make-up-club-officer-training-dates/)
32. [Speechcraft Magic - Toastmasters, District 42](https://d42tm.org/speechcraft-magic/)
33. [Page 1 of 7 Area Director Club Visit Report DISTRICT DIVISION AREA CLUB NO.](https://content.toastmasters.org/image/upload/1471-area-directors-club-visit-report.pdf)
34. [Measuring Success the Toastmasters Way: Moments of Truth & the Distinguished Club Program - Toastmasters District 65](https://tmdistrict65.org/measuring-success-the-toastmasters-way-moments-of-truth-the-distinguished-club-program/)
35. [Club VP Education](https://d71toastmasters.org/resource/vpe/)
36. [Pathways Learning Center](https://d7toastmasters.org/pathways-learning-center/)
37. [Surviving the Club Success Plan: A President's Guide to the September 30 Deadline - Toastmanagers Blog](https://toastmanagers.com/blog/club-success-plan-guide)
38. [Successful Clubs How Do They Do It? Inside Successful District 10 clubs share](https://district10.org/wp-content/uploads/2024/12/Successful-clubs-booklet.pdf)
