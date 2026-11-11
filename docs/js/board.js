import {drawYearTable, setYear} from './clubtable.js?v=ac4bbb43bf';
import {$, S, T, badge, esc, ink, shortYr, sig} from './core.js?v=ac4bbb43bf';
import {openDetail, openLiveDetail} from './detail.js?v=ac4bbb43bf';
import {daysTo, goneFromRoster, memCell2, memWord} from './live.js?v=ac4bbb43bf';
import {scopeDownload} from './workbooks.js?v=ac4bbb43bf';

/* ---------- board ---------- */
/* The year still running is a year on this board too. An area director reads
   the same grid for where their clubs are now, not only for where they ended
   up, and the open year is the one they can still change. */
export const LIVE = '__live';

export function drawScrub(){
  const items=S.d.years.map(y=>({y,label:y}));
  if(S.l&&S.l.py) items.push({y:LIVE,label:S.l.py+' \u00b7 '+T('now')});
  $('scrub').innerHTML=items.map(i=>
    `<button class="yr${i.y===LIVE?' now':''}" data-y="${esc(i.y)}"
      aria-pressed="${i.y===S.year}">${esc(i.label)}</button>`).join('');
  $('scrub').querySelectorAll('.yr').forEach(b=>b.onclick=()=>{
    // once a reader has chosen, the late-arriving live document must not
    // move the board under them
    setYear(b.dataset.y);});
}

/* One row per club for the year on screen. A finished year comes from
   data.json and the open one from live.json; the two documents agree on
   almost nothing except the shape below, so the grid is written against that
   rather than against either of them. */
function boardRows(){
  if(S.year===LIVE){
    return (S.l?S.l.clubs:[]).map(c=>{
      const d=daysTo(c.nd), out=c.ceil<5, soon=!out&&d!=null&&d<=30;
      /* Colour appears only where the year has decided something. A club on
         two goals in October is not in trouble, it is in October: banding a
         partial score the way a final one is banded would paint most of a
         district red in week ten. Three things are settled mid-year and each
         earns its colour — recognition already banked, Distinguished put out
         of reach, and a deadline about to shut. Everything else is a rank. */
      const sg=c.now?'g':out?'r':soon?'a':'n';
      const why=c.now?T(', {recog} already',{recog:c.now})
        :out?T(', Distinguished out of reach')
        :soon?T(', {window} closes in {days} days',{window:c.ndl||T('the next deadline'),days:d}):'';
      return {n:c.n,m:c.m,d:c.d||'\u2014',a:c.a||'\u2014',v:c.met,sg,gone:false,
              md:c.md,ng:c.ng,memok:c.memok,
              lbl:T('{club} \u2014 {met} of 10 goals so far{why}{members}',
                    {club:c.m,met:c.met,why,members:memWord(c.md,c.ng,c.memok)})};
    });
  }
  const rows=[];
  S.d.clubs.forEach(c=>{
    // clubs.tsv spans every year, so skip the ones this year never had
    const yv=c.y[S.year]||{};
    if(yv.f==null) return;
    const gone=goneFromRoster(c.n);
    const net=(yv.md!=null&&yv.mb!=null)?yv.md-yv.mb:null;
    rows.push({n:c.n,m:c.m,
      // group by the alignment that was in force that year, not today's
      d:yv.d||c.d||'\u2014',a:yv.a||c.a||'\u2014',
      v:yv.f,sg:sig(yv.f),gone,md:yv.md,ng:net,memok:null,
      lbl:T('{club} \u2014 {met} of 10 goals in {year}{members}',
             {club:c.m,met:yv.f,year:S.year,members:memWord(yv.md,net,null)})
        +(gone?' \u2014 '+GONE:'')});
  });
  return rows;
}

function setBoardLegend(live){
  const el=$('bdLegend'); if(!el) return;
  const row=(c,t)=>`<span><i class="chip" style="background:${c}"></i>${t}</span>`;
  el.innerHTML=live
    ? row('var(--green)',T('Distinguished already'))+row('var(--lampoff)',T('still in play'))
      +row('var(--amber)',T('deadline within 30 days'))+row('var(--red)',T('can no longer reach it'))
    : row('var(--green)',T('5\u201310 goals \u00b7 Distinguished'))+row('var(--amber)',T('3\u20134 goals'))
      +row('var(--red)',T('0\u20132 goals'));
}

export function drawBoard(){
  const g=$('grid'), live=S.year===LIVE, rows=boardRows();
  const chip=$('bdChip');
  if(chip) chip.textContent=live?shortYr(S.l.py)+' \u00b7 '+T('in progress')
    :shortYr(S.year)+' \u00b7 '+T('closed');
  setBoardLegend(live);
  g.setAttribute('aria-label',live
    ?T('Clubs by division and area, goals met so far this year')
    :T('Clubs by division and area, year-end DCP score'));

  // A partial score and a final one are not comparable, so the open year
  // carries no trend arrow rather than a flattering or alarming one.
  const Y=S.d.years, pi=Y.indexOf(S.year)-1;
  const prev=live?null:(pi>=0?Y[pi]:null);
  const hist=prev?new Map(S.d.clubs.map(c=>[c.n,c])):null;

  const divs={};
  rows.forEach(r=>{(divs[r.d]=divs[r.d]||{});(divs[r.d][r.a]=divs[r.d][r.a]||[]).push(r);});

  const n={g:0,a:0,r:0,n:0,x:0,ten:0};
  g.innerHTML=Object.keys(divs).sort().map(dv=>{
    const areas=Object.keys(divs[dv]).sort();
    const cur=[],pre=[];
    areas.forEach(a=>divs[dv][a].forEach(r=>{
      cur.push(r.v);
      if(hist){const h=hist.get(r.n),p=h&&(h.y[prev]||{}).f; if(p!=null)pre.push(p);}
    }));
    const avg=v=>v.length?v.reduce((s,x)=>s+x,0)/v.length:null;
    const ca=avg(cur),pa=avg(pre),trend=(ca!=null&&pa!=null)?ca-pa:null;
    const level=trend!=null&&Math.abs(trend)<0.05;
    const tcol=(trend==null||level)?'var(--muted)':trend>0?'var(--green)':'var(--red)';
    // mid-year an average is a pace, not a grade, so it is not banded either
    const acol=live?'var(--ink)':ca==null?'var(--muted)':ca>=5?'var(--green)':ca>=3?'var(--amber)':'var(--red)';
    const body=areas.map(a=>{
      const sorted=divs[dv][a].slice().sort((x,y)=>{
        // clubs the district no longer has drop to the foot of the area, whatever
        // they scored: the list is read top-down for who to call, and there is no
        // one left to call at a club that has gone
        if(x.gone!==y.gone) return x.gone?1:-1;
        return y.v-x.v || x.m.localeCompare(y.m);
      });
      const items=sorted.map(r=>{
        n[r.sg]++; if(r.v===10) n.ten++;
        // the year's result still stands, so only the name is struck: the lamp
        // is history and stays exactly as it was
        return `<button class="clubrow" data-n="${esc(r.n)}" title="${esc(r.lbl)}" aria-label="${esc(r.lbl)}">
          <span class="lamp" data-sig="${r.sg}" aria-hidden="true">${r.v}</span>
          <span class="cn${r.gone?' gone':''}" translate="no">${esc(r.m)}</span>${memCell2(r)}</button>`;
      }).join('');
      return `<div class="areagrp"><div class="arealab">${esc(T('Area {n}',{n:a}))}
        <span class="cmh">${esc(T('Members'))}</span>
        <button class="scopedl mini" data-kind="Area" data-label="${esc(a)}" data-div="${esc(dv)}"
          title="${esc(T('Download Area {n} \u2014 current roster \u2014 as an Excel workbook',{n:a}))}"
          aria-label="${esc(T('Download Area {n} as an Excel workbook',{n:a}))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>
        </button></div>${items}</div>`;
    }).join('');
    return `<section class="divblock"><div class="divhead">
        <span class="divname">${esc(T('Division {n}',{n:dv}))}</span>
        <span class="divstat">${cur.length}<span class="w"> ${esc(T('clubs \u00b7 avg'))} </span><span class="divavg" style="color:${ink(acol)}">${ca==null?'\u2014':ca.toFixed(1)}</span>${trend==null?'':` <span style="color:${ink(tcol)}">${level?`<span class="w">${esc(T('level'))}</span>`:(trend>0?'\u25b2':'\u25bc')+' '+Math.abs(trend).toFixed(1)}</span>`}</span>
        <button class="scopedl" data-kind="Division" data-label="${esc(dv)}"
          title="${esc(T('Download Division {n} \u2014 current roster \u2014 as an Excel workbook',{n:dv}))}"
          aria-label="${esc(T('Download Division {n} as an Excel workbook',{n:dv}))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>
          Excel</button>
      </div><div class="areas" data-n="${areas.length}">${body}</div></section>`;
  }).join('');

  g.querySelectorAll('.clubrow').forEach(b=>b.onclick=()=>{
    const num=b.dataset.n;
    if(live) return openLiveDetail(num);
    const i=S.d.clubs.findIndex(c=>c.n===num);
    if(i>=0) openDetail(i);
  });
  g.querySelectorAll('.scopedl').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const {kind,label,div}=b.dataset;
    // The board groups clubs by the alignment of the year on screen. A
    // director's patch is whatever it is NOW, and 75 clubs moved this year,
    // so the roster comes from the live feed when we have it.
    const match=(d,a)=>kind==='Division'?d===label:(d===div&&a===label);
    const cur=S.l?new Set(S.l.clubs.filter(c=>match(c.d||'\u2014',c.a||'\u2014')).map(c=>c.n)):null;
    const list=cur&&cur.size
      ? S.d.clubs.filter(c=>cur.has(c.n))
      : S.d.clubs.filter(c=>match(c.d||'\u2014',c.a||'\u2014'));
    scopeDownload(kind,kind==='Area'?`${div}${label}`:label,list);
  });

  drawYearTable();

  const a=(S.l&&S.l.agg)||{};
  $('tally').innerHTML=(live
    ? [[T('Distinguished already'),a.dist_now??0,a.dist_now?'var(--green)':'var(--muted)'],
       [T('Can still reach it'),a.dist_live??0,'var(--ink)'],
       [T('Can no longer reach it'),a.dist_out??0,a.dist_out?'var(--red)':'var(--muted)'],
       [T('Average goals so far'),(a.avg_met??0).toFixed(2),'var(--ink)']]
    : [[T('Distinguished or better'),n.g,'var(--green)'],[T('Stalled at 3\u20134'),n.a,'var(--amber)'],
       [T('Under 3 goals'),n.r,'var(--red)'],[T('Perfect 10'),n.ten,'var(--ink)']]
  ).map(([l,v,c])=>`<div class="tallyitem"><div class="tallyn" style="color:${ink(c)}">${v}</div>
     <div class="tallyl">${esc(l)}</div></div>`).join('');
}

/* ---------- movement ---------- */
export function drawMv(){
  const [fy,ty]=S.mv.split('|');
  const f=r=>r.fy===fy&&r.ty===ty;
  const imp=S.d.imp.filter(f),dec=S.d.dec.filter(f);
  // Div/Area here is the alignment of the year being reported, not today's.
  // The row keeps its table semantics; the club name inside it is the button.
  const row=r=>`<tr class="mvrow" data-n="${esc(r.n)}" data-y="${esc(r.ty)}">
    <td class="cname"><button class="rowbtn" type="button" translate="no"
      title="${esc(T('{club} \u2014 open {year}',{club:r.m,year:r.ty}))}">${esc(r.m)}</button><span class="cmeta">${
      esc(r.n)} · ${esc(T('Div {d}/{a}',{d:r.d,a:r.a}))}</span></td>
    <td class="arc">${r.fd} → ${r.td}</td>
    <td class="delta ${r.ch>0?'up':'down'}">${r.ch>0?'+':''}${r.ch}</td><td>${badge(r.st)}</td></tr>`;
  $('imptb').innerHTML=imp.length?imp.map(row).join(''):`<tr><td colspan="4" style="color:var(--muted)">${esc(T('No clubs.'))}</td></tr>`;
  $('dectb').innerHTML=dec.length?dec.map(row).join(''):`<tr><td colspan="4" style="color:var(--muted)">${esc(T('No clubs.'))}</td></tr>`;
  $('impcnt').textContent=T('{n} clubs',{n:imp.length});
  $('deccnt').textContent=T('{n} clubs',{n:dec.length});
  // open the club on the year it slipped or climbed into
  document.querySelectorAll('#imptb .mvrow,#dectb .mvrow').forEach(tr=>{
    const go=()=>{
      const i=S.d.clubs.findIndex(c=>c.n===tr.dataset.n);
      if(i>=0) openDetail(i,tr.dataset.y);
    };
    // the button carries Enter and Space itself, so the row only needs the click
    tr.onclick=go;
  });
}
