import re,html

GOAL_ROW=re.compile(
 r"<td class='goalDescription'>(.*?)</td>\s*"
 r"<td class='clubReportGoalText'>(.*?)</td>\s*"
 r"<td class='[^']*?clubReportGoal(Achieved)?'>(.*?)</td>",re.S)

def _txt(x):
    x=re.sub(r'<small.*?</small>','',x,flags=re.S)
    return html.unescape(re.sub(r'<[^>]+>','',x)).strip()

def _int(x):
    try: return int(str(x).strip())
    except Exception: return None

def parse(s):
    d={'club_no':None,'club_name':'','status':'','goals_met':None,
       'mem_base':None,'members':None,'net_growth':None,'division':'','area':'','csp':''}
    m=re.search(r"<h2>\s*(\d+)\s+(.*?)\s*</h2>",s,re.S)
    if m:
        d['club_no']=m.group(1); rest=m.group(2)
        if '<br>' in rest:
            n,st=rest.split('<br>',1); d['club_name'],d['status']=_txt(n),_txt(st)
        else: d['club_name']=_txt(rest)
    m=re.search(r"As of (\d{1,2}-\w{3}-\d{4})",s); d['asof']=m.group(1) if m else None

    # ---- layout B (2025-2026+) ----
    if 'csp-table' in s:
        m=re.search(r"<span>Membership</span>.*?Base<p>(\d+)</p>.*?To Date<p>(\d+)</p>"
                    r"(?:.*?Net Growth<p>(-?\d+)</p>)?",s,re.S)
        if m:
            d['mem_base'],d['members'],d['net_growth']=_int(m.group(1)),_int(m.group(2)),_int(m.group(3))
        m=re.search(r"<span>Goals</span></div><p class='para'>(\d+)</p>",s)
        if m: d['goals_met']=_int(m.group(1))
        m=re.search(r"<span>Club Success Plan</span></div><p class='para'>(.*?)</p>",s,re.S)
        if m: d['csp']=_txt(m.group(1))
        m=re.search(r"Division:\s*([^<]*)</span><span>Area:\s*([^<]*)</span>",s)
        if m: d['division'],d['area']=m.group(1).strip(),m.group(2).strip()
    # ---- layout A (through 2024-2025) ----
    else:
        m=re.search(r"Goals Met<br /><span class='chart_table_big_numbers'>(\d+)</span>",s)
        if m: d['goals_met']=_int(m.group(1))
        m=re.search(r">Base</td>.*?>To Date</td>.*?big_numbers'>(\d+)</td>.*?big_numbers'>(\d+)</td>",s,re.S)
        if m: d['mem_base'],d['members']=_int(m.group(1)),_int(m.group(2))
        m=re.search(r">Division<br /><span>([^<]*)</span>.*?>Area<br /><span>([^<]*)</span>",s,re.S)
        if m: d['division'],d['area']=m.group(1).strip(),m.group(2).strip()
        if d['mem_base'] is not None and d['members'] is not None:
            d['net_growth']=d['members']-d['mem_base']

    d['goals']=[{'name':_txt(r.group(1)),'goal':_txt(r.group(2)),
                 'todate':_txt(r.group(4)),'met':bool(r.group(3))}
                for r in GOAL_ROW.finditer(s)]
    return d
