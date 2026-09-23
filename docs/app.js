const S={d:null,year:null,mv:null,lvSort:{k:'met',dir:-1},l:null};
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
function drawScrub(){
  $('scrub').innerHTML=S.d.years.map(y=>
    `<button class="yr" data-y="${y}" aria-pressed="${y===S.year}">${esc(y)}</button>`).join('');
  $('scrub').querySelectorAll('.yr').forEach(b=>b.onclick=()=>{S.year=b.dataset.y;drawScrub();drawBoard();});
}
function drawBoard(){
  const g=$('grid'),n={g:0,a:0,r:0,x:0,ten:0};
  const chip=$('bdChip'); if(chip) chip.textContent=shortYr(S.year)+' · closed';
  const Y=S.d.years,pi=Y.indexOf(S.year)-1,prev=pi>=0?Y[pi]:null;
  const divs={};
  S.d.clubs.forEach((c,i)=>{
    // clubs.tsv spans every year, so skip the ones this year never had
    const yv=c.y[S.year]||{};
    if(yv.f==null) return;
    // group by the alignment that was in force that year, not today's
    const dv=yv.d||c.d||'—',ar=yv.a||c.a||'—';
    (divs[dv]=divs[dv]||{});(divs[dv][ar]=divs[dv][ar]||[]).push({c,i});
  });
  g.innerHTML=Object.keys(divs).sort().map(dv=>{
    const areas=Object.keys(divs[dv]).sort();
    const cur=[],pre=[];
    areas.forEach(a=>divs[dv][a].forEach(({c})=>{
      const f=(c.y[S.year]||{}).f; if(f!=null)cur.push(f);
      if(prev){const p=(c.y[prev]||{}).f; if(p!=null)pre.push(p);}
    }));
    const avg=v=>v.length?v.reduce((s,x)=>s+x,0)/v.length:null;
    const ca=avg(cur),pa=avg(pre),trend=(ca!=null&&pa!=null)?ca-pa:null;
    const level=trend!=null&&Math.abs(trend)<0.05;
    const tcol=(trend==null||level)?'var(--muted)':trend>0?'var(--green)':'var(--red)';
    const acol=ca==null?'var(--muted)':ca>=5?'var(--green)':ca>=3?'var(--amber)':'var(--red)';
    const body=areas.map(a=>{
      const sorted=divs[dv][a].slice().sort((x,y)=>{
        // clubs the district no longer has drop to the foot of the area, whatever
        // they scored: the list is read top-down for who to call, and there is no
        // one left to call at a club that has gone
        const gx=goneFromRoster(x.c.n),gy=goneFromRoster(y.c.n);
        if(gx!==gy) return gx?1:-1;
        const fx=(x.c.y[S.year]||{}).f,fy=(y.c.y[S.year]||{}).f;
        if(fx==null&&fy==null) return x.c.m.localeCompare(y.c.m);
        if(fx==null) return 1; if(fy==null) return -1;
        return fy-fx || x.c.m.localeCompare(y.c.m);
      });
      const rows=sorted.map(({c,i})=>{
        const f=(c.y[S.year]||{}).f??null,sg=sig(f);n[sg]++;if(f===10)n.ten++;
        // the year's result still stands, so only the name is struck: the lamp
        // is history and stays exactly as it was
        const gone=goneFromRoster(c.n);
        const lbl=`${c.m} — ${f==null?'no data for '+S.year:f+' of 10 goals in '+S.year}${
          gone?' — '+GONE:''}`;
        return `<button class="clubrow" data-i="${i}" title="${esc(lbl)}" aria-label="${esc(lbl)}">
          <span class="lamp" data-sig="${sg}" aria-hidden="true">${f==null?'\u00b7':f}</span>
          <span class="cn${gone?' gone':''}">${esc(c.m)}</span></button>`;
      }).join('');
      return `<div class="areagrp"><div class="arealab">Area ${esc(a)}
        <button class="scopedl mini" data-kind="Area" data-label="${esc(a)}" data-div="${esc(dv)}"
          title="Download Area ${esc(a)} — current roster — as an Excel workbook"
          aria-label="Download Area ${esc(a)} as an Excel workbook">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>
        </button></div>${rows}</div>`;
    }).join('');
    return `<section class="divblock"><div class="divhead">
        <span class="divname">Division ${esc(dv)}</span>
        <span class="divstat">${cur.length}<span class="w"> clubs · avg </span><span class="divavg" style="color:${ink(acol)}">${ca==null?'—':ca.toFixed(1)}</span>${trend==null?'':` <span style="color:${ink(tcol)}">${level?'<span class="w">level</span>':(trend>0?'▲':'▼')+' '+Math.abs(trend).toFixed(1)}</span>`}</span>
        <button class="scopedl" data-kind="Division" data-label="${esc(dv)}"
          title="Download Division ${esc(dv)} — current roster — as an Excel workbook"
          aria-label="Download Division ${esc(dv)} as an Excel workbook">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>
          Excel</button>
      </div><div class="areas" data-n="${areas.length}">${body}</div></section>`;
  }).join('');
  g.querySelectorAll('.clubrow').forEach(b=>b.onclick=()=>openDetail(+b.dataset.i));
  g.querySelectorAll('.scopedl').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const {kind,label,div}=b.dataset;
    // The board groups clubs by the alignment of the year on screen. A
    // director's patch is whatever it is NOW, and 75 clubs moved this year,
    // so the roster comes from the live feed when we have it.
    const match=(d,a)=>kind==='Division'?d===label:(d===div&&a===label);
    const cur=S.l?new Set(S.l.clubs.filter(c=>match(c.d||'—',c.a||'—')).map(c=>c.n)):null;
    const list=cur&&cur.size
      ? S.d.clubs.filter(c=>cur.has(c.n))
      : S.d.clubs.filter(c=>match(c.d||'—',c.a||'—'));
    scopeDownload(kind,kind==='Area'?`${div}${label}`:label,list);
  });
  $('tally').innerHTML=[
    ['Distinguished or better',n.g,'var(--green)'],['Stalled at 3–4',n.a,'var(--amber)'],
    ['Under 3 goals',n.r,'var(--red)'],['Perfect 10',n.ten,'var(--ink)']
  ].map(([l,v,c])=>`<div class="tallyitem"><div class="tallyn" style="color:${ink(c)}">${v}</div>
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
  const chip=$('clChip'); if(chip) chip.textContent=Y.length+' finished years';
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
  const Y=S.d.years,y=Y[Y.length-1];$('ggYear').textContent=y;
  const chip=$('sgChip'); if(chip) chip.textContent=shortYr(y)+' · closed';
  const rows=S.d.clubs.map(c=>c.y[y]).filter(v=>v&&v.g);
  const pct=SHORT.map((_,j)=>{
    const met=rows.filter(r=>r.g[j]!=null&&r.g[j]>=TARGETS[j]).length;
    return {j,p:rows.length?met/rows.length*100:0,met,n:rows.length};});
  pct.sort((a,b)=>a.p-b.p);
  $('goalgap').innerHTML=pct.map(g=>{
    const col=g.p>=60?'var(--green)':g.p>=35?'var(--amber)':'var(--red)';
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
  const Y=S.d.years,y=Y[Y.length-1],prev=Y[Y.length-2];$('dvYear').textContent=y;
  const agg={};
  S.d.clubs.forEach(c=>{if(!c.d)return;(agg[c.d]=agg[c.d]||{cur:[],pre:[]});
    const a=(c.y[y]||{}).f,b=(c.y[prev]||{}).f;
    if(a!=null)agg[c.d].cur.push(a);if(b!=null)agg[c.d].pre.push(b);});
  const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
  const list=Object.keys(agg).sort().map(d=>({d,cur:avg(agg[d].cur),pre:avg(agg[d].pre),n:agg[d].cur.length}))
    .filter(r=>r.cur!=null).sort((a,b)=>b.cur-a.cur);
  $('divbars').innerHTML=list.map(r=>{
    const w=r.cur/10*100,col=r.cur>=5?'var(--green)':r.cur>=3?'var(--amber)':'var(--red)';
    const gh=r.pre!=null?`<div class="ghost" style="left:${(r.pre/10*100).toFixed(1)}%" title="${prev}: ${r.pre.toFixed(1)}"></div>`:'';
    const dir=r.pre!=null?(r.cur-r.pre):null;
    return `<div class="barrow"><div class="barlab"><b>Division ${esc(r.d)}</b>
        <span style="color:var(--muted)">· ${r.n} clubs</span></div>
      <div class="bartrack" style="height:20px"><div class="barfill" style="width:${w.toFixed(1)}%;background:${col}"></div>${gh}</div>
      <div class="barval">${r.cur.toFixed(1)}${dir==null?'':
        `<span style="color:${ink(dir>=0?'var(--green)':'var(--red)')};font-size:11px"> ${dir>=0?'▲':'▼'}</span>`}</div></div>`;
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


/* The drawer can move between years without closing. A club's division and
   area belong to the year in view, so switching years reprints the header —
   which is the point: the same club sits in different areas across years. */
function renderYearPicker(clubNo, active){
  const box=$('dyears'); if(!box) return;
  const club=S.d?S.d.clubs.find(c=>c.n===clubNo):null;
  const live=S.l?S.l.clubs.find(c=>c.n===clubNo):null;
  const years=club?(S.d.years||[]).filter(y=>club.y[y]):[];
  if(!years.length && !live){box.innerHTML='';return;}
  const btn=(label,val,isNow,on)=>
    `<button class="dyr${isNow?' now':''}" data-y="${esc(val)}" aria-pressed="${on}">${esc(label)}</button>`;
  box.innerHTML=years.map(y=>btn(shortYr(y),y,false,y===active)).join('')
    + (live?btn((S.l.py?shortYr(S.l.py):'now')+' · in progress','__live',true,active==='__live'):'');
  box.querySelectorAll('.dyr').forEach(b=>b.onclick=()=>{
    if(b.dataset.y==='__live') return openLiveDetail(clubNo);
    const i=S.d.clubs.findIndex(c=>c.n===clubNo);
    if(i>=0) openDetail(i,b.dataset.y);
  });
}

function openLiveDetail(n){
  const L=S.l, c=L.clubs.find(x=>x.n===n); if(!c) return;
  const net=c.ng, memcol=c.memok?'var(--green)':'var(--red)';
  $('dname').textContent=c.m;
  $('dsub').innerHTML=`${esc(c.n)} · Division ${esc(c.d)} / Area ${esc(c.a)} · `+
    `<b style="color:var(--ink)">${esc(L.py)} in progress</b> · as of ${esc(L.asof||'')}`;
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
  renderYearPicker(c.n,'__live');
  $('ddl').style.display='none';           // per-club export is a finished-year feature
  $('detail').classList.add('open');$('dclose').focus();
}

function openDetail(i,want){
  const c=S.d.clubs[i],Y=S.d.years;
  const yr=(want&&c.y[want])?want:(c.y[S.year]?S.year:(Y.filter(k=>c.y[k]).pop()||S.year));
  const y=c.y[yr]||{};
  $('dname').textContent=c.m;
  const now=S.l?S.l.clubs.find(x=>x.n===c.n):null;
  const yd=y.d||c.d, ya=y.a||c.a;
  const moved=now&&(now.d!==yd||now.a!==ya)?` · now Division ${now.d} / Area ${now.a}`:'';
  $('dsub').innerHTML=`${esc(c.n)} · Division ${esc(yd)} / Area ${esc(ya)} in ${esc(yr)}`+
    (moved?`<span style="color:var(--ink)">${esc(moved)}</span>`:'')+
    (!now&&S.l?' · no longer in the district':'');
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
  $('dgoals').innerHTML=y.g?S.d.goals.map((g,j)=>{
    const v=y.g[j],met=v!=null&&v>=TARGETS[j];
    return `<div class="goalrow"><span class="gtick" data-m="${met?1:0}">${met?'✓':''}</span>
      <span class="gname">${esc(g)}</span><span class="num">${v??'—'}<span
        style="color:var(--muted)"> / ${TARGETS[j]}</span></span></div>`;}).join('')
    :'<p style="color:var(--muted);font-size:13.5px">No goal detail for this year.</p>';
  renderYearPicker(c.n,yr);
  $('ddl').style.display='';
  $('ddl').onclick=()=>saveBlob(clubXlsx(c),
    `${c.m.replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'')}_DCP.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  $('detail').classList.add('open');$('dclose').focus();
}
$('dclose').onclick=()=>$('detail').classList.remove('open');
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
  ['lvUpd','cyUpd'].forEach(id=>{$(id).textContent=L.asof||'—';});
  $('cyAsof').textContent=L.asof||'—';

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

  $('lvXlsx').setAttribute('download',`District21_InYear_${L.py}.xlsx`);
  $('lvXlsxMeta').textContent=`Excel workbook · ${a.clubs} clubs · snapshot ${L.asof||'—'}`;
  drawLiveTable();
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
function cspRank(v){
  if(!v) return 2;
  return (/Met/i.test(v)&&!/Not/i.test(v))?0:1;
}
function setLiveSort(k){
  // a new column starts ascending; the active one reverses
  S.lvSort = (S.lvSort.k===k) ? {k,dir:-S.lvSort.dir} : {k,dir:1};
  drawLiveTable();
}
function memCell(c){
  if(c.md==null) return '<span class="lvmem"><span class="memn" style="color:var(--muted)">—</span></span>';
  // the count is ink; only the direction of travel carries colour, and it sits
  // in a fixed box so the counts stay in one column whether or not it is there
  // a zero net change must render as nothing, or "23" and "0" read as "230"
  const g=(c.ng==null||c.ng===0)?'':(c.ng>0?'+'+c.ng:String(c.ng));
  const gcol=c.ng>0?'var(--green)':c.ng<0?'var(--red)':'var(--muted)';
  return `<span class="lvmem" title="${c.md} members now, base ${c.mb}${
      c.memok?' — meets the membership rule':' — short of 20 members and of +5 net growth'}">`+
    `<span class="memn">${c.md}</span>`+
    `<span class="memg" style="color:${ink(gcol)}">${g}</span></span>`;
}
function cspMark(v,closed){
  const y=/Met/i.test(v||'')&&!/Not/i.test(v||'');
  if(!v) return `<span class="csp" data-v="u" title="Not tracked this year"><span class="cspd">?</span>—</span>`;
  // "Not yet" only reads right while the year can still change
  return `<span class="csp" data-v="${y?'y':'n'}"><span class="cspd">${y?'\u2713':'\u2715'}</span>${
    y?'Submitted':(closed?'Not submitted':'Not yet')}</span>`;
}
function drawLiveTable(){
  const L=S.l,q=$('lq').value.trim().toLowerCase(),dv=$('lfdiv').value,noplan=$('lfcsp').checked;
  let list=L.clubs.filter(c=>{
    if(dv&&c.d!==dv) return false;
    // rank 1 is "recorded, and not met" — a club the dashboard has no plan for.
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
    nd  :c=>c.nd||'9999-99-99'};
  const {k,dir}=S.lvSort, get=KEY[k]||KEY.met;
  list.sort((x,y)=>{
    const a=get(x),b=get(y);
    const d=a<b?-1:a>b?1:0;
    return d*dir||byName(x,y);          // name breaks every tie, always A-Z
  });

  S.lvView=list;
  $('lvtb').innerHTML=list.map(c=>{
    const pips=c.st.map((v,i)=>`<span class="pip" data-s="${v}" title="${esc(L.goals[i])}: ${
      v==='m'?'achieved':v==='o'?'still reachable':'window closed'}"></span>`).join('');
    const d=daysTo(c.nd);
    // colour appears only where it decides something: the chip is the one that
    // says act this month. The score itself is a rank, and stays ink.
    const urg=(d!=null&&d<=30)?`<span class="lvurg" title="closes in ${d} days">${d}d</span>`:'';
    // the Success Plan is a boolean that used to compete with the score for a
    // whole column; it rides on the club line, and only when it is missing
    const plan=cspRank(c.csp)===1?'<span class="lvplan" title="No Club Success Plan yet">No Club Success Plan</span>':'';
    return `<tr class="lvrow" tabindex="0" role="button" data-n="${esc(c.n)}">
      <td><span class="lvname" title="${esc(c.m)}">${esc(c.m)}</span><span class="lvnum">${esc(String(Number(c.n)))}${plan}</span></td>
      <td class="lvdiv">${esc(c.d||'—')}</td>
      <td><span class="lvscore"><b>${c.met}</b><span>/10</span></span></td>
      <td class="lvpips"><span class="pips">${pips}</span></td>
      <td>${memCell(c)}</td>
      <td><span class="lvnd">${urg}<span class="lvdate">${c.nd?esc(fmtDate(c.nd)):'—'}</span>
        <span class="lvwin">${esc(c.ndl||'')}</span></span></td></tr>`;}).join('')
    ||`<tr><td colspan="6" style="color:var(--muted);padding:18px 14px">No clubs match.</td></tr>`;

  document.querySelectorAll('#inyear thead th[data-k]').forEach(th=>{
    const on=th.dataset.k===S.lvSort.k;
    if(on) th.setAttribute('aria-sort',S.lvSort.dir===1?'ascending':'descending');
    else th.removeAttribute('aria-sort');
    const ar=th.querySelector('.ar');
    if(ar) ar.textContent = (on && S.lvSort.dir===-1) ? '\u25bc' : '\u25b2';
    th.onclick=()=>setLiveSort(th.dataset.k);
    th.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setLiveSort(th.dataset.k);}};
  });
  $('lvtb').querySelectorAll('.lvrow').forEach(tr=>{
    const go=()=>openLiveDetail(tr.dataset.n);
    tr.onclick=go;
    tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};
  });
  $('lvNote').textContent=`${list.length} of ${L.clubs.length} clubs · snapshot ${L.asof||'—'}`;
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
function clubXlsx(c){
  const L=S.l, Y=S.d.years, G12=S.d.goals, live=L?L.clubs.find(x=>x.n===c.n):null;
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

function scopeDownload(kind,label,clubs){
  saveBlob(scopeXlsx(kind,label,clubs),
    `District21_${kind}_${String(label).replace(/[^A-Za-z0-9]+/g,'')}_DCP.xlsx`,
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
    try{localStorage.setItem('d21-theme',next);}catch(e){}
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
  if(s.title){document.title=s.title;}
  if(s.description){const m=document.querySelector('meta[name="description"]');
    if(m) m.setAttribute('content',s.description);}
  if(s.eyebrow) S.eyebrow=s.eyebrow;
  setEyebrow();
  if(name){
    set('brandName',el=>el.innerHTML=esc(name).replace(/\s/,'&nbsp;')+' Club Health');
    set('footSource',el=>el.textContent=name);
  }
  ['sheet1','sheet2'].forEach(id=>{ if(s.spreadsheet_url) set(id,el=>el.href=s.spreadsheet_url); });
  ['footRepo','navData'].forEach(id=>{ if(s.repo_url) set(id,el=>el.href=s.repo_url); });
  set('footDash',el=>{ if(d.district_id) el.href=`https://dashboards.toastmasters.org/District.aspx?id=${d.district_id}`; });
}

/* The eyebrow names the programme and the span the page covers. The span is
   read off the data — the finished years plus the open one — rather than being
   written into the config, so it is right the morning after a year rolls. */
const spanYr=y=>y.slice(0,4)+'\u2013'+y.slice(7,9);
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

/* ---------- boot ---------- */
fetch(assetUrl('live.json')).then(r=>r.ok?r.json():Promise.reject(new Error(r.status))).then(L=>{
  S.l=L;
  const divs=[...new Set(L.clubs.map(c=>c.d).filter(Boolean))].sort();
  $('lfdiv').innerHTML='<option value="">All divisions</option>'+
    divs.map(x=>`<option value="${x}">Division ${x}</option>`).join('');
  $('lq').oninput=drawLiveTable;$('lfdiv').onchange=drawLiveTable;
  $('lfcsp').onchange=drawLiveTable;
  drawLive();
  const rd=$('rDays'); if(rd) rd.textContent=L.days;
  setEyebrow();
  const hc=$('hClubs'); if(hc && L.clubs) hc.textContent=L.clubs.length;
  // the two files race; if the history drew first it drew before it could know
  // which clubs the district still has, so give it the roster now
  if(S.d){drawBoard();drawClubs();}
}).catch(e=>{
  $('inyear').innerHTML='<p style="color:var(--muted);padding:20px 0">The in-year view could not load '+
    '(live.json: '+esc(e.message)+'). The Finished Years section below is unaffected.</p>';
});

fetch(assetUrl('data.json')).then(r=>r.json()).then(d=>{
  S.d=d;S.year=d.years[d.years.length-1];
  applySiteConfig(d);
  wireContact();
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
  // router figures, read off the most recent finished year
  const ly=d.years[d.years.length-1];
  const fin=d.clubs.map(c=>(c.y[ly]||{}).f).filter(v=>v!=null);
  const hc=$('hClubs'); if(hc && hc.textContent.trim()==='\u2014') hc.textContent=d.clubs.length;
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
