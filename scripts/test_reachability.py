"""Tests for the in-year reachability rules in gen_live_data.py.

Worth having because nothing is unreachable early in the year: run in August,
every goal is 'open' and the interesting branches never execute. These drive
the same function at simulated dates.

    python3 scripts/test_reachability.py
"""
import sys,os,datetime
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import dcp as G

S=2026; WIN=G.windows(S); END=datetime.date(S+1,6,30)
def run(vals,d): return G.goal_states(vals,WIN,d,END)[0]

FAILED=[]
def check(label,got,want):
    if got==want: print(f"  pass  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}\n          got  {got}\n          want {want}")

def main():
    zero=[0]*12
    check("nothing met in August, all ten still open",
          run(zero,datetime.date(2026,8,24)),list('oooooooooo'))
    check("Jun-Aug window missed, training goal gone by mid-November",
          run(zero,datetime.date(2026,11,15)),list('oooooooo')+['d','o'])
    check("officer list missed, admin goal gone by February",
          run(zero,datetime.date(2027,2,1)),list('oooooooo')+['d','d'])
    check("award goals stay open to the final days of June",
          run(zero,datetime.date(2027,6,20)),list('oooooooo')+['d','d'])

    half=[0]*12; half[8]=4
    check("training: one half done, other still open",run(half,datetime.date(2026,11,15))[8],'o')
    check("training: one half done, other missed",   run(half,datetime.date(2027,6,1))[8],'d')
    both=[0]*12; both[8]=4; both[9]=4
    check("training: both halves earns the goal",    run(both,datetime.date(2027,6,1))[8],'m')

    dues=[0]*12; dues[10]=1
    check("admin: dues only, before the cutoff",     run(dues,datetime.date(2026,12,1))[9],'o')
    check("admin: dues only, after the cutoff",      run(dues,datetime.date(2027,2,1))[9],'d')
    bothadm=[0]*12; bothadm[10]=1; bothadm[11]=1
    check("admin: both rows earns the goal",         run(bothadm,datetime.date(2027,2,1))[9],'m')

    check("a club that met everything never goes dead",
          run([9]*12,datetime.date(2027,6,29)),list('mmmmmmmmmm'))

    seq=[datetime.date(2026,8,24),datetime.date(2026,11,15),
         datetime.date(2027,5,15),datetime.date(2027,6,20)]
    ceils=[sum(1 for x in run(zero,d) if x!='d') for d in seq]
    check(f"ceiling only ever falls {ceils}",ceils,sorted(ceils,reverse=True))

    print(("\nFAILED: "+", ".join(FAILED)) if FAILED else "\nall reachability tests pass")
    return 1 if FAILED else 0

if __name__=='__main__': sys.exit(main())
