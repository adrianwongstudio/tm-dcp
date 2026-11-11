import {drawYearTable} from './clubtable.js?v=2674e1fc7c';
import {$, S, T, esc, ink, shortYr} from './core.js?v=2674e1fc7c';
import {LOC} from './lang.js?v=2674e1fc7c';
import {dprefix} from './workbooks.js?v=2674e1fc7c';

/* ---------- in-year / live ---------- */
const LVL=[[10,"Smedley"],[9,"President's"],[7,"Select"],[5,"Distinguished"]];
/* The dashboard's own snapshot date — when Toastmasters last published the
   figures, which is not when this page last built and is usually a day behind
   it. Said in the reader's locale, like every other date on the page, and
   falling back to the format the export uses if a cached document predates
   the ISO field. */
export function asofText(){
  const L=S.l; if(!L) return '\u2014';
  if(!L.asof_iso) return L.asof||'\u2014';
  return new Date(L.asof_iso+'T00:00:00')
    .toLocaleDateString(LOC(),{year:'numeric',month:'short',day:'numeric'});
}

export const fmtDate=iso=>{if(!iso)return'—';
  // built from the parts rather than parsed, so a date never slips a day on a
  // zone boundary; the month name is the locale's
  const [y,m,d]=iso.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString(LOC(),{day:'numeric',month:'short',year:'numeric'});};
export const daysTo=iso=>{if(!iso)return null;
  return Math.round((new Date(iso+'T00:00:00')-new Date(S.l.today+'T00:00:00'))/864e5);};

export function drawLive(){
  const L=S.l,a=L.agg;
  $('lvPy').textContent=shortYr(L.py);
  // the snapshot date leads both in-year headings: it is the first thing an
  // area director needs before trusting a figure on either
  const up=$('lvUpd'); if(up) up.textContent=asofText();

  $('lvTally').innerHTML=[
    [T('Distinguished already'),a.dist_now,a.dist_now?'var(--green)':'var(--muted)'],
    [T('Can still reach it'),a.dist_live,'var(--ink)'],
    [T('Can no longer reach it'),a.dist_out,a.dist_out?'var(--red)':'var(--muted)'],
    [T('Average goals met'),a.avg_met.toFixed(2),'var(--ink)'],
    [T('Meet the membership rule'),a.memok+'/'+a.clubs,'var(--ink)']
  ].map(([k,v,c])=>`<div class="tallyitem"><div class="tallyn" style="color:${ink(c)}">${v}</div>
    <div class="tallyl">${esc(k)}</div></div>`).join('');

  $('lvDl').innerHTML=(a.close||[]).map(c=>{
    const u=!c.open?0:c.days<=14?1:c.days<=60?2:0;
    return `<div class="dlrow" data-u="${u}">
      <span class="dldays">${c.days}d</span>
      <span class="dlname">${esc(T(c.lbl))}<small>${esc(T('closes {date}',{date:fmtDate(c.date)}))}${
        c.open?'':' · '+esc(T('opens {date}',{date:fmtDate(c.opens)}))}</small></span>
      <span class="dlcnt">${c.open?`<b>${c.clubs}</b>${esc(T('clubs short'))}`
        :`<span style="opacity:.7">${esc(T('not open yet'))}</span>`}</span></div>`;}).join('')
    ||`<p style="color:var(--muted);font-size:13.5px">${esc(T('Nothing else closes before 30 June.'))}</p>`;

  // how many clubs sit at each goal count, worst first
  const cnt={};L.clubs.forEach(c=>{cnt[c.met]=(cnt[c.met]||0)+1;});
  const max=Math.max(...Object.values(cnt));
  $('lvBars').innerHTML=Object.keys(cnt).map(Number).sort((x,y)=>x-y).map(k=>{
    const col=k>=5?'var(--green)':k>=3?'var(--amber)':'var(--red)';
    return `<div class="barrow"><div class="barlab">${
      esc(k===1?T('{n} goal met',{n:k}):T('{n} goals met',{n:k}))}</div>
      <div class="bartrack"><div class="barfill" style="width:${(cnt[k]/max*100).toFixed(1)}%;background:${col}"></div></div>
      <div class="barval">${cnt[k]}</div></div>`;}).join('');

  $('lvXlsx').href=`d/${S.did}/inyear.xlsx`;
  $('lvXlsx').setAttribute('download',`${dprefix()}_InYear_${L.py}.xlsx`);
  $('lvXlsxMeta').textContent=T('Excel workbook · {clubs} clubs · snapshot {date}',
    {clubs:a.clubs,date:asofText()});
}

/* The board and the five-year table both list clubs the district has since
   lost. live.json carries today's roster, so a club absent from it is no
   longer the district's — closed, merged or moved out. The two files are
   fetched independently, so until live.json lands nothing is marked: an
   unmarked club is never a wrong claim, a marked one would be. */
export function goneFromRoster(n){
  if(!S.l||!S.l.clubs) return false;
  if(!S.roster) S.roster=new Set(S.l.clubs.map(c=>c.n));
  return !S.roster.has(n);
}
const GONE_EN='no longer in the district roster';
/* A getter, not a constant: the catalogue is not loaded when this file is
   evaluated, only by the time anything draws. */
Object.defineProperty(window,'GONE',{get:()=>T(GONE_EN)});

// submitted sorts above not-submitted; unknown last
/* The export publishes the Club Success Plan as Y or N. It used to be a
   sentence on the club report page, and the test for it was /Met/ — which is
   false for both "Y" and "N", so every club read as having no plan whether it
   had one or not. 0 has a plan, 1 has none, 2 is a year that did not publish
   the column at all; the sort and the filter both lean on that order. */
export function cspRank(v){
  const c=String(v||'').trim().toUpperCase().slice(0,1);
  if(c==='Y') return 0;
  if(c==='N') return 1;
  return 2;
}
export function setLiveSort(k){
  // a new column starts ascending; the active one reverses
  S.lvSort = (S.lvSort.k===k) ? {k,dir:-S.lvSort.dir} : {k,dir:1};
  drawYearTable();
}
/* Members, at the right of each board row. The lamp is the signal and this is
   the number an area director reaches for next: how big is the club, and is it
   growing. It reads as reference rather than alarm, so the count stays ink and
   only the direction of travel carries colour \u2014 the same deal the in-year
   table makes. A finished year never recorded whether the club met the
   membership rule, so only the open year's tooltip says. */
export function memWord(md,ng,memok){
  if(md==null) return '';
  const g=(ng==null||ng===0)?''
    :ng>0?T(', up {n}',{n:Math.abs(ng)}):T(', down {n}',{n:Math.abs(ng)});
  const rule=memok==null?'':memok?T(', meets the membership rule')
    :T(', short of 20 members and of +5 net growth');
  // one member and many are different words in most languages, and in some
  // the number itself changes the ending, so the whole phrase is translated
  return (md===1?T(' \u2014 {n} member',{n:md}):T(' \u2014 {n} members',{n:md}))+g+rule;
}

export function memCell2(r){
  if(r.md==null) return '<span class="cm"></span>';
  const g=(r.ng==null||r.ng===0)?'':(r.ng>0?'+'+r.ng:String(r.ng));
  const gcol=r.ng>0?'var(--green)':r.ng<0?'var(--red)':'var(--muted)';
  return `<span class="cm" aria-hidden="true"><b>${r.md}</b>`+
    `<i style="color:${ink(gcol)}">${g}</i></span>`;
}

export function memCell(c){
  if(c.md==null) return '<span class="lvmem"><span class="memn" style="color:var(--muted)">—</span></span>';
  // the count is ink; only the direction of travel carries colour, and it sits
  // in a fixed box so the counts stay in one column whether or not it is there
  // a zero net change must render as nothing, or "23" and "0" read as "230"
  const g=(c.ng==null||c.ng===0)?'':(c.ng>0?'+'+c.ng:String(c.ng));
  const gcol=c.ng>0?'var(--green)':c.ng<0?'var(--red)':'var(--muted)';
  const rule=c.memok==null?'':c.memok
    ? ' — meets the membership rule' : ' — short of 20 members and of +5 net growth';
  return `<span class="lvmem" title="${c.md} members${c.memok==null?'':' now'}, base ${c.mb}${rule}">`+
    `<span class="memn">${c.md}</span>`+
    `<span class="memg" style="color:${ink(gcol)}">${g}</span></span>`;
}
export function cspMark(v,closed){
  const r=cspRank(v);
  if(r===2) return `<span class="csp" data-v="u" title="${esc(T('Not tracked this year'))}"><span class="cspd">?</span>—</span>`;
  const y=r===0;
  // "Not yet" only reads right while the year can still change
  return `<span class="csp" data-v="${y?'y':'n'}"><span class="cspd">${y?'\u2713':'\u2715'}</span>${
    esc(y?T('Submitted'):(closed?T('Not submitted'):T('Not yet')))}</span>`;
}
