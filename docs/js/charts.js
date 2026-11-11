import {LIVE} from './board.js?v=d722d32934';
import {fillYearSelect} from './clubtable.js?v=d722d32934';
import {$, S, T, esc, ink, on, shortYr, sig} from './core.js?v=d722d32934';
import {asofText} from './live.js?v=d722d32934';
import {spanYr} from './masthead.js?v=d722d32934';

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
  const rows=live?S.l.clubs.map(c=>c.v).filter(Boolean)
    :S.d.clubs.map(c=>c.y[S.year]).filter(v=>v&&v.g).map(v=>v.g);
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
    S.d.clubs.forEach(c=>{const f=(c.y[y]||{}).f;if(f==null)return;o[sig(f)]++;});return o;});
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
export function drawDivisions(){
  const live=S.year===LIVE;
  if(live?!S.l:!S.d) return;
  const Y=(S.d&&S.d.years)||[];
  // a partial year against a finished one is not a comparison, so the open
  // year carries no marker and no arrow
  const prev=live?null:Y[Y.indexOf(S.year)-1];

  // each club under its division and area, as it stood in the year shown
  const tree={};
  const place=(d,a,c,cur,pre)=>{
    if(!d||cur==null) return;
    const dv=tree[d]=tree[d]||{cur:[],pre:[],areas:{}};
    const ar=dv.areas[a]=dv.areas[a]||{cur:[],pre:[],clubs:[]};
    dv.cur.push(cur); ar.cur.push(cur);
    if(pre!=null){dv.pre.push(pre); ar.pre.push(pre);}
    ar.clubs.push({m:c.m,n:c.n,v:cur});};
  if(live) S.l.clubs.forEach(c=>place(c.d,c.a,c,c.met,null));
  else S.d.clubs.forEach(c=>{
    const y=c.y[S.year]||{};
    place(y.d||c.d,y.a||c.a,c,y.f,prev?(c.y[prev]||{}).f:null);});

  const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
  const list=Object.keys(tree).map(d=>({d,cur:avg(tree[d].cur),pre:avg(tree[d].pre),n:tree[d].cur.length,areas:tree[d].areas}))
    .sort((a,b)=>b.cur-a.cur);

  const cap=$('dvCap');
  if(cap) cap.innerHTML=live
    ? T('Average goals met so far per club by division, <b>{year}</b>, as of {date}. No marker and no banding: the year has not finished, so there is nothing yet to compare it against.',
        {year:esc(S.l.py),date:esc(asofText())})
    : T('Average year-end goals per club by division, <b>{year}</b>.',{year:esc(S.year)})+(prev
        ? ' '+T('The marker shows where the division sat in {year}: bars past it gained ground, bars short of it lost ground.',{year:esc(prev)})
        : ' '+T('This is the first year on the board, so there is nothing before it to mark.'));

  const colour=v=>live?'var(--muted)':v>=5?'var(--green)':v>=3?'var(--amber)':'var(--red)';
  const bar=(v,extra='')=>`<div class="bartrack" style="height:20px"><div class="barfill" style="width:${(v/10*100).toFixed(1)}%;background:${colour(v)}"></div>${extra}</div>`;
  const rowHtml=(lab,v,extra='',arrow='')=>`<div class="barrow">${lab}${bar(v,extra)}<div class="barval">${v.toFixed(1)}${arrow}</div></div>`;
  const byScore=(a,b)=>b.cur-a.cur;

  const clubRows=clubs=>clubs.sort((a,b)=>b.v-a.v).map(c=>
    `<div class="barrow club">${'<div class="barlab">'+esc(c.m)+' <span style="color:var(--muted)">\u00b7 '+esc(c.n)+'</span></div>'}${bar(c.v)}<div class="barval">${c.v}</div></div>`).join('');

  const areaRows=areas=>Object.keys(areas).map(a=>({a,cur:avg(areas[a].cur),clubs:areas[a].clubs}))
    .sort(byScore).map(r=>
    `<details class="dvx area"><summary>${rowHtml(`<div class="barlab"><b>${esc(T('Area {n}',{n:r.a}))}</b>
        <span style="color:var(--muted)">\u00b7 ${esc(T('{n} clubs',{n:r.clubs.length}))}</span></div>`,r.cur)}</summary>
      <div class="dvkids">${clubRows(r.clubs)}</div></details>`).join('');

  $('divbars').innerHTML=list.map(r=>{
    const gh=r.pre!=null?`<div class="ghost" style="left:${(r.pre/10*100).toFixed(1)}%" title="${esc(prev||'')}: ${r.pre.toFixed(1)}"></div>`:'';
    const dir=r.pre!=null?(r.cur-r.pre):null;
    const arrow=dir==null?'':`<span style="color:${ink(dir>=0?'var(--green)':'var(--red)')};font-size:11px"> ${dir>=0?'\u25b2':'\u25bc'}</span>`;
    return `<details class="dvx"><summary>${rowHtml(`<div class="barlab"><b>${esc(T('Division {n}',{n:r.d}))}</b>
        <span style="color:var(--muted)">\u00b7 ${esc(T('{n} clubs',{n:r.n}))}</span></div>`,r.cur,gh,arrow)}</summary>
      <div class="dvkids">${areaRows(r.areas)}</div></details>`;
  }).join('');
}
