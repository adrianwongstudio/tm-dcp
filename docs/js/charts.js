import {LIVE} from './board.js?v=f52d1643ff';
import {fillYearSelect} from './clubtable.js?v=f52d1643ff';
import {$, S, T, esc, ink, on, shortYr, sig} from './core.js?v=f52d1643ff';
import {asofText} from './live.js?v=f52d1643ff';
import {spanYr} from './masthead.js?v=f52d1643ff';

/* ---------- charts ---------- */
export const TARGETS=[4,2,2,2,1,1,4,4,4,4,1,1];
export const SHORT=["Level 1 awards","Level 2 awards","More Level 2 awards","Level 3 awards",
"Level 4 / Path Completion / DTM","A second Level 4 / PC / DTM","New members (4)","More new members (4)",
"Officers trained, Jun–Aug","Officers trained, Nov–Feb","Renewal dues on time","Officer list on time"];
export function drawGoalGap(){
  const live=S.year===LIVE;
  if(live?!S.l:!S.d) return;
  fillYearSelect($('sgYear'));
  const chip=$('sgChip');
  if(chip) chip.textContent=live?shortYr(S.l.py)+' \u00b7 '+T('in progress')
    :shortYr(S.year)+' \u00b7 '+T('closed');

  // the twelve report rows, from whichever document holds the year on screen
  const rows=live?S.l.clubs.filter(c=>c.md).map(c=>c.v).filter(Boolean)
    :S.d.clubs.map(c=>c.y[S.year]).filter(v=>v&&v.g&&v.md).map(v=>v.g);
  const pct=SHORT.map((_,j)=>{
    const met=rows.filter(g=>g[j]!=null&&g[j]>=TARGETS[j]).length;
    return {j,p:rows.length?met/rows.length*100:0};});
  pct.sort((a,b)=>a.p-b.p);

  const cap=$('ggCap');
  if(cap) cap.innerHTML=live
    ? T('Share of clubs that have met each goal so far in <b>{year}</b>, as of {date}. Sorted worst first, so the top of this list is where district support buys the most goals before 30 June.',
        {year:esc(S.l.py),date:esc(asofText())})
    : T('Share of clubs that met each goal in <b>{year}</b>. Sorted worst first, so the top of this list is where district support buys the most goals.',
        {year:esc(S.year)});

  $('goalgap').innerHTML=pct.map(g=>{
    // mid-year a share is a pace, not a verdict: almost nobody has a Level 2
    // award in October and that is not a goal going missing, so the open year
    // is unbanded and the order carries the point on its own
    const col=live?'var(--muted)':g.p>=60?'var(--green)':g.p>=35?'var(--amber)':'var(--red)';
    return `<div class="barrow"><div class="barlab">${esc(T(SHORT[g.j]))}</div>
      <div class="bartrack"><div class="barfill" style="width:${g.p.toFixed(1)}%;background:${col}"></div></div>
      <div class="barval">${Math.round(g.p)}%</div></div>`;}).join('');
}
export function drawTrend(){
  const Y=S.d.years;
  // one bar is not a trajectory, so a district without finished years is shown
  // the two charts that do work on an open year and not this one
  const card=$('trendCard');
  if(card) card.hidden=!Y.length;
  if(!Y.length) return;
  const cnt=Y.map(y=>{const o={g:0,a:0,r:0};
    S.d.clubs.forEach(c=>{const v=c.y[y]||{},f=v.f;if(f==null||!v.md)return;o[sig(f)]++;});return o;});
  // Shares, not raw counts. Realignment moved club counts a long way in some
  // districts, and a column scaled by its total reads that growth as
  // performance. Every column is full height; the year's own total is printed
  // under it, which is the only place the size of the district belongs.
  $('trend').innerHTML=cnt.map(o=>{
    const tot=o.g+o.a+o.r;
    // the count sits on the fill, so it takes the fill's own ink
    const seg=(v,c)=>v?`<div class="seg" style="height:${(v/tot*100).toFixed(2)}%;background:${c}">${
      v/tot>=.12?`<span class="segn" style="color:${on(c)}">${v}</span>`:''}</div>`:'';
    return `<div class="stackcol" style="height:100%">${seg(o.g,'var(--green)')}${seg(o.a,'var(--amber)')}${seg(o.r,'var(--red)')}</div>`;
  }).join('');
  $('trendlabs').innerHTML=Y.map((y,i)=>{
    const tot=cnt[i].g+cnt[i].a+cnt[i].r;
    return `<div class="stacklab" style="flex:1">${shortYr(y)}<span class="stackn">${
      esc(tot===1?T('{n} club',{n:tot}):T('{n} clubs',{n:tot}))}</span></div>`;}).join('');
  // The same page serves every district, so the caption is read off the data
  // rather than written: the newest finished year against the oldest.
  const cap=$('trendCap');
  if(cap){
    const pc=o=>{const t=o.g+o.a+o.r; return t?Math.round(o.g/t*100):null;};
    const li=cnt.length-1,lp=pc(cnt[li]),fp=pc(cnt[0]);
    const part=(i,p,word)=>{
      const tot=cnt[i].g+cnt[i].a+cnt[i].r;
      return word?T('{pct}% Distinguished ({met} of {total} clubs)',{pct:p,met:cnt[i].g,total:tot})
                 :T('{pct}% ({met} of {total})',{pct:p,met:cnt[i].g,total:tot});
    };
    let t=T('Share of clubs in each year-end band.');
    if(lp!=null){
      t+=' '+T('{year}: {share}',{year:spanYr(Y[li]),share:part(li,lp,true)});
      if(li>0&&fp!=null){
        const dir=lp>fp?T('up from'):lp<fp?T('down from'):T('level with');
        t+=T(', {direction} {share} in {year}',{direction:dir,share:part(0,fp,false),year:spanYr(Y[0])});
      }
      t+='.';
    }
    cap.textContent=t;
  }
}
