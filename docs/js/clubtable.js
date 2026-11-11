import {LIVE, drawBoard, drawScrub} from './board.js?v=27f088367d';
import {TARGETS, drawDivisions, drawGoalGap} from './charts.js?v=27f088367d';
import {$, S, T, badge, esc, on, sayCount, shortYr, sig} from './core.js?v=27f088367d';
import {GOALROWS, openDetail, openLiveDetail} from './detail.js?v=27f088367d';
import {asofText, cspRank, daysTo, fmtDate, goneFromRoster, memCell, setLiveSort} from './live.js?v=27f088367d';

/* ---------- the club table, for whichever year the board is showing ----------
   This was "The Current Year", a second club table in a second section with a
   second toolbar, showing the same open year the board above already had a
   pill for. One year picker drives both now. The open year and a finished one
   are different documents and want different last columns \u2014 a deadline means
   something only while it can still be met, a recognition badge only once the
   year has stopped moving \u2014 so the head is drawn here rather than in markup. */
export const GOAL10=["Level 1 awards","Level 2 awards","More Level 2 awards","Level 3 awards",
"Level 4, Path Completion or DTM","A second Level 4, PC or DTM","New members","More new members",
"Club officers trained","Dues & officer list on time"];

/* A finished year keeps its twelve report rows, not its ten goals. Rows 9+10
   earn one goal between them and so do rows 11+12, and a goal is met only when
   every row feeding it is \u2014 the same rule scripts/dcp.py applies, which agrees
   with the dashboard's own score on all 14,455 clubs of the open year. */
function closedStates(g){
  return GOALROWS.map(rs=>rs.every(r=>g[r]!=null&&g[r]>=TARGETS[r])?'m':'d');
}

function stRank(s){
  s=String(s||'');
  return /Smedley/.test(s)?0:/President/.test(s)?1:/Select/.test(s)?2:/Distinguished/.test(s)?3:4;
}

/* One row per club in the year on screen, from whichever document holds it. */
function yearTableRows(){
  if(S.year===LIVE){
    return (S.l?S.l.clubs:[]).map(c=>({n:c.n,m:c.m,d:c.d,a:c.a,met:c.met,st:c.st,
      md:c.md,mb:c.mb,ng:c.ng,memok:c.memok,csp:c.csp,nd:c.nd,ndl:c.ndl,
      goals:(S.l.goals||GOAL10),short:0,gone:false,live:true}));
  }
  const out=[];
  (S.d?S.d.clubs:[]).forEach(c=>{
    const y=c.y[S.year];
    if(!y||y.f==null) return;
    const st=y.g?closedStates(y.g):null;
    out.push({n:c.n,m:c.m,d:y.d||c.d,a:y.a||c.a,met:y.f,st,goals:GOAL10,
      md:y.md,mb:y.mb,ng:(y.md!=null&&y.mb!=null)?y.md-y.mb:null,memok:null,
      csp:y.csp,recog:y.st,
      /* 1,457 of 100,272 archived club-years record fewer met rows than the
         score the dashboard gave the club, almost always a blank Jun-Aug
         training row. The score is the dashboard's own and stands; the squares
         cannot account for it, and saying so beats quietly contradicting it. */
      short:st?Math.max(0,y.f-st.filter(s=>s==='m').length):0,
      gone:goneFromRoster(c.n),live:false});
  });
  return out;
}

/* The division list belongs to the year on screen: a club sat where the
   alignment of that year put it, and 75 of them moved this July alone. A
   division the reader had picked survives the switch when the new year has
   one by that name. */
/* The year the pills hold, offered again wherever a reader has scrolled to:
   beside the club table and beside the goal charts, both of which sit far
   enough down that the pills are off screen. They are one choice in three
   places, never three choices. */
export function fillYearSelect(sel){
  if(!sel||!S.d) return;
  const opts=(S.d.years||[]).map(y=>[y,y]);
  if(S.l&&S.l.py) opts.push([LIVE,S.l.py+' \u00b7 '+T('now')]);
  const sig=opts.map(o=>o[0]).join(',');
  if(sel.dataset.sig!==sig){
    sel.dataset.sig=sig;
    sel.innerHTML=opts.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');
  }
  if(sel.value!==S.year) sel.value=S.year;
}

/* Every year-scoped section redraws together, from whichever control moved. */
export function setYear(y){
  S.yearPicked=true; S.year=y;
  drawScrub(); drawBoard();
  if(S.d&&S.d.years.length){drawGoalGap();drawDivisions();}
}

function syncYearFilters(rows,live){
  const sel=$('lfdiv'); if(!sel) return;
  const want=sel.value;
  const divs=[...new Set(rows.map(r=>r.d).filter(Boolean))].sort();
  const sig=divs.join(',');
  if(sel.dataset.sig!==sig){
    sel.dataset.sig=sig;
    sel.innerHTML=`<option value="">${esc(T('All divisions'))}</option>`+
      divs.map(x=>`<option value="${esc(x)}">${esc(T('Division {n}',{n:x}))}</option>`).join('');
    sel.value=divs.indexOf(want)>=0?want:'';
  }
  // the Success Plan filter is only a question the year published an answer to
  const has=rows.some(r=>cspRank(r.csp)!==2);
  const wrap=$('lfcspWrap');
  if(wrap){
    wrap.hidden=!has;
    if(!has&&$('lfcsp').checked) $('lfcsp').checked=false;
  }
  const note=$('bdTblCsp'); if(note) note.hidden=!has;
}

export function drawYearTable(){
  if(!$('lvtb')||!S.d) return;
  const live=S.year===LIVE;
  if(live&&!S.l) return;
  const rows=yearTableRows();
  fillYearSelect($('lfyear'));
  syncYearFilters(rows,live);

  const q=$('lq').value.trim().toLowerCase(),dv=$('lfdiv').value,noplan=$('lfcsp').checked;
  let list=rows.filter(c=>{
    if(dv&&c.d!==dv) return false;
    // rank 1 is "recorded, and not met" \u2014 a club the dashboard has no plan for.
    // Unknown (rank 2) is not the same claim, so it stays out of the filter.
    if(noplan&&cspRank(c.csp)!==1) return false;
    if(q&&!(c.m.toLowerCase().includes(q)||String(Number(c.n)).includes(q))) return false;
    return true;});

  const byName=(x,y)=>x.m.localeCompare(y.m);
  const KEY={
    name:c=>c.m.toLowerCase(),
    div :c=>`${c.d||'zz'}${String(c.a||'zz').padStart(3,'0')}`,
    mem :c=>c.md??-1,
    met :c=>c.met,
    last:c=>live?(c.nd||'9999-99-99'):stRank(c.recog)};
  if(!KEY[S.lvSort.k]) S.lvSort={k:'met',dir:-1};
  const {k,dir}=S.lvSort, get=KEY[k]||KEY.met;
  list.sort((x,y)=>{
    const a=get(x),b=get(y);
    const d=a<b?-1:a>b?1:0;
    return d*dir||byName(x,y);          // name breaks every tie, always A-Z
  });

  S.lvView=list;
  sayCount(list.length);
  const head=(key,lbl,cls)=>`<th${key?` data-k="${key}" tabindex="0"`:''}${
    cls?` class="${cls}"`:''}>${esc(lbl)}${key?'<span class="ar">\u25b2</span>':''}</th>`;
  $('lvth').innerHTML='<tr>'+head('name',T('Club'))+head('div',T('Div'))+head('met',T('Score'))
    +head('',T('Ten goals'))+head('mem',T('Members'))
    +head('last',live?T('Next deadline'):T('Recognition'))+'</tr>';

  $('lvtb').innerHTML=list.map(c=>{
    const pips=(c.st||[]).map((v,i)=>`<span class="pip" data-s="${v}" title="${esc(T(c.goals[i]||''))}: ${
      esc(v==='m'?T('achieved'):v==='o'?T('still reachable'):live?T('window closed'):T('not achieved'))}"></span>`).join('')
      ||`<span class="lvnone">${esc(T('no goal detail'))}</span>`;
    const d=live?daysTo(c.nd):null;
    // colour appears only where it decides something: the chip is the one that
    // says act this month. The score itself is a rank, and stays ink.
    const urg=(d!=null&&d<=30)?`<span class="lvurg" title="${
      esc(T('closes in {n} days',{n:d}))}">${d}d</span>`:'';
    // the Success Plan is a boolean that used to compete with the score for a
    // whole column; it rides on the club line, and only when it is missing
    const plan=cspRank(c.csp)===1?`<span class="lvplan" title="${
      esc(live?T('No Club Success Plan yet'):T('No Club Success Plan'))}">${
      esc(T('No Club Success Plan'))}</span>`:'';
    const off=c.gone?`<span class="lvplan" title="${esc(GONE)}">${esc(T('off roster'))}</span>`:'';
    const short=c.short?`<span class="lvshort" title="${esc(T(
      "The archive's goal rows account for {shown} of the {total} goals the dashboard credited this club",
      {shown:c.met-c.short,total:c.met}))}">${esc(T('rows short'))}</span>`:'';
    const last=live
      ? `<span class="lvnd">${urg}<span class="lvdate">${c.nd?esc(fmtDate(c.nd)):'\u2014'}</span>
         <span class="lvwin">${esc(c.ndl?T(c.ndl):'')}</span></span>`
      : badge(c.recog);
    return `<tr class="lvrow" data-n="${esc(c.n)}">
      <td><button class="rowbtn" type="button" title="${esc(c.m)}"><span class="lvname${
        c.gone?' gone':''}" translate="no">${esc(c.m)}</span></button><span class="lvnum">${
        esc(String(Number(c.n)))}${plan}${off}${short}</span></td>
      <td class="lvdiv">${esc(c.d||'\u2014')}</td>
      <td><span class="lvscore"><b>${c.met}</b><span>/10</span></span></td>
      <td class="lvpips"><span class="pips">${pips}</span></td>
      <td>${memCell(c)}</td>
      <td>${last}</td></tr>`;}).join('')
    ||`<tr><td colspan="6" style="color:var(--muted);padding:18px 14px">${esc(T('No clubs match.'))}</td></tr>`;

  $('lvth').querySelectorAll('th[data-k]').forEach(th=>{
    const on=th.dataset.k===S.lvSort.k;
    if(on) th.setAttribute('aria-sort',S.lvSort.dir===1?'ascending':'descending');
    else th.removeAttribute('aria-sort');
    const ar=th.querySelector('.ar');
    if(ar) ar.textContent = (on && S.lvSort.dir===-1) ? '\u25bc' : '\u25b2';
    th.onclick=()=>setLiveSort(th.dataset.k);
    th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setLiveSort(th.dataset.k);}};
  });
  $('lvtb').querySelectorAll('.lvrow').forEach(tr=>{
    const go=()=>{
      const num=tr.dataset.n;
      if(live) return openLiveDetail(num);
      const i=S.d.clubs.findIndex(c=>c.n===num);
      if(i>=0) openDetail(i,S.year);
    };
    tr.onclick=go;
  });

  const H=$('bdTblHead'), C=$('bdTblChip'), L=$('bdTblLede'), K=$('lvKey');
  if(H) H.textContent=live?T('Every Club, This Year'):T('Every Club That Year');
  if(C) C.textContent=live?shortYr(S.l.py)+' \u00b7 '+T('in progress')
    :shortYr(S.year)+' \u00b7 '+T('closed');
  if(L) L.innerHTML=live
    ? T('Every club as of <b>{date}</b>. Sorted by score, lowest last.',{date:esc(asofText())})
    : T('Every club at the close of {year}. Sorted by score, lowest last.',{year:esc(S.year)});
  if(K) K.innerHTML=`<span><span class="pip" data-s="m"></span> ${esc(T('achieved'))}</span>`+
    (live?`<span><span class="pip" data-s="o"></span> ${esc(T('still reachable'))}</span>
      <span><span class="pip" data-s="d"></span> ${esc(T('window closed'))}</span>`
        :`<span><span class="pip" data-s="d"></span> ${esc(T('not achieved'))}</span>`);
  $('lvNote').textContent=live
    ? T('{shown} of {total} clubs \u00b7 snapshot {date}',
        {shown:list.length,total:rows.length,date:asofText()})
    : T('{shown} of {total} clubs \u00b7 {year} as the archive closed it',
        {shown:list.length,total:rows.length,year:S.year});
}
