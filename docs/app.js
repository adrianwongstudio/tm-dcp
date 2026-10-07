const S={d:null,year:null,mv:null,lvSort:{k:'met',dir:-1},l:null,did:null,index:null,askedClub:null};
const $=id=>document.getElementById(id);
/* Every signal colour is a pair, not a value. The fill stays vivid so the
   traffic-light reading holds; ink() is the same status set as type against the
   page, and on() is the text that sits ON the fill — amber never takes white,
   which is where the old single value measured near 2:1. */
const PAIR={'var(--green)':['var(--green-ink)','var(--green-on)'],
            'var(--amber)':['var(--amber-ink)','var(--amber-on)'],
            'var(--red)'  :['var(--red-ink)',  'var(--red-on)']};
const ink=v=>(PAIR[v]||[v])[0];
const on =v=>(PAIR[v]||[,'var(--ink)'])[1];

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sig=v=>v==null?'x':v>=5?'g':v>=3?'a':'r';
const shortYr=y=>y.slice(2,4)+'–'+y.slice(7,9);
function badge(st){
  if(!st) return '<span class="badge">—</span>';
  const t=/President/.test(st)?'p':/Select|Smedley/.test(st)?'s':'d';
  const lbl=st.replace(/ Distinguished$/,'').replace(/^Distinguished$/,'Distinguished');
  return `<span class="badge" data-t="${t}">${esc(lbl==='Distinguished'?'Distinguished':lbl)}</span>`;
}
function spark(vals){
  const w=94,h=24,pts=[],n=vals.length;
  vals.forEach((v,i)=>{if(v==null)return;
    pts.push([4+i*((w-8)/(n-1)),h-3-(v/10)*(h-7)]);});
  if(pts.length<2) return `<svg width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const last=vals.filter(v=>v!=null).pop();
  const c=ink(sig(last)==='g'?'var(--green)':sig(last)==='a'?'var(--amber)':'var(--red)');
  return `<svg width="${w}" height="${h}" aria-hidden="true" style="overflow:visible">
    <line x1="4" y1="${(h-3-(5/10)*(h-7)).toFixed(1)}" x2="${w-4}" y2="${(h-3-(5/10)*(h-7)).toFixed(1)}"
      stroke="var(--line)" stroke-width="1" stroke-dasharray="2 2"/>
    <path d="${d}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${pts[pts.length-1][0].toFixed(1)}" cy="${pts[pts.length-1][1].toFixed(1)}" r="2.6" fill="${c}"/></svg>`;
}

/* ---------- board ---------- */
/* The year still running is a year on this board too. An area director reads
   the same grid for where their clubs are now, not only for where they ended
   up, and the open year is the one they can still change. */
const LIVE = '__live';

function drawScrub(){
  const items=S.d.years.map(y=>({y,label:y}));
  if(S.l&&S.l.py) items.push({y:LIVE,label:S.l.py+' \u00b7 now'});
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
      const why=c.now?`, ${c.now} already`
        :out?', Distinguished out of reach'
        :soon?`, ${c.ndl||'the next deadline'} closes in ${d} days`:'';
      return {n:c.n,m:c.m,d:c.d||'\u2014',a:c.a||'\u2014',v:c.met,sg,gone:false,
              lbl:`${c.m} \u2014 ${c.met} of 10 goals so far${why}`};
    });
  }
  const rows=[];
  S.d.clubs.forEach(c=>{
    // clubs.tsv spans every year, so skip the ones this year never had
    const yv=c.y[S.year]||{};
    if(yv.f==null) return;
    const gone=goneFromRoster(c.n);
    rows.push({n:c.n,m:c.m,
      // group by the alignment that was in force that year, not today's
      d:yv.d||c.d||'\u2014',a:yv.a||c.a||'\u2014',
      v:yv.f,sg:sig(yv.f),gone,
      lbl:`${c.m} \u2014 ${yv.f} of 10 goals in ${S.year}${gone?' \u2014 '+GONE:''}`});
  });
  return rows;
}

function setBoardLegend(live){
  const el=$('bdLegend'); if(!el) return;
  const row=(c,t)=>`<span><i class="chip" style="background:${c}"></i>${t}</span>`;
  el.innerHTML=live
    ? row('var(--green)','Distinguished already')+row('var(--lampoff)','still in play')
      +row('var(--amber)','deadline within 30 days')+row('var(--red)','can no longer reach it')
    : row('var(--green)','5\u201310 goals \u00b7 Distinguished')+row('var(--amber)','3\u20134 goals')
      +row('var(--red)','0\u20132 goals');
}

function drawBoard(){
  const g=$('grid'), live=S.year===LIVE, rows=boardRows();
  const chip=$('bdChip');
  if(chip) chip.textContent=live?shortYr(S.l.py)+' \u00b7 in progress'
    :shortYr(S.year)+(S.d.inherited?' \u00b7 carried in':' \u00b7 closed');
  setBoardLegend(live);
  setBoardOrigin();
  g.setAttribute('aria-label',live
    ?'Clubs by division and area, goals met so far this year'
    :'Clubs by division and area, year-end DCP score');

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
          <span class="cn${r.gone?' gone':''}">${esc(r.m)}</span></button>`;
      }).join('');
      return `<div class="areagrp"><div class="arealab">Area ${esc(a)}
        <button class="scopedl mini" data-kind="Area" data-label="${esc(a)}" data-div="${esc(dv)}"
          title="Download Area ${esc(a)} \u2014 current roster \u2014 as an Excel workbook"
          aria-label="Download Area ${esc(a)} as an Excel workbook">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>
        </button></div>${items}</div>`;
    }).join('');
    return `<section class="divblock"><div class="divhead">
        <span class="divname">Division ${esc(dv)}</span>
        <span class="divstat">${cur.length}<span class="w"> clubs \u00b7 avg </span><span class="divavg" style="color:${ink(acol)}">${ca==null?'\u2014':ca.toFixed(1)}</span>${trend==null?'':` <span style="color:${ink(tcol)}">${level?'<span class="w">level</span>':(trend>0?'\u25b2':'\u25bc')+' '+Math.abs(trend).toFixed(1)}</span>`}</span>
        <button class="scopedl" data-kind="Division" data-label="${esc(dv)}"
          title="Download Division ${esc(dv)} \u2014 current roster \u2014 as an Excel workbook"
          aria-label="Download Division ${esc(dv)} as an Excel workbook">
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
    ? [['Distinguished already',a.dist_now??0,a.dist_now?'var(--green)':'var(--muted)'],
       ['Can still reach it',a.dist_live??0,'var(--ink)'],
       ['Can no longer reach it',a.dist_out??0,a.dist_out?'var(--red)':'var(--muted)'],
       ['Average goals so far',(a.avg_met??0).toFixed(2),'var(--ink)']]
    : [['Distinguished or better',n.g,'var(--green)'],['Stalled at 3\u20134',n.a,'var(--amber)'],
       ['Under 3 goals',n.r,'var(--red)'],['Perfect 10',n.ten,'var(--ink)']]
  ).map(([l,v,c])=>`<div class="tallyitem"><div class="tallyn" style="color:${ink(c)}">${v}</div>
     <div class="tallyl">${l}</div></div>`).join('');
}

/* ---------- movement ---------- */
function drawMv(){
  const [fy,ty]=S.mv.split('|');
  const f=r=>r.fy===fy&&r.ty===ty;
  const imp=S.d.imp.filter(f),dec=S.d.dec.filter(f);
  // Div/Area here is the alignment of the year being reported, not today's.
  const row=r=>`<tr class="mvrow" tabindex="0" role="button" data-n="${esc(r.n)}" data-y="${esc(r.ty)}"
      title="${esc(r.m)} — open ${esc(r.ty)}">
    <td class="cname">${esc(r.m)}<span class="cmeta">${esc(r.n)} · Div ${esc(r.d)}/${esc(r.a)}</span></td>
    <td class="arc">${r.fd} → ${r.td}</td>
    <td class="delta ${r.ch>0?'up':'down'}">${r.ch>0?'+':''}${r.ch}</td><td>${badge(r.st)}</td></tr>`;
  $('imptb').innerHTML=imp.length?imp.map(row).join(''):'<tr><td colspan="4" style="color:var(--muted)">No clubs.</td></tr>';
  $('dectb').innerHTML=dec.length?dec.map(row).join(''):'<tr><td colspan="4" style="color:var(--muted)">No clubs.</td></tr>';
  $('impcnt').textContent=imp.length+' clubs';$('deccnt').textContent=dec.length+' clubs';
  // open the club on the year it slipped or climbed into
  document.querySelectorAll('#imptb .mvrow,#dectb .mvrow').forEach(tr=>{
    const go=()=>{
      const i=S.d.clubs.findIndex(c=>c.n===tr.dataset.n);
      if(i>=0) openDetail(i,tr.dataset.y);
    };
    tr.onclick=go;
    tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};
  });
}

/* ---------- explorer ---------- */
/* On a phone the year columns run newest-first, so the year everyone came for
   is on screen before any sideways scrolling. The pinned club column is CSS. */
const NARROW=matchMedia('(max-width:768px)');
const yearOrder=()=>NARROW.matches?S.d.years.slice().reverse():S.d.years.slice();

function drawClubs(){
  const q=$('q').value.trim().toLowerCase(),dv=$('fdiv').value,so=$('fsort').value,Y=S.d.years;
  const YO=yearOrder(), latest=Y[Y.length-1];
  YO.forEach((y,i)=>{const el=$('yh'+(i+1)); if(el) el.textContent=shortYr(y);});
  const chip=$('clChip');
  if(chip) chip.textContent=Y.length+(S.d.inherited?' years carried in':' finished years');
  let list=S.d.clubs.filter(c=>(!dv||c.d===dv)&&(!q||c.m.toLowerCase().includes(q)||c.n.includes(q)));
  const last=c=>(c.y[Y[Y.length-1]]||{}).f??-1;
  const swing=c=>{const v=Y.map(y=>(c.y[y]||{}).f).filter(x=>x!=null);return v.length<2?-1:Math.max(...v)-Math.min(...v);};
  list.sort(so==='name'?(a,b)=>a.m.localeCompare(b.m):so==='last'?(a,b)=>last(b)-last(a)
    :so==='lastasc'?(a,b)=>last(a)-last(b):(a,b)=>swing(b)-swing(a));
  $('clubtb').innerHTML=list.map(c=>{
    // The numeral stays ink. A coloured numeral at this size is the least
    // legible use of colour and the worst case for red-green deficiency, so
    // where a figure needs a status it gets a dot beside it instead.
    const cells=YO.map(y=>{const f=(c.y[y]||{}).f;
      if(f==null) return '<td class="yrcell num" style="color:var(--muted)">—</td>';
      const now=y===latest;
      return `<td class="yrcell"><span class="yv${now?' now':''}">${
        now?`<i class="sdot" data-sig="${sig(f)}"></i>`:''}${f}</span></td>`;}).join('');
    const i=S.d.clubs.indexOf(c);
    return `<tr data-i="${i}" tabindex="0" role="button" style="cursor:pointer">
      <td class="cname"><span class="${goneFromRoster(c.n)?'gone':''}">${esc(c.m)}</span>${
        goneFromRoster(c.n)?`<span class="cgone" title="${GONE}">off roster</span>`:''
      }<span class="cmeta">${esc(c.d)}/${esc(c.a)} · ${esc(c.n)}</span></td>
      <td class="num">${esc(c.d)}/${esc(c.a)}</td>${cells}
      <td>${spark(Y.map(y=>(c.y[y]||{}).f??null))}</td></tr>`;}).join('');
  $('clubtb').querySelectorAll('tr').forEach(tr=>{
    const go=()=>openDetail(+tr.dataset.i);
    tr.onclick=go;tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};});
  $('clubnote').textContent=`${list.length} of ${S.d.clubs.length} clubs`;
}

/* ---------- charts ---------- */
const TARGETS=[4,2,2,2,1,1,4,4,4,4,1,1];
const SHORT=["Level 1 awards","Level 2 awards","More Level 2 awards","Level 3 awards",
"Level 4 / Path Completion / DTM","A second Level 4 / PC / DTM","New members (4)","More new members (4)",
"Officers trained, Jun–Aug","Officers trained, Nov–Feb","Renewal dues on time","Officer list on time"];
function drawGoalGap(){
  const live=S.year===LIVE;
  if(live?!S.l:!S.d) return;
  fillYearSelect($('sgYear'));
  const chip=$('sgChip');
  if(chip) chip.textContent=live?shortYr(S.l.py)+' \u00b7 in progress'
    :shortYr(S.year)+(S.d.inherited?' \u00b7 carried in':' \u00b7 closed');

  // the twelve report rows, from whichever document holds the year on screen
  const rows=live?S.l.clubs.map(c=>c.v).filter(Boolean)
    :S.d.clubs.map(c=>c.y[S.year]).filter(v=>v&&v.g).map(v=>v.g);
  const pct=SHORT.map((_,j)=>{
    const met=rows.filter(g=>g[j]!=null&&g[j]>=TARGETS[j]).length;
    return {j,p:rows.length?met/rows.length*100:0};});
  pct.sort((a,b)=>a.p-b.p);

  const cap=$('ggCap');
  if(cap) cap.innerHTML=live
    ? `Share of clubs that have met each goal so far in <b>${esc(S.l.py)}</b>, as of ${
        esc(S.l.asof||'\u2014')}. Sorted worst first \u2014 the top of this list is where district
        support buys the most goals before 30 June.`
    : `Share of clubs that met each goal in <b>${esc(S.year)}</b>. Sorted worst first \u2014 the top of
       this list is where district support buys the most goals.`;

  $('goalgap').innerHTML=pct.map(g=>{
    // mid-year a share is a pace, not a verdict: almost nobody has a Level 2
    // award in October and that is not a goal going missing, so the open year
    // is unbanded and the order carries the point on its own
    const col=live?'var(--muted)':g.p>=60?'var(--green)':g.p>=35?'var(--amber)':'var(--red)';
    return `<div class="barrow"><div class="barlab">${esc(SHORT[g.j])}</div>
      <div class="bartrack"><div class="barfill" style="width:${g.p.toFixed(1)}%;background:${col}"></div></div>
      <div class="barval">${Math.round(g.p)}%</div></div>`;}).join('');
}
function drawTrend(){
  const Y=S.d.years;
  const cnt=Y.map(y=>{const o={g:0,a:0,r:0};
    S.d.clubs.forEach(c=>{const f=(c.y[y]||{}).f;if(f==null)return;o[sig(f)]++;});return o;});
  const max=Math.max(...cnt.map(o=>o.g+o.a+o.r));
  $('trend').innerHTML=cnt.map(o=>{
    const tot=o.g+o.a+o.r,h=tot/max*100;
    // the count sits on the fill, so it takes the fill's own ink
    const seg=(v,c)=>v?`<div class="seg" style="height:${v/tot*100}%;background:${c}">${
      v>=7?`<span class="segn" style="color:${on(c)}">${v}</span>`:''}</div>`:'';
    return `<div class="stackcol" style="height:${h}%">${seg(o.g,'var(--green)')}${seg(o.a,'var(--amber)')}${seg(o.r,'var(--red)')}</div>`;
  }).join('');
  $('trendlabs').innerHTML=Y.map(y=>`<div class="stacklab" style="flex:1">${shortYr(y)}</div>`).join('');
}
function drawDivisions(){
  const live=S.year===LIVE;
  if(live?!S.l:!S.d) return;
  const Y=(S.d&&S.d.years)||[];
  // a partial year against a finished one is not a comparison, so the open
  // year carries no marker and no arrow
  const prev=live?null:Y[Y.indexOf(S.year)-1];

  const agg={};
  const add=(d,v,key)=>{if(!d)return;(agg[d]=agg[d]||{cur:[],pre:[]});if(v!=null)agg[d][key].push(v);};
  if(live) S.l.clubs.forEach(c=>add(c.d,c.met,'cur'));
  else S.d.clubs.forEach(c=>{
    add(c.d,(c.y[S.year]||{}).f,'cur');
    if(prev) add(c.d,(c.y[prev]||{}).f,'pre');});

  const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
  const list=Object.keys(agg).sort().map(d=>({d,cur:avg(agg[d].cur),pre:avg(agg[d].pre),n:agg[d].cur.length}))
    .filter(r=>r.cur!=null).sort((a,b)=>b.cur-a.cur);

  const cap=$('dvCap');
  if(cap) cap.innerHTML=live
    ? `Average goals met so far per club by division, <b>${esc(S.l.py)}</b>, as of ${
        esc(S.l.asof||'\u2014')}. No marker and no banding: the year has not finished, so there is
        nothing yet to compare it against.`
    : `Average year-end goals per club by division, <b>${esc(S.year)}</b>.`+(prev
        ? ` The marker shows where the division sat in ${esc(prev)} \u2014 bars past it gained ground,
           bars short of it lost ground.`
        : ` This is the first year on the board, so there is nothing before it to mark.`);

  $('divbars').innerHTML=list.map(r=>{
    const w=r.cur/10*100;
    const col=live?'var(--muted)':r.cur>=5?'var(--green)':r.cur>=3?'var(--amber)':'var(--red)';
    const gh=r.pre!=null?`<div class="ghost" style="left:${(r.pre/10*100).toFixed(1)}%" title="${esc(prev||'')}: ${r.pre.toFixed(1)}"></div>`:'';
    const dir=r.pre!=null?(r.cur-r.pre):null;
    return `<div class="barrow"><div class="barlab"><b>Division ${esc(r.d)}</b>
        <span style="color:var(--muted)">\u00b7 ${r.n} clubs</span></div>
      <div class="bartrack" style="height:20px"><div class="barfill" style="width:${w.toFixed(1)}%;background:${col}"></div>${gh}</div>
      <div class="barval">${r.cur.toFixed(1)}${dir==null?'':
        `<span style="color:${ink(dir>=0?'var(--green)':'var(--red)')};font-size:11px"> ${dir>=0?'\u25b2':'\u25bc'}</span>`}</div></div>`;
  }).join('');
}

/* ---------- detail ---------- */
function fmtDay(iso){
  if(!iso) return '';
  const d=new Date(iso+'T00:00:00');
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
// Rows 9+10 earn one goal, and so do rows 11+12, so ten goals cover twelve rows.
const GOALROWS=[[0],[1],[2],[3],[4],[5],[6],[7],[8,9],[10,11]];


/* Where else this club has been. A club number survives a realignment and a
   district does not: 6,823 of 20,868 clubs changed district for 2026-27, so a
   club's finished years and its year in progress can sit in different
   districts. The build writes the other districts onto the club as `o`. */
function awayYears(clubNo){
  const h=S.d?S.d.clubs.find(c=>c.n===clubNo):null;
  const l=S.l?S.l.clubs.find(c=>c.n===clubNo):null;
  const map={};
  [(h&&h.o)||[],(l&&l.o)||[]].forEach(list=>list.forEach(pair=>{
    const d=pair[0]; map[d]=map[d]||new Set();
    (pair[1]||[]).forEach(y=>map[d].add(y));
  }));
  return map;
}

/* The drawer can move between years without closing. A club's division and
   area belong to the year in view, so switching years reprints the header —
   which is the point: the same club sits in different areas across years.
   A year the club spent in another district is a chip here too: it is the same
   club, and the whole reason a reader opened it is to follow its record. */
function renderYearPicker(clubNo, active){
  const box=$('dyears'); if(!box) return;
  const club=S.d?S.d.clubs.find(c=>c.n===clubNo):null;
  const live=S.l?S.l.clubs.find(c=>c.n===clubNo):null;
  const years=club?(S.d.years||[]).filter(y=>club.y[y]):[];

  const items=years.map(y=>({y,key:y,label:shortYr(y)}));
  if(live) items.push({y:(S.l.py||''),key:'__live',live:true,
                       label:(S.l.py?shortYr(S.l.py):'now')+' · in progress'});
  const mine=new Set(items.map(i=>i.y));
  const away=awayYears(clubNo);
  Object.keys(away).forEach(d=>away[d].forEach(y=>{
    if(mine.has(y)) return;                 // this district's own record wins
    items.push({y,key:'@'+d+'|'+y,away:d,label:`${shortYr(y)} · D${d}`});
  }));
  if(!items.length){box.innerHTML='';return;}
  items.sort((a,b)=>a.y<b.y?-1:a.y>b.y?1:0);

  box.innerHTML=items.map(i=>
    `<button class="dyr${i.live?' now':''}${i.away?' away':''}" data-y="${esc(i.key)}"`+
    `${i.away?` title="Read this club's ${esc(i.y)} record, which District ${esc(i.away)} holds"`:''}`+
    // an away chip no longer leaves the page, so it takes a pressed state like the rest
    ` aria-pressed="${i.key===active}">${esc(i.label)}</button>`
  ).join('');

  box.querySelectorAll('.dyr').forEach(b=>b.onclick=()=>{
    const k=b.dataset.y;
    if(k==='__live') return renderLive(S.l,clubNo,null);
    if(k.charAt(0)==='@'){
      const cut=k.indexOf('|');
      return openAway(k.slice(1,cut),k.slice(cut+1),clubNo,b);
    }
    const i=S.d.clubs.findIndex(c=>c.n===clubNo);
    if(i>=0) openDetail(i,k);
  });
}

/* The club's record in another district, read into the drawer already open.
   This used to be a navigation — ?d=227&c=… — which answered a question about one
   club by swapping the board, the wordmark and the URL for a district the
   reader never asked to visit. The drawer is the only thing on this page
   scoped to a club rather than a district, so it is where a year belonging to
   neither should land. Both documents are fetched because the year wanted may
   be that district's open one or a finished one, and kept because a reader
   following a club tends to look at more than one of its years. */
const AWAY={};
function fetchAway(did){
  if(AWAY[did]) return AWAY[did];
  const meta=(S.index&&S.index.districts&&S.index.districts[did])||{};
  const one=(name,hash)=>fetch(`d/${did}/${name}${hash?`?v=${hash}`:''}`)
    .then(r=>r.ok?r.json():null).catch(()=>null);
  return AWAY[did]=Promise.all([one('data.json',meta.vd),one('live.json',meta.v)])
    .then(([d,l])=>({d,l}));
}

/* A fetch that fails leaves nothing honest to show in the drawer, so the old
   navigation stays as the floor: the record is real and it is over there. It
   does not write the district to localStorage, so a reader who lands there by
   this route is not moved there permanently. */
function openAway(did,year,clubNo,btn){
  const give=()=>location.assign(
    `?d=${encodeURIComponent(did)}&c=${encodeURIComponent(clubNo)}`);
  btn.classList.add('wait');
  return fetchAway(did).then(({d,l})=>{
    btn.classList.remove('wait');
    if(l&&l.py===year&&l.clubs.some(c=>c.n===clubNo)) return renderLive(l,clubNo,did);
    const c=d&&d.clubs.find(x=>x.n===clubNo);
    if(c&&c.y[year]) return renderDetail(d,l,c,year,did);
    give();
  }).catch(()=>{btn.classList.remove('wait');give();});
}

/* ?c=<club number> opens that club as soon as its district's data lands.
   Whichever document arrives first and holds the club wins; the year picker
   then offers every other year the club has, here or elsewhere. */
function openAskedClub(){
  if(!S.askedClub) return;
  const n=S.askedClub;
  if(S.l&&S.l.clubs.some(c=>c.n===n)){S.askedClub=null;return openLiveDetail(n);}
  if(S.d){
    const i=S.d.clubs.findIndex(c=>c.n===n);
    if(i>=0){S.askedClub=null;return openDetail(i);}
  }
}

function openLiveDetail(n){ renderLive(S.l,n,null); }

/* The open year, from this district's live document or another district's. */
function renderLive(L,n,away){
  const c=L.clubs.find(x=>x.n===n); if(!c) return;
  const net=c.ng, memcol=c.memok?'var(--green)':'var(--red)';
  $('dname').textContent=c.m;
  $('dsub').innerHTML=`${esc(c.n)} · Division ${esc(c.d)} / Area ${esc(c.a)} · `+
    `<b style="color:var(--ink)">${esc(L.py)} in progress</b> · as of ${esc(L.asof||'')}`+
    (away?` · <b style="color:var(--ink)">District ${esc(away)}</b>`:'');
  const card=(k,v,col,extra)=>`<div class="dcard"><div class="k">${k}</div>`+
    (extra?`<div style="margin-top:9px">${v}</div>`:`<div class="v" style="color:${ink(col)||'var(--ink)'}">${v}</div>`)+`</div>`;
  $('dgrid').innerHTML=
     card('Goals met so far',`${c.met}<span style="font-size:15px;color:var(--muted)">/10</span>`,
          c.met>=5?'var(--green)':c.met>=3?'var(--amber)':'var(--red)')
   + card('Members',c.md??'—',memcol)
   + card('Membership base',c.mb??'—')
   + card('Net growth',net==null?'—':(net>0?'+':'')+net,
          net==null?'var(--muted)':net>0?'var(--green)':net<0?'var(--red)':'var(--ink)')
   + card('Where it stands',c.now?badge(c.now+' Distinguished'):'<span class="badge">Not yet Distinguished</span>',null,true)
   + card('Best still possible',c.best?badge(c.best+' Distinguished'):'<span class="badge">Distinguished out of reach</span>',null,true)
   + card('Club Success Plan',cspMark(c.csp),null,true)
   + card('Days to 30 June',L.days,'var(--maroon-ink)');

  $('dgoals').innerHTML=L.goals.map((g,j)=>{
    const st=c.st[j], rows=GOALROWS[j];
    const icon=st==='m'?'\u2713':st==='d'?'\u2715':'';
    // a single-row goal already carries its name above, so only pairs need labelling
    const detail=rows.map(r=>{
      const v=c.v[r], t=(L.targets||TARGETS)[r], n=v==null?'—':v;
      return rows.length>1?`${esc(L.rows[r])} ${n} / ${t}`:`${n} of ${t}`;
    }).join('  ·  ');
    const when=st==='m'?'<span class="gwhen" style="color:var(--green-ink)">done</span>'
      :st==='d'?`<span class="gwhen" style="color:var(--red-ink)">closed ${esc(fmtDay(c.why[j]))}</span>`
      :`<span class="gwhen">by ${esc(fmtDay(c.why[j]))}</span>`;
    return `<div class="goalrow${st==='d'?' shut':''}">
      <span class="gtick" data-m="${st==='m'?1:st}">${icon}</span>
      <span class="gname">${esc(g)}<span class="gsub">${detail}</span></span>${when}</div>`;
  }).join('');
  renderYearPicker(c.n,away?'@'+away+'|'+L.py:'__live');
  $('ddl').style.display='none';           // per-club export is a finished-year feature
  $('detail').classList.add('open');$('dclose').focus();
}

/* A year this district carries but did not live through is filed under the
   division the club sits in today, which is the useful read and not what the
   archive says. Naming the district that actually held it keeps the drawer
   straight about that, and tells a reader of an away year which board they
   have in front of them. */
function heldBy(D,c,yr,away){
  if(away) return ` · <b style="color:var(--ink)">District ${esc(away)}</b>`;
  if(!D.inherited) return '';
  const held=(c.o||[]).find(p=>(p[1]||[]).indexOf(yr)>=0);
  return held?` · held by <b style="color:var(--ink)">District ${esc(held[0])}</b> that year`:'';
}

function openDetail(i,want){ renderDetail(S.d,S.l,S.d.clubs[i],want,null); }

/* One club's finished year. `D` and `L` are the documents it is read from —
   this district's, or another district's when the reader opened a year the
   club spent elsewhere. `away` is that district's id. */
function renderDetail(D,L,c,want,away){
  const Y=D.years;
  const yr=(want&&c.y[want])?want:(c.y[S.year]?S.year:(Y.filter(k=>c.y[k]).pop()||Y[Y.length-1]));
  const y=c.y[yr]||{};
  $('dname').textContent=c.m;
  const now=L?L.clubs.find(x=>x.n===c.n):null;
  const yd=y.d||c.d, ya=y.a||c.a;
  const moved=now&&(now.d!==yd||now.a!==ya)?` · now Division ${now.d} / Area ${now.a}`:'';
  $('dsub').innerHTML=`${esc(c.n)} · Division ${esc(yd)} / Area ${esc(ya)} in ${esc(yr)}`+
    (moved?`<span style="color:var(--ink)">${esc(moved)}</span>`:'')+
    (!now&&L?' · no longer in the district':'')+heldBy(D,c,yr,away);
  const net=(y.md!=null&&y.mb!=null)?y.md-y.mb:null;
  $('dgrid').innerHTML=[
    ['Goals met',y.f??'—',y.f==null?'var(--muted)':sig(y.f)==='g'?'var(--green)':sig(y.f)==='a'?'var(--amber)':'var(--red)'],
    ['Members',y.md??'—','var(--ink)'],['Membership base',y.mb??'—','var(--ink)'],
    ['Net growth',net==null?'—':(net>0?'+':'')+net,net==null?'var(--muted)':net>0?'var(--green)':net<0?'var(--red)':'var(--ink)'],
  ].map(([k,v,col])=>`<div class="dcard"><div class="k">${k}</div><div class="v" style="color:${ink(col)}">${v}</div></div>`).join('')
   +`<div class="dcard"><div class="k">Status</div><div style="margin-top:8px">${badge(y.st)}</div></div>`
   +`<div class="dcard"><div class="k">Club Success Plan</div><div style="margin-top:9px">${
       y.csp?cspMark(y.csp,true)
            :`<span class="csp" data-v="u"><span class="cspd">?</span>Not tracked in ${esc(yr)}</span>`}</div></div>`
   +`<div class="dcard"><div class="k">Five-year trace</div><div style="margin-top:8px">${spark(Y.map(k=>(c.y[k]||{}).f??null))}</div></div>`;
  $('dgoals').innerHTML=y.g?D.goals.map((g,j)=>{
    const v=y.g[j],met=v!=null&&v>=TARGETS[j];
    return `<div class="goalrow"><span class="gtick" data-m="${met?1:0}">${met?'✓':''}</span>
      <span class="gname">${esc(g)}</span><span class="num">${v??'—'}<span
        style="color:var(--muted)"> / ${TARGETS[j]}</span></span></div>`;}).join('')
    :'<p style="color:var(--muted);font-size:13.5px">No goal detail for this year.</p>';
  renderYearPicker(c.n,away?'@'+away+'|'+yr:yr);
  $('ddl').style.display='';
  $('ddl').onclick=()=>saveBlob(clubXlsx(c,D,L),
    `${c.m.replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'')}_DCP.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  $('detail').classList.add('open');$('dclose').focus();
}
/* The table's toolbar is static markup and outlives every redraw, so it is
   wired once here rather than from whichever document happened to land. */
['lq','lfdiv','lfcsp'].forEach(id=>{
  const el=$(id); if(!el) return;
  el.oninput=drawYearTable; el.onchange=drawYearTable;
});
// the year is not a filter on the table, it is the board's year
{
  const yp=$('lfyear');
  if(yp) yp.onchange=()=>setYear(yp.value);
  const sy=$('sgYear');
  if(sy) sy.onchange=()=>setYear(sy.value);
}

$('dclose').onclick=()=>{
  $('detail').classList.remove('open');
  // ?c= was a way in, not a state to keep: a reload should show the district.
  if(history.replaceState&&new URLSearchParams(location.search).get('c')){
    try{history.replaceState(null,'',`?d=${encodeURIComponent(S.did||'')}`);}catch(e){}
  }
};
addEventListener('keydown',e=>{if(e.key==='Escape')$('detail').classList.remove('open');});

/* ---------- in-year / live ---------- */
const LVL=[[10,"Smedley"],[9,"President's"],[7,"Select"],[5,"Distinguished"]];
const fmtDate=iso=>{if(!iso)return'—';const [y,m,d]=iso.split('-').map(Number);
  return d+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]+' '+y;};
const daysTo=iso=>{if(!iso)return null;
  return Math.round((new Date(iso+'T00:00:00')-new Date(S.l.today+'T00:00:00'))/864e5);};

function drawLive(){
  const L=S.l,a=L.agg;
  $('lvPy').textContent=shortYr(L.py);
  // the snapshot date leads both in-year headings: it is the first thing an
  // area director needs before trusting a figure on either
  const up=$('lvUpd'); if(up) up.textContent=L.asof||'—';

  $('lvTally').innerHTML=[
    ['Distinguished already',a.dist_now,a.dist_now?'var(--green)':'var(--muted)'],
    ['Can still reach it',a.dist_live,'var(--ink)'],
    ['Can no longer reach it',a.dist_out,a.dist_out?'var(--red)':'var(--muted)'],
    ['Average goals met',a.avg_met.toFixed(2),'var(--ink)'],
    ['Meet the membership rule',a.memok+'/'+a.clubs,'var(--ink)']
  ].map(([k,v,c])=>`<div class="tallyitem"><div class="tallyn" style="color:${ink(c)}">${v}</div>
    <div class="tallyl">${k}</div></div>`).join('');

  $('lvDl').innerHTML=(a.close||[]).map(c=>{
    const u=!c.open?0:c.days<=14?1:c.days<=60?2:0;
    return `<div class="dlrow" data-u="${u}">
      <span class="dldays">${c.days}d</span>
      <span class="dlname">${esc(c.lbl)}<small>closes ${esc(fmtDate(c.date))}${
        c.open?'':' · opens '+esc(fmtDate(c.opens))}</small></span>
      <span class="dlcnt">${c.open?`<b>${c.clubs}</b>clubs short`
        :'<span style="opacity:.7">not open yet</span>'}</span></div>`;}).join('')
    ||'<p style="color:var(--muted);font-size:13.5px">Nothing else closes before 30 June.</p>';

  // how many clubs sit at each goal count, worst first
  const cnt={};L.clubs.forEach(c=>{cnt[c.met]=(cnt[c.met]||0)+1;});
  const max=Math.max(...Object.values(cnt));
  $('lvBars').innerHTML=Object.keys(cnt).map(Number).sort((x,y)=>x-y).map(k=>{
    const col=k>=5?'var(--green)':k>=3?'var(--amber)':'var(--red)';
    return `<div class="barrow"><div class="barlab">${k} goal${k===1?'':'s'} met</div>
      <div class="bartrack"><div class="barfill" style="width:${(cnt[k]/max*100).toFixed(1)}%;background:${col}"></div></div>
      <div class="barval">${cnt[k]}</div></div>`;}).join('');

  $('lvXlsx').href=`d/${S.did}/inyear.xlsx`;
  $('lvXlsx').setAttribute('download',`${dprefix()}_InYear_${L.py}.xlsx`);
  $('lvXlsxMeta').textContent=`Excel workbook · ${a.clubs} clubs · snapshot ${L.asof||'—'}`;
}

/* The board and the five-year table both list clubs the district has since
   lost. live.json carries today's roster, so a club absent from it is no
   longer the district's — closed, merged or moved out. The two files are
   fetched independently, so until live.json lands nothing is marked: an
   unmarked club is never a wrong claim, a marked one would be. */
function goneFromRoster(n){
  if(!S.l||!S.l.clubs) return false;
  if(!S.roster) S.roster=new Set(S.l.clubs.map(c=>c.n));
  return !S.roster.has(n);
}
const GONE='no longer in the district roster';

// submitted sorts above not-submitted; unknown last
/* The export publishes the Club Success Plan as Y or N. It used to be a
   sentence on the club report page, and the test for it was /Met/ — which is
   false for both "Y" and "N", so every club read as having no plan whether it
   had one or not. 0 has a plan, 1 has none, 2 is a year that did not publish
   the column at all; the sort and the filter both lean on that order. */
function cspRank(v){
  const c=String(v||'').trim().toUpperCase().slice(0,1);
  if(c==='Y') return 0;
  if(c==='N') return 1;
  return 2;
}
function setLiveSort(k){
  // a new column starts ascending; the active one reverses
  S.lvSort = (S.lvSort.k===k) ? {k,dir:-S.lvSort.dir} : {k,dir:1};
  drawYearTable();
}
function memCell(c){
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
function cspMark(v,closed){
  const r=cspRank(v);
  if(r===2) return `<span class="csp" data-v="u" title="Not tracked this year"><span class="cspd">?</span>—</span>`;
  const y=r===0;
  // "Not yet" only reads right while the year can still change
  return `<span class="csp" data-v="${y?'y':'n'}"><span class="cspd">${y?'\u2713':'\u2715'}</span>${
    y?'Submitted':(closed?'Not submitted':'Not yet')}</span>`;
}
/* ---------- the club table, for whichever year the board is showing ----------
   This was "The Current Year", a second club table in a second section with a
   second toolbar, showing the same open year the board above already had a
   pill for. One year picker drives both now. The open year and a finished one
   are different documents and want different last columns \u2014 a deadline means
   something only while it can still be met, a recognition badge only once the
   year has stopped moving \u2014 so the head is drawn here rather than in markup. */
const GOAL10=["Level 1 awards","Level 2 awards","More Level 2 awards","Level 3 awards",
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
function fillYearSelect(sel){
  if(!sel||!S.d) return;
  const opts=(S.d.years||[]).map(y=>[y,y]);
  if(S.l&&S.l.py) opts.push([LIVE,S.l.py+' \u00b7 now']);
  const sig=opts.map(o=>o[0]).join(',');
  if(sel.dataset.sig!==sig){
    sel.dataset.sig=sig;
    sel.innerHTML=opts.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');
  }
  if(sel.value!==S.year) sel.value=S.year;
}

/* Every year-scoped section redraws together, from whichever control moved. */
function setYear(y){
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
    sel.innerHTML='<option value="">All divisions</option>'+
      divs.map(x=>`<option value="${esc(x)}">Division ${esc(x)}</option>`).join('');
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

function drawYearTable(){
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
  const head=(key,lbl,cls)=>`<th${key?` data-k="${key}" tabindex="0"`:''}${
    cls?` class="${cls}"`:''}>${lbl}${key?'<span class="ar">\u25b2</span>':''}</th>`;
  $('lvth').innerHTML='<tr>'+head('name','Club')+head('div','Div')+head('met','Score')
    +head('','Ten goals')+head('mem','Members')
    +head('last',live?'Next deadline':'Recognition')+'</tr>';

  $('lvtb').innerHTML=list.map(c=>{
    const pips=(c.st||[]).map((v,i)=>`<span class="pip" data-s="${v}" title="${esc(c.goals[i]||'')}: ${
      v==='m'?'achieved':v==='o'?'still reachable':live?'window closed':'not achieved'}"></span>`).join('')
      ||'<span class="lvnone">no goal detail</span>';
    const d=live?daysTo(c.nd):null;
    // colour appears only where it decides something: the chip is the one that
    // says act this month. The score itself is a rank, and stays ink.
    const urg=(d!=null&&d<=30)?`<span class="lvurg" title="closes in ${d} days">${d}d</span>`:'';
    // the Success Plan is a boolean that used to compete with the score for a
    // whole column; it rides on the club line, and only when it is missing
    const plan=cspRank(c.csp)===1?`<span class="lvplan" title="No Club Success Plan${
      live?' yet':''}">No Club Success Plan</span>`:'';
    const off=c.gone?`<span class="lvplan" title="${esc(GONE)}">off roster</span>`:'';
    const short=c.short?`<span class="lvshort" title="The archive's goal rows account for ${
      c.met-c.short} of the ${c.met} goals the dashboard credited this club">rows short</span>`:'';
    const last=live
      ? `<span class="lvnd">${urg}<span class="lvdate">${c.nd?esc(fmtDate(c.nd)):'\u2014'}</span>
         <span class="lvwin">${esc(c.ndl||'')}</span></span>`
      : badge(c.recog);
    return `<tr class="lvrow" tabindex="0" role="button" data-n="${esc(c.n)}">
      <td><span class="lvname${c.gone?' gone':''}" title="${esc(c.m)}">${esc(c.m)}</span><span class="lvnum">${
        esc(String(Number(c.n)))}${plan}${off}${short}</span></td>
      <td class="lvdiv">${esc(c.d||'\u2014')}</td>
      <td><span class="lvscore"><b>${c.met}</b><span>/10</span></span></td>
      <td class="lvpips"><span class="pips">${pips}</span></td>
      <td>${memCell(c)}</td>
      <td>${last}</td></tr>`;}).join('')
    ||`<tr><td colspan="6" style="color:var(--muted);padding:18px 14px">No clubs match.</td></tr>`;

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
    tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};
  });

  const H=$('bdTblHead'), C=$('bdTblChip'), L=$('bdTblLede'), K=$('lvKey');
  if(H) H.textContent=live?'Every Club, This Year':'Every Club That Year';
  if(C) C.textContent=live?shortYr(S.l.py)+' \u00b7 in progress'
    :shortYr(S.year)+(S.d.inherited?' \u00b7 carried in':' \u00b7 closed');
  if(L) L.innerHTML=live
    ? `Every club as of <b>${esc(S.l.asof||'\u2014')}</b>. Sorted by score, lowest last.`
    : `Every club at the close of ${esc(S.year)}. Sorted by score, lowest last.`;
  if(K) K.innerHTML=`<span><span class="pip" data-s="m"></span> achieved</span>`+
    (live?`<span><span class="pip" data-s="o"></span> still reachable</span>
      <span><span class="pip" data-s="d"></span> window closed</span>`
        :`<span><span class="pip" data-s="d"></span> not achieved</span>`);
  $('lvNote').textContent=live
    ? `${list.length} of ${rows.length} clubs \u00b7 snapshot ${S.l.asof||'\u2014'}`
    : `${list.length} of ${rows.length} clubs \u00b7 ${S.year} as the archive closed it`;
}

/* ---------- a very small .xlsx writer ----------
   Enough of the OOXML package to emit a genuine workbook from the browser
   with no library: a ZIP of stored (uncompressed) parts. The rest of this
   page has no external JS and no build step; this keeps it that way. */
const CRCT=(()=>{const t=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}
  return t;})();
const crc32=u8=>{let c=0xFFFFFFFF;
  for(let i=0;i<u8.length;i++)c=CRCT[(c^u8[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
const U8=s=>new TextEncoder().encode(s);

function zipStore(files){
  const chunks=[],cd=[];let off=0;
  files.forEach(f=>{
    const nm=U8(f.name),crc=crc32(f.data),sz=f.data.length;
    const lh=new Uint8Array(30+nm.length),lv=new DataView(lh.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0,true);
    lv.setUint16(8,0,true);lv.setUint16(10,0,true);lv.setUint16(12,0x2821,true);
    lv.setUint32(14,crc,true);lv.setUint32(18,sz,true);lv.setUint32(22,sz,true);
    lv.setUint16(26,nm.length,true);lv.setUint16(28,0,true);lh.set(nm,30);
    chunks.push(lh,f.data);
    const ch=new Uint8Array(46+nm.length),cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
    cv.setUint16(8,0,true);cv.setUint16(10,0,true);cv.setUint16(12,0,true);
    cv.setUint16(14,0x2821,true);cv.setUint32(16,crc,true);cv.setUint32(20,sz,true);
    cv.setUint32(24,sz,true);cv.setUint16(28,nm.length,true);cv.setUint16(30,0,true);
    cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);
    cv.setUint32(38,0,true);cv.setUint32(42,off,true);ch.set(nm,46);
    cd.push(ch); off+=lh.length+sz;
  });
  const cdSize=cd.reduce((n,b)=>n+b.length,0);
  const end=new Uint8Array(22),ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);
  ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);
  ev.setUint32(12,cdSize,true);ev.setUint32(16,off,true);ev.setUint16(20,0,true);
  const all=[...chunks,...cd,end];
  const out=new Uint8Array(all.reduce((n,b)=>n+b.length,0));
  let q=0; all.forEach(b=>{out.set(b,q);q+=b.length;});
  return out;
}

const xe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const colName=n=>{let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=(n-m-1)/26;}return s;};
// styles: 0 plain, 1 bold, 2 met(green), 3 short(pink), 4 closed(grey), 5 header, 6 title
function sheetXml(rows,widths){
  const cols=widths&&widths.length?'<cols>'+widths.map((w,i)=>
    `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')+'</cols>':'';
  const body=rows.map((r,ri)=>{
    const cells=r.map((c,ci)=>{
      if(c==null||c==='')return '';
      const o=(typeof c==='object'&&c!==null&&'v' in c)?c:{v:c};
      const ref=colName(ci)+(ri+1), st=o.s?` s="${o.s}"`:'';
      return (typeof o.v==='number'&&isFinite(o.v))
        ? `<c r="${ref}"${st}><v>${o.v}</v></c>`
        : `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xe(o.v)}</t></is></c>`;
    }).join('');
    return `<row r="${ri+1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`;
}

function buildXlsx(sheets){
  const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="6"><fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD6EBDA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFBE0DD"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE4E9ED"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf xfId="0"/>
<xf xfId="0" fontId="1" applyFont="1"/>
<xf xfId="0" fillId="2" applyFill="1"/>
<xf xfId="0" fillId="3" applyFill="1"/>
<xf xfId="0" fillId="4" applyFill="1"/>
<xf xfId="0" fontId="2" fillId="5" applyFont="1" applyFill="1"/>
<xf xfId="0" fontId="3" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s,i)=>`<sheet name="${xe(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
  const wbr=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}
<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const files=[{name:'[Content_Types].xml',data:U8(ct)},{name:'_rels/.rels',data:U8(rels)},
    {name:'xl/workbook.xml',data:U8(wb)},{name:'xl/_rels/workbook.xml.rels',data:U8(wbr)},
    {name:'xl/styles.xml',data:U8(STYLES)}];
  sheets.forEach((s,i)=>files.push({name:`xl/worksheets/sheet${i+1}.xml`,
    data:U8(sheetXml(s.rows,s.widths))}));
  return zipStore(files);
}

function saveBlob(bytes,name,mime){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([bytes],{type:mime}));
  a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

/* ---------- one club, as a workbook ----------
   What an area director opens next to a club officer: where the club stands
   in the open year, which goals are still reachable, and the five closed
   years behind it. */
function clubXlsx(c,D,L){
  D=D||S.d; L=L===undefined?S.l:L;
  const Y=D.years, G12=D.goals, live=L?L.clubs.find(x=>x.n===c.n):null;
  const H=v=>({v,s:5}), B=v=>({v,s:1}), T=v=>({v,s:6});
  const rows=[];
  rows.push([T(c.m)]);
  rows.push([`Club ${Number(c.n)}`,`Division ${c.d||'—'}`,`Area ${c.a||'—'}`]);
  rows.push([]);

  if(live){
    rows.push([B(`Open year ${L.py} — dashboard snapshot ${L.asof||'—'}`)]);
    rows.push([`${L.days} days remain until 30 June ${L.py.slice(-4)}, when this becomes final.`]);
    rows.push([]);
    rows.push([H('Goals met'),H('Of'),H('Ceiling'),H('Best still possible'),
               H('Members'),H('Base'),H('Net growth'),H('Meets membership rule')]);
    rows.push([live.met,10,live.ceil,live.best||'none',live.md,live.mb,live.ng,
               live.memok?'yes':'no']);
    rows.push([]);
    rows.push([H('Goal'),H('Needs'),H('To date'),H('Status'),H('Act by')]);
    // the twelve printed rows, mapped onto the ten goals they earn
    const OWNER=[0,1,2,3,4,5,6,7,8,8,9,9];
    G12.forEach((g,j)=>{
      const need=(L.targets||TARGETS)[j], v=live.v[j], st=live.st[OWNER[j]];
      const met=v!=null&&v>=need;
      const style=met?2:(st==='d'?4:3);
      rows.push([{v:g,s:style},{v:need,s:style},{v:v==null?'—':v,s:style},
        {v:met?'met':(st==='d'?'window closed':'still reachable'),s:style},
        {v:met?'':fmtDate(L.acts[j]),s:style}]);
    });
    rows.push([]);
    rows.push(['Rows 9 and 10 together earn one goal, and so do rows 11 and 12.']);
    rows.push([`That is why "goals met" is ${live.met} of 10, not a count of ticks above.`]);
    rows.push([]);
  }

  rows.push([B('Closed years')]);
  rows.push([H('Year'),H('Goals met'),H('Status'),H('Members'),H('Base'),H('Net growth')]);
  Y.forEach(y=>{
    const d=c.y[y]; if(!d)return;
    const net=(d.md!=null&&d.mb!=null)?d.md-d.mb:null;
    rows.push([y,d.f==null?'—':d.f,d.st||'—',d.md==null?'—':d.md,
               d.mb==null?'—':d.mb,net==null?'—':net]);
  });
  rows.push([]);
  rows.push([B('Goal detail by closed year')]);
  rows.push([H('Goal'),H('Needs'),...Y.map(y=>H(shortYr(y)))]);
  G12.forEach((g,j)=>{
    const need=TARGETS[j];
    rows.push([g,need,...Y.map(y=>{
      const d=c.y[y]; if(!d||!d.g)return '';
      const v=d.g[j];
      return {v:v==null?'—':v,s:(v!=null&&v>=need)?2:3};
    })]);
  });
  rows.push([]);
  rows.push(['Source: dashboards.toastmasters.org · '+(L?L.generated:'')]);

  const widths=[46,9,11,17,12,10,13,22];
  return buildXlsx([{name:'Club',rows,widths}]);
}

/* ---------- an area or a division, as a workbook ----------
   The district file is too wide for one conversation and a single club is too
   narrow for a director's patch. This is the middle: every club they are
   responsible for, and the windows about to shut on them. */
function scopeXlsx(kind,label,clubs){
  const L=S.l, Y=S.d.years, G12=S.d.goals, TG=(L&&L.targets)||TARGETS;
  const H=v=>({v,s:5}), B=v=>({v,s:1}), T=v=>({v,s:6});
  const live=c=>L?L.clubs.find(x=>x.n===c.n):null;
  const inScope=clubs.slice().sort((a,b)=>
    (a.a||'').localeCompare(b.a||'')||a.m.localeCompare(b.m));
  const lv=inScope.map(live).filter(Boolean);
  const sheets=[];

  /* --- clubs --- */
  const r1=[];
  r1.push([T(`${kind} ${label}`)]);
  r1.push([`${inScope.length} clubs`,
           L?`open year ${L.py}`:'',
           L?`dashboard snapshot ${L.asof||'—'}`:'',
           L?`${L.days} days to 30 June`:'']);
  // clubs realign between program years; a director wants the current list,
  // but should be told when it differs from the board they clicked from
  if(L){
    const yr=Y[Y.length-1];
    const moved=inScope.filter(c=>{
      const l=live(c); if(!l)return false;
      return kind==='Division' ? (c.d||'—')!==(l.d||'—')
                               : (c.d||'—')+(c.a||'—')!==(l.d||'—')+(l.a||'—');
    });
    r1.push([`Roster as it stands in ${L.py}.`]);
    if(moved.length) r1.push([`${moved.length} of these were listed elsewhere in ${yr}: `+
      moved.map(c=>`${c.m} (was ${c.d||'—'}/${c.a||'—'})`).join('; ')]);
  }
  if(lv.length){
    const avg=(lv.reduce((n,c)=>n+c.met,0)/lv.length).toFixed(2);
    r1.push([`Average goals met ${avg}`,
      `Distinguished now ${lv.filter(c=>c.met>=5).length}`,
      `Can still reach it ${lv.filter(c=>c.met<5&&c.ceil>=5).length}`,
      `No longer able to ${lv.filter(c=>c.ceil<5).length}`]);
  }
  r1.push([]);
  r1.push([H('Area'),H('Club No'),H('Club'),H('Goals met'),H('Of'),H('Ceiling'),
    H('Best still possible'),H('Members'),H('Base'),H('Net growth'),
    H('Meets membership rule'),H('Next deadline'),H('What closes then'),
    ...G12.map((g,j)=>H(`${g} (need ${TG[j]})`))]);
  inScope.forEach(c=>{
    const l=live(c);
    if(!l){ r1.push([c.a,Number(c.n),c.m,'no current data']); return; }
    const OWNER=[0,1,2,3,4,5,6,7,8,8,9,9];
    r1.push([l.a||c.a,Number(c.n),c.m,{v:l.met,s:1},10,
      {v:l.ceil,s:l.ceil<5?3:0},l.best||'none',l.md,l.mb,l.ng,
      {v:l.memok?'yes':'no',s:l.memok?0:3},
      l.nd?fmtDate(l.nd):'',l.ndl||'',
      ...G12.map((g,j)=>{
        const v=l.v[j],need=TG[j],met=v!=null&&v>=need;
        const st=l.st[OWNER[j]];
        return {v:v==null?'—':v,s:met?2:(st==='d'?4:3)};
      })]);
  });
  sheets.push({name:'Clubs',rows:r1,
    widths:[7,10,36,10,6,9,17,10,8,11,20,14,26,...G12.map(()=>13)]});

  /* --- the windows about to shut, and who is short --- */
  if(L&&L.agg.close&&L.agg.close.length){
    const ROWIDX={'Officers trained Jun-Aug':8,'Officers trained Nov-Feb':9,
                  'Renewal dues on time':10,'Officer list on time':11};
    const r2=[];
    r2.push([T('What shuts next')]);
    r2.push(['A goal here cannot be recovered once its window closes.']);
    r2.push([]);
    L.agg.close.forEach(w=>{
      const j=ROWIDX[w.lbl]; if(j==null)return;
      const short=lv.filter(c=>c.v[j]!=null&&c.v[j]<TG[j]);
      r2.push([B(w.lbl),
        w.open?`closes ${fmtDate(w.date)} — ${w.days} days`
              :`opens ${fmtDate(w.opens)}, closes ${fmtDate(w.date)}`,
        `${short.length} of ${lv.length} clubs short`]);
      if(!w.open){ r2.push(['','This window has not opened yet.']); r2.push([]); return; }
      if(!short.length){ r2.push(['','Every club here has met it.']); r2.push([]); return; }
      r2.push([H('Area'),H('Club'),H('Has'),H('Needs'),H('Short by')]);
      short.sort((a,b)=>(a.a||'').localeCompare(b.a||'')||a.m.localeCompare(b.m))
        .forEach(c=>r2.push([c.a,c.m,{v:c.v[j],s:3},TG[j],{v:TG[j]-c.v[j],s:3}]));
      r2.push([]);
    });
    sheets.push({name:'What shuts next',rows:r2,widths:[8,38,10,10,11]});
  }

  /* --- the closed years behind them --- */
  const r3=[];
  r3.push([T('Year-end goals met')]);
  r3.push([]);
  r3.push([H('Area'),H('Club'),...Y.map(y=>H(shortYr(y))),H(`Status ${shortYr(Y[Y.length-1])}`)]);
  inScope.forEach(c=>{
    const l=live(c);
    r3.push([(l&&l.a)||c.a,c.m,...Y.map(y=>{
      const f=(c.y[y]||{}).f;
      return f==null?'—':{v:f,s:f>=5?2:3};
    }),(c.y[Y[Y.length-1]]||{}).st||'—']);
  });
  sheets.push({name:'Five years',rows:r3,widths:[8,38,...Y.map(()=>9),26]});

  return buildXlsx(sheets);
}

/* Every file a reader saves is named for the district it came from, so two
   districts' workbooks do not collide in one downloads folder. */
const dprefix=()=>`District${S.did}`;

function scopeDownload(kind,label,clubs){
  saveBlob(scopeXlsx(kind,label,clubs),
    `${dprefix()}_${kind}_${String(label).replace(/[^A-Za-z0-9]+/g,'')}_DCP.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

/* ---------- masthead state ---------- */
/* Three destinations cover six sections: the two retrospective ones and the
   district charts all sit under Past years. */
(function(){
  const nav=$('mastnav'); if(!nav||!('IntersectionObserver' in window)) return;
  const OWNER={inyear:'#inyear',board:'#board',signals:'#board',movement:'#board',clubs:'#clubs'};
  const links=[...nav.querySelectorAll('a')];
  const seen=new Map();
  const mark=()=>{
    let best=null;
    seen.forEach((ratio,id)=>{if(ratio>0&&(!best||ratio>seen.get(best)))best=id;});
    const href=best?OWNER[best]:null;
    links.forEach(a=>{
      if(a.getAttribute('href')===href) a.setAttribute('aria-current','true');
      else a.removeAttribute('aria-current');
    });
  };
  const io=new IntersectionObserver(es=>{
    es.forEach(e=>seen.set(e.target.id,e.isIntersecting?e.intersectionRatio:0));
    mark();
  },{rootMargin:'-64px 0px -55% 0px',threshold:[0,.1,.35,.7,1]});
  Object.keys(OWNER).forEach(id=>{const el=$(id); if(el) io.observe(el);});
})();

/* The caveats are one click away on screen, but a printed page has no clicks —
   so every disclosure opens for the print and closes again afterwards. */
(function(){
  let reopened=[];
  addEventListener('beforeprint',()=>{
    reopened=[...document.querySelectorAll('details.howto:not([open])')];
    reopened.forEach(d=>d.open=true);
  });
  addEventListener('afterprint',()=>{reopened.forEach(d=>d.open=false);reopened=[];});
})();

/* ---------- theme ---------- */
(function(){
  const root=document.documentElement,btn=$('themetoggle');
  const isDark=()=>root.getAttribute('data-theme')==='dark'||
    (!root.hasAttribute('data-theme')&&matchMedia('(prefers-color-scheme: dark)').matches);
  const label=()=>btn.setAttribute('aria-label',isDark()?'Switch to light theme':'Switch to dark theme');
  btn.onclick=()=>{
    const next=isDark()?'light':'dark';
    root.setAttribute('data-theme',next);
    try{localStorage.setItem('tm-theme',next);}catch(e){}
    label();
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',label);
  label();
})();


/* Everything that names a district or points off-site comes from config.json,
   travels in data.json, and is applied here — so a new district is a config
   edit, not a hunt through the markup. */
function applySiteConfig(d){
  const s=d.site||{}, name=d.district||'';
  const set=(id,fn)=>{const el=$(id); if(el) fn(el);};
  if(s.description){const m=document.querySelector('meta[name="description"]');
    if(m) m.setAttribute('content',s.description);}
  if(s.eyebrow) S.eyebrow=s.eyebrow;
  setEyebrow();
  document.title=`${name||'Club Health'} \u2014 ${s.title_suffix||'Club Health Board'}`;
  if(name){ set('footSource',el=>el.textContent=name); }
  ['footRepo','navData'].forEach(id=>{ if(s.repo_url) set(id,el=>el.href=s.repo_url); });
  set('footDash',el=>{ if(d.district_id) el.href=`https://dashboards.toastmasters.org/District.aspx?id=${d.district_id}`; });
}

/* The eyebrow names the programme and the span the page covers. The span is
   read off the data — the finished years plus the open one — rather than being
   written into the config, so it is right the morning after a year rolls. */
const spanYr=y=>y.slice(0,4)+'\u2013'+y.slice(7,9);

/* Thirty districts were created this program year and have no finished years
   at all, so the deck cannot claim five of them. */
const NUM=['no','one','two','three','four','five','six'];
function yearPhrase(d,l){
  const n=((d&&d.years)||[]).length;
  if(!n) return l?'the year still running':'no finished years yet';
  // A new district's years are its clubs' years elsewhere, not a record of
  // its own, and the deck must not claim otherwise.
  const finished=(d&&d.inherited)
    ? `${NUM[n]||n} year${n===1?'':'s'} carried in`
    : `${NUM[n]||n} finished year${n===1?'':'s'}`;
  return l?`${finished} and the one still running`:finished;
}
function setYearPhrase(){
  const el=$('hYears'); if(el) el.textContent=yearPhrase(S.d,S.l);
}

/* The two documents race, so whichever lands second fills the date in: it is
   the open year's end, and only live.json knows it. */
function setNoHistoryDate(){
  if(!S.l||!S.l.end) return;
  const e=new Date(S.l.end+'T00:00:00');
  const when=$('nhWhen');
  if(when) when.textContent=e.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
}

/* A new district did not exist before the year now running, and the pills
   before that one are its clubs' years somewhere else. This used to be a
   section of its own, which gave District 227 a heading District 21 does not
   have for no gain; it is one line beside the year picker it explains. */
function setBoardOrigin(){
  const el=$('bdOrigin'); if(!el) return;
  const d=S.d;
  if(!d||!d.inherited){el.hidden=true;return;}
  const n=(d.years||[]).length;
  const born=(S.l&&S.l.py)?spanYr(S.l.py):'the year now running';
  const snap=(S.l&&S.l.asof)?`, a snapshot taken ${esc(S.l.asof)}`:'';
  const carried=n?` The ${NUM[n]||n} before it are its clubs' years in the districts `+
    `that held them \u2014 ${esc(listDistricts(d.carried||[]))}. All of them are filed here `+
    `under the division and area each club sits in today, not the one it sat in then.`:'';
  el.innerHTML=`${esc(d.district||'This district')} was formed in ${esc(born)}, so only `+
    `the last pill is its own${snap?':'+snap.slice(1):''}.${carried}`;
  el.hidden=false;
}

const districtName=did=>{
  const e=S.index&&S.index.districts&&S.index.districts[did];
  return (e&&e.name)||`District ${did}`;
};

/* "84 from District 121, 57 from District 92 and 5 from District 98" */
function listDistricts(src){
  const parts=src.map(([d,n])=>`${n} from ${districtName(d)}`);
  return parts.length<2?(parts[0]||'')
    :parts.slice(0,-1).join(', ')+' and '+parts[parts.length-1];
}
function setEyebrow(){
  const el=$('heroEyebrow'); if(!el) return;
  const Y=(S.d&&S.d.years)||[];
  const last=(S.l&&S.l.py)||Y[Y.length-1];
  const lead=S.eyebrow||el.textContent.trim();
  el.textContent=(Y.length&&last)?`${lead} \u00b7 ${spanYr(Y[0])} to ${spanYr(last)}`:lead;
}

/* index.html stamps content hashes onto the data files so a deploy cannot
   leave this script fetching a copy the preload never warmed. Falls back to
   the plain name when nothing stamped it. */
function assetUrl(name){
  return (window.__ASSETS__ && window.__ASSETS__[name]) || name;
}


/* ---------- contact ---------- */
/* This is a static site with no server of its own, so there are two ways to
   deliver a message. If site.contact_endpoint is set in config.json - a form
   service or a small Worker - the form POSTs there and the sender never leaves
   the page. While it is blank the form hands the message to the sender's own
   mail client instead, which needs no account and no key.

   The spam check is an arithmetic question plus a hidden field no person can
   see. That stops naive bots; it is not a verified captcha, which needs a
   server to check the token. */
const CONTACT={a:0,b:0};

function contactCfg(){
  const s=(S.d&&S.d.site)||{};
  // decoded only at the moment of use, so the address is never sitting in the
  // page as text for a harvester to scrape
  let to='';
  try{ if(s.contact_email_enc) to=[...atob(s.contact_email_enc)].reverse().join(''); }catch(e){}
  return {to, tag:s.contact_tag||'', endpoint:s.contact_endpoint||''};
}
function newSum(){
  CONTACT.a=2+Math.floor(Math.random()*8);
  CONTACT.b=2+Math.floor(Math.random()*8);
  const l=$('cfSumLabel');
  if(l) l.textContent=`Spam check — what is ${CONTACT.a} + ${CONTACT.b}?`;
  const f=$('cfSum'); if(f){f.value='';f.removeAttribute('aria-invalid');}
}
function setMsg(text,kind){
  const m=$('cfMsg'); if(!m) return;
  m.textContent=text||'';
  if(kind) m.setAttribute('data-t',kind); else m.removeAttribute('data-t');
}
let contactReturnFocus=null;

function openContact(){
  contactReturnFocus=document.activeElement;
  newSum(); setMsg('');
  $('contactVeil').hidden=false; $('contactModal').hidden=false;
  $('cfName').focus();
}
function closeContact(){
  $('contactVeil').hidden=true; $('contactModal').hidden=true;
  if(contactReturnFocus&&contactReturnFocus.focus) contactReturnFocus.focus();
}

function validateContact(){
  const need=[['cfName','a name'],['cfEmail','an email address'],
              ['cfSubject','a subject'],['cfBody','a message']];
  for(const [id,what] of need){
    const el=$(id);
    if(!el.value.trim()){el.setAttribute('aria-invalid','true');el.focus();
      return `Please add ${what}.`;}
    el.removeAttribute('aria-invalid');
  }
  const em=$('cfEmail');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value.trim())){
    em.setAttribute('aria-invalid','true');em.focus();
    return 'That email address does not look right.';
  }
  if($('cfHoney').value) return 'Sorry — that looked automated.';
  const sum=$('cfSum');
  if(parseInt(sum.value,10)!==CONTACT.a+CONTACT.b){
    sum.setAttribute('aria-invalid','true');sum.focus();
    newSum();
    return 'That sum was not right — here is another.';
  }
  return null;
}

async function submitContact(e){
  e.preventDefault();
  const err=validateContact();
  if(err) return setMsg(err,'err');

  const cfg=contactCfg();
  const subject=(cfg.tag?cfg.tag+' — ':'')+$('cfSubject').value.trim();
  // no recipient in the payload — the endpoint decides where mail goes, or it
  // is an open relay for anyone who finds the URL
  const payload={name:$('cfName').value.trim(), email:$('cfEmail').value.trim(),
                 subject, message:$('cfBody').value.trim()};

  if(cfg.endpoint){
    setMsg('Sending…');
    $('cfSend').disabled=true;
    try{
      const r=await fetch(cfg.endpoint,{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!r.ok) throw new Error('the server replied '+r.status);
      $('contactForm').reset(); newSum();
      setMsg('Sent. Thank you — you will get a reply by email.','ok');
    }catch(ex){
      setMsg('Could not send ('+ex.message+'). Please try again in a moment.','err');
    }finally{ $('cfSend').disabled=false; }
    return;
  }

  // no endpoint configured: hand off to the sender's mail client
  const body=`${payload.message}\n\n— ${payload.name} (${payload.email})`;
  window.location.href=`mailto:${encodeURIComponent(cfg.to)}`+
    `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  setMsg('Opening your mail app with the message ready to send.','ok');
}

function wireContact(){
  const btn=$('contactbtn'); if(!btn) return;
  btn.onclick=openContact;
  $('contactClose').onclick=closeContact;
  $('contactVeil').onclick=closeContact;
  $('contactForm').onsubmit=submitContact;
  addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!$('contactModal').hidden) closeContact();
  });
}

/* ---------- which district ---------- */
/* Which district this page is showing. The URL wins, then the last one the
   reader chose, then the index's default. An unknown id is not an error worth
   a message — it is a stale link, and the default is the useful answer. */
const DKEY='tm-district';
function pickDistrict(index){
  const known=new Set(Object.keys(index.districts));
  const asked=new URLSearchParams(location.search).get('d');
  if(asked&&known.has(asked)) return asked;
  let saved=null; try{saved=localStorage.getItem(DKEY);}catch(e){}
  if(saved&&known.has(saved)) return saved;
  return known.has(index.default)?index.default:Object.keys(index.districts)[0];
}

/* Ninety-four districts is past the point where a flat list can be read, so
   they are grouped by the region the dashboard itself groups them by. */
function buildDistrictNav(index,did){
  const sel=$('districtPick');
  if(!sel) return;
  const opt=d=>{
    const e=index.districts[d]||{};
    const lbl=e.gone?`${e.name} · to ${shortYr(e.last||'')}`:e.name;
    return `<option value="${esc(d)}"${d===did?' selected':''}>${esc(lbl)}</option>`;
  };
  // The 2026-27 realignment dissolved 68 districts. Their finished years are
  // still the record of those clubs, so they stay on the list — in a group of
  // their own, because they are not part of any region the dashboard has now.
  const gone=(index.retired||[]).filter(d=>index.districts[d]);
  sel.innerHTML=index.regions.map(r=>
    `<optgroup label="${esc(r.r)}">`+
    r.d.filter(d=>index.districts[d]).map(opt).join('')+`</optgroup>`).join('')
    +(gone.length?`<optgroup label="No longer a district">`+gone.map(opt).join('')+`</optgroup>`:'');
  sel.value=did;
  const lbl=$('districtLabel');
  if(lbl) lbl.innerHTML=esc((index.districts[did]||{}).name||`District ${did}`).replace(/\s/,'&nbsp;');
  sel.onchange=()=>{
    const next=sel.value;
    try{localStorage.setItem(DKEY,next);}catch(e){}
    // A full navigation rather than an in-place swap: every section, the
    // drawer and the year scrub all derive from the two documents, and
    // reloading is the one way that cannot leave a stale corner behind.
    location.assign(`?d=${encodeURIComponent(next)}`);
  };
}

/* ---------- boot ---------- */
/* The two documents are fetched together and race on purpose: whichever lands
   first draws its own sections. Both are versioned from districts.json, so a
   deploy cannot serve new markup beside stale data. */
function loadLive(url){
 return fetch(url).then(r=>r.ok?r.json():Promise.reject(new Error(r.status))).then(L=>{
  S.l=L;
  drawLive();
  const rd=$('rDays'); if(rd) rd.textContent=L.days;
  setEyebrow();
  const hc=$('hClubs'); if(hc && L.clubs) hc.textContent=L.clubs.length;
  setYearPhrase();
  setNoHistoryDate();
  openAskedClub();
  // the two files race; if the history drew first it drew before it could know
  // which clubs the district still has, so give it the roster now. A district
  // created this program year has no finished years and nothing to redraw.
  if(S.d){
    // the history drew before it knew there was an open year to offer
    if(!S.yearPicked&&L.py) S.year=LIVE;
    drawScrub();drawBoard();
    // the charts were drawn against the last finished year, before this
    // document existed to offer the open one
    if(S.d.years.length){drawClubs();drawGoalGap();drawDivisions();}
  }
}).catch(e=>{
  console.error('in-year view failed',e);
  $('inyear').innerHTML='<p style="color:var(--muted);padding:20px 0">The in-year view could not load '+
    '(live.json: '+esc(e.message)+'). The Finished Years section below is unaffected.</p>';
});
}

function loadHistory(url){
 return fetch(url).then(r=>r.json()).then(d=>{
  S.d=d;S.year=(S.l&&S.l.py)?LIVE:d.years[d.years.length-1];
  applySiteConfig(d);
  wireContact();
  setYearPhrase();
  // A district created this program year has no finished years. Every
  // retrospective section derives from them, so they are hidden rather than
  // drawn as an empty grid beside a legend explaining nothing.
  if(!d.years.length){
    ['signals','movement','clubs'].forEach(id=>{const el=$(id); if(el) el.hidden=true;});
    const nav=$('mastnav');
    if(nav) nav.querySelectorAll('a[href="#clubs"]').forEach(a=>a.remove());
    // A route to a hidden section is a dead end, and a figure it cannot compute
    // is a dash. Both go. The board stays: its grid and its table both read the
    // open year, which is the one record this district has.
    document.querySelectorAll('.router a[href="#board"],.router a[href="#signals"],.router a[href="#clubs"]')
      .forEach(a=>a.remove());
    S.year=LIVE;
    if(S.l){drawScrub();drawBoard();}
    // Four sections disappearing without a word reads as a broken page, so the
    // page says which ones and why, and names the date the first one arrives.
    const nh=$('nohistory');
    if(nh){
      nh.hidden=false;
      const nm=$('nhName'); if(nm) nm.textContent=d.district||'this district';
      const chip=$('nhChip'); if(chip) chip.textContent=d.district||'';
      setNoHistoryDate();
    }
    // The in-year table is searchable and filterable, so nothing is lost: it
    // is the only thing this district has a record of.
    const hc=$('hClubs');
    if(hc && hc.textContent.trim()==='\u2014' && S.l) hc.textContent=S.l.clubs.length;
    openAskedClub();
    return;
  }
  const pairs=d.years.slice(1).map((y,i)=>[d.years[i],y]);
  S.mv=pairs[pairs.length-1].join('|');
  $('mvyear').innerHTML=pairs.map(([a,b])=>
    `<option value="${a}|${b}">${shortYr(a)} → ${shortYr(b)}</option>`).join('');
  $('mvyear').value=S.mv;
  $('mvyear').onchange=e=>{S.mv=e.target.value;drawMv();};
  const divs=[...new Set(d.clubs.map(c=>c.d).filter(Boolean))].sort();
  $('fdiv').innerHTML='<option value="">All divisions</option>'+divs.map(x=>`<option value="${x}">Division ${x}</option>`).join('');
  $('q').oninput=drawClubs;$('fdiv').onchange=drawClubs;$('fsort').onchange=drawClubs;
  // the year columns reverse when the viewport crosses into phone width
  NARROW.addEventListener('change',()=>{if(S.d)drawClubs();});
  drawScrub();drawBoard();drawGoalGap();drawTrend();drawDivisions();drawMv();drawClubs();
  /* The router counts clubs under three goals in the last finished year, and
     the board now opens on the year still running. Sending a reader to a
     figure the screen does not show is a broken promise, so the card sets the
     year it was counting. */
  document.querySelectorAll('.router a[href="#board"]').forEach(a=>a.addEventListener('click',()=>{
    setYear(d.years[d.years.length-1]);}));
  openAskedClub();
  // router figures, read off the most recent finished year
  const ly=d.years[d.years.length-1];
  const fin=d.clubs.map(c=>(c.y[ly]||{}).f).filter(v=>v!=null);
  const hc=$('hClubs'); if(hc && hc.textContent.trim()==='\u2014') hc.textContent=d.clubs.length;
  const ry=$('rYears'); if(ry) ry.innerHTML=d.years.length+'<u>yr</u>';
  const rr=$('rRed'); if(rr) rr.textContent=fin.filter(v=>v<3).length;
  const gr=d.clubs.map(c=>c.y[ly]).filter(v=>v&&v.g);
  if(gr.length){
    const worst=Math.min(...SHORT.map((_,j)=>
      gr.filter(r=>r.g[j]!=null&&r.g[j]>=TARGETS[j]).length/gr.length*100));
    const rg=$('rGap'); if(rg) rg.innerHTML=Math.round(worst)+'<u>%</u>';
  }
}).catch(e=>{
  document.querySelector('main').insertAdjacentHTML('afterbegin',
   '<div class="wrap"><p style="color:var(--red-ink);padding:20px 0">Could not load data.json. '+esc(e.message)+'</p></div>');
});
}

/* A district that no longer exists has no live.json to fetch. Fetching one
   anyway would land in the in-year error path, which tells a reader the data
   failed to load — the opposite of the truth, which is that there is none. */
function showGone(meta){
  const iy=$('inyear'); if(iy) iy.hidden=true;
  const nav=$('mastnav');
  if(nav) nav.querySelectorAll('a[href="#inyear"]').forEach(a=>a.remove());
  document.querySelectorAll('.router a[href="#inyear"]').forEach(a=>a.remove());
  const gd=$('gonedistrict');
  if(gd){
    gd.hidden=false;
    const set=(id,t)=>{const e=$(id); if(e) e.textContent=t;};
    set('gdChip',meta.name||'');
    set('gdName',meta.name||'This district');
    set('gdLast',meta.last?spanYr(meta.last):'its final year');
  }
}

async function boot(){
  let index;
  try{
    index=await fetch(assetUrl('districts.json')).then(r=>r.json());
  }catch(e){
    document.querySelector('main').insertAdjacentHTML('afterbegin',
     '<div class="wrap"><p style="color:var(--red-ink);padding:20px 0">Could not load the district list. '+esc(e.message)+'</p></div>');
    return;
  }
  S.index=index;
  const did=S.did=pickDistrict(index);
  S.askedClub=(new URLSearchParams(location.search).get('c')||'').trim()||null;
  try{localStorage.setItem(DKEY,did);}catch(e){}
  // An id that resolved to a different district must not stay in the URL: the
  // bar saying ?d=121 beside a wordmark saying District 227 reads as a fault.
  const asked=new URLSearchParams(location.search).get('d');
  if(asked&&asked!==did&&history.replaceState){
    const keep=S.askedClub?`&c=${encodeURIComponent(S.askedClub)}`:'';
    try{history.replaceState(null,'',`?d=${encodeURIComponent(did)}${keep}`);}catch(e){}
  }
  buildDistrictNav(index,did);
  const meta=index.districts[did]||{};
  // versioned from the index, so a deploy cannot serve new markup with stale data
  const v=h=>h?`?v=${h}`:'';
  if(meta.gone) showGone(meta); else loadLive(`d/${did}/live.json${v(meta.v)}`);
  loadHistory(`d/${did}/data.json${v(meta.vd)}`);
}
boot();
