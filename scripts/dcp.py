"""The Distinguished Club Program itself: its twelve rows, its ten goals, and
its calendar.

Moved here verbatim from the single-district repo's common.py and
gen_live_data.py. The derivation of the dead-from dates is the only record of
why those dates are what they are, so it travels with the code.
"""
import calendar, datetime

# Twelve rows on the club report earn ten goals: rows 9+10 (the two officer
# training windows) share one goal, and so do rows 11+12 (dues, officer list).
# Counting achieved rows instead of goals overstates almost every club.
TARGETS = [4, 2, 2, 2, 1, 1, 4, 4, 4, 4, 1, 1]

ROW_NAMES = [
    "Level 1 awards", "Level 2 awards", "More Level 2 awards", "Level 3 awards",
    "Level 4, Path Completion or DTM", "A second Level 4, PC or DTM",
    "New members", "More new members",
    "Officers trained Jun-Aug", "Officers trained Nov-Feb",
    "Renewal dues on time", "Officer list on time",
]

# Which report rows feed each of the ten goals.
GOAL_ROWS = [[0], [1], [2], [3], [4], [5], [6], [7], [8, 9], [10, 11]]

GOAL_NAMES = [
    "Level 1 awards", "Level 2 awards", "More Level 2 awards", "Level 3 awards",
    "Level 4, Path Completion or DTM", "A second Level 4, PC or DTM",
    "New members", "More new members",
    "Club officers trained", "Dues & officer list on time",
]

# Goals needed for each recognition level, best first.
LEVELS = [(10, "Smedley"), (9, "President's"), (7, "Select"), (5, "Distinguished")]

GOALS = [{"n": n, "r": r} for n, r in zip(GOAL_NAMES, GOAL_ROWS)]
ROWNAMES = ROW_NAMES


def eom(y, m):
    return datetime.date(y, m, calendar.monthrange(y, m)[1])


def windows(S):
    """Per row: (act-by date, date from which the row is provably unreachable).

    Act-by is the real Toastmasters deadline. The dead-from date is later
    because the dashboard keeps accepting late entries for a while - derived
    from when each row was last observed to increase across 10,170 historical
    rows, so we never call a goal dead while the source still moves it.
    """
    E = datetime.date(S + 1, 6, 30); J = datetime.date(S, 7, 1)
    w = [(E, None, J)] * 8                           # awards + members: open all year
    return w + [
      (eom(S, 8),     datetime.date(S, 11, 1),    datetime.date(S, 6, 1)),   # Jun-Aug training (tail to Oct)
      (eom(S + 1, 2), datetime.date(S + 1, 6, 1), datetime.date(S, 11, 1)),  # Nov-Feb training (tail to May)
      (eom(S + 1, 3), datetime.date(S + 1, 5, 1), J),                        # dues: Sep + Mar rounds
      (eom(S, 12),    datetime.date(S + 1, 2, 1), J)]                        # officer list


def goal_states(vals, WIN, today, END):
    """Per DCP goal: 'm' met, 'o' still reachable, 'd' window shut.

    Split out so it can be exercised at dates other than today - nothing is
    unreachable in August, so this would otherwise ship untested.
    """
    rowmet = [(vals[i] is not None and vals[i] >= TARGETS[i]) for i in range(12)]
    st = []; why = []
    for g in GOALS:
        if all(rowmet[i] for i in g['r']): st.append('m'); why.append('')
        else:
            blocked = [i for i in g['r'] if not rowmet[i] and WIN[i][1] and today >= WIN[i][1]]
            if blocked: st.append('d'); why.append(ROWNAMES[blocked[0]] + " window closed")
            else:
                nxt = min((WIN[i][0] for i in g['r'] if not rowmet[i]), default=END)
                st.append('o'); why.append(nxt.isoformat())
    return st, why
