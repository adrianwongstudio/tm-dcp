import {TARGETS} from './charts.js?v=8908fb202e';
import {fcSub} from './forecast.js?v=8908fb202e';
import {drawYearTable, setYear} from './clubtable.js?v=8908fb202e';
import {$, S, T, badge, esc, ink, shortYr, sig, spark} from './core.js?v=8908fb202e';
import {clubScore, clubYears, districtName} from './explorer.js?v=8908fb202e';
import {LOC, boardUrl} from './lang.js?v=8908fb202e';
import {asofText, cspMark} from './live.js?v=8908fb202e';
import {clubAwayDocs, clubXlsx, saveBlob} from './workbooks.js?v=8908fb202e';

/* ---------- drawer open and close ---------- */
/* Closed, the drawer is off the screen, hidden and inert. Opening it moves
   focus to its close button; closing it hands focus back to whatever opened
   it, so a reader who was half way down a table lands where they left. A row
   re-renders between open and close, so the opener is only focused again if it
   is still in the page. */
let dOpener=null;
function openDrawer(){
  const d=$('detail'); if(!d) return;
  const a=document.activeElement;
  dOpener=(a&&a!==document.body)?a:null;
  d.inert=false;
  d.classList.add('open');
  $('dclose').focus();
}
function closeDrawer(){
  const d=$('detail'); if(!d) return;
  d.classList.remove('open');
  d.inert=true;
  const o=dOpener; dOpener=null;
  if(o&&document.contains(o)&&typeof o.focus==='function') o.focus();
}

/* ---------- detail ---------- */
function fmtDay(iso){
  if(!iso) return '';
  const d=new Date(iso+'T00:00:00');
  return d.toLocaleDateString(LOC(),{day:'numeric',month:'short',year:'numeric'});
}
// Rows 9+10 earn one goal, and so do rows 11+12, so ten goals cover twelve rows.
export const GOALROWS=[[0],[1],[2],[3],[4],[5],[6],[7],[8,9],[10,11]];


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
  const years=club?clubYears().filter(y=>(club.y||{})[y]||(club.ay||{})[y]):[];

  const items=years.map(y=>({y,key:y,label:shortYr(y)}));
  if(live) items.push({y:(S.l.py||''),key:'__live',live:true,
                       label:(S.l.py?shortYr(S.l.py):T('now'))+' · '+T('in progress')});
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
    `${i.away?` title="${esc(T("Read this club's {year} record, which District {district} holds",
       {year:i.y,district:i.away}))}"`:''}`+
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
export function fetchAway(did){
  if(AWAY[did]) return AWAY[did];
  const meta=(S.index&&S.index.districts&&S.index.districts[did])||{};
  const one=(name,hash)=>fetch(`d/${did}/${name}?v=${hash}`)
    .then(r=>r.ok?r.json():null).catch(()=>null);
  // stamp_assets only hashes a file that exists, so a missing hash is a
  // missing document: a dissolved district has no open year, and asking for
  // one is a 404 in the console for an answer we already have
  return AWAY[did]=Promise.all([
    meta.vd?one('data.json',meta.vd):Promise.resolve(null),
    meta.v ?one('live.json',meta.v ):Promise.resolve(null),
  ]).then(([d,l])=>({d,l}));
}

/* A fetch that fails leaves nothing honest to show in the drawer, so the old
   navigation stays as the floor: the record is real and it is over there. It
   does not write the district to localStorage, so a reader who lands there by
   this route is not moved there permanently. */
function openAway(did,year,clubNo,btn){
  const give=()=>location.assign(boardUrl({d:did,c:clubNo}));
  btn.classList.add('wait');
  return fetchAway(did).then(({d,l})=>{
    btn.classList.remove('wait');
    if(l&&l.py===year&&l.clubs.some(c=>c.n===clubNo)) return renderLive(l,clubNo,did,d);
    const c=d&&d.clubs.find(x=>x.n===clubNo);
    if(c&&c.y[year]) return renderDetail(d,l,c,year,did);
    give();
  }).catch(()=>{btn.classList.remove('wait');give();});
}

/* ?c=<club number> opens that club as soon as its district's data lands.
   Whichever document arrives first and holds the club wins; the year picker
   then offers every other year the club has, here or elsewhere. */
export function openAskedClub(){
  if(!S.askedClub) return;
  const n=S.askedClub;
  if(S.l&&S.l.clubs.some(c=>c.n===n)){S.askedClub=null;return openLiveDetail(n);}
  if(S.d){
    const i=S.d.clubs.findIndex(c=>c.n===n);
    if(i>=0){S.askedClub=null;return openDetail(i);}
  }
}

export function openLiveDetail(n){ renderLive(S.l,n,null); }

/* The open year, from this district's live document or another district's. */
function renderLive(L,n,away,D){
  D=D||S.d;
  const c=L.clubs.find(x=>x.n===n); if(!c) return;
  const net=c.ng, memcol=c.memok?'var(--green)':'var(--red)';
  $('dname').textContent=c.m;
  $('dsub').innerHTML=`${esc(c.n)} · ${esc(T('Division {d} / Area {a}',{d:c.d,a:c.a}))} · `+
    `<b style="color:var(--ink)">${esc(T('{year} in progress',{year:L.py}))}</b> · ${
      esc(T('as of {date}',{date:asofText()}))}`+
    (away?` · <b style="color:var(--ink)">${esc(T('District {n}',{n:away}))}</b>`:'');
  const card=(k,v,col,extra,fc)=>`<div class="dcard"><div class="k">${esc(k)}</div>`+
    (extra?`<div style="margin-top:9px">${v}</div>`:`<div class="v" style="color:${ink(col)||'var(--ink)'}">${v}</div>`)+(fc||'')+`</div>`;
  const fc=w=>away?'':fcSub(c,w);
  $('dgrid').innerHTML=
     card(T('Goals met so far'),`${c.met}<span style="font-size:15px;color:var(--muted)">/10</span>`,
          c.met>=5?'var(--green)':c.met>=3?'var(--amber)':'var(--red)',false,fc('goals'))
   + card(T('Members'),c.md??'—',memcol,false,fc('members'))
   + card(T('Membership base'),c.mb??'—')
   + card(T('Net growth'),net==null?'—':(net>0?'+':'')+net,
          net==null?'var(--muted)':net>0?'var(--green)':net<0?'var(--red)':'var(--ink)')
   + card(T('Where it stands'),c.now?badge(c.now+' Distinguished')
       :`<span class="badge">${esc(T('Not yet Distinguished'))}</span>`,null,true,fc('odds'))
   + card(T('Best still possible'),c.best?badge(c.best+' Distinguished')
       :`<span class="badge">${esc(T('Distinguished out of reach'))}</span>`,null,true)
   + card(T('Club Success Plan'),cspMark(c.csp),null,true)
   + card(T('Days to 30 June'),L.days,'var(--maroon-ink)');

  $('dgoals').innerHTML=L.goals.map((g,j)=>{
    const st=c.st[j], rows=GOALROWS[j];
    const icon=st==='m'?'\u2713':st==='d'?'\u2715':'';
    // a single-row goal already carries its name above, so only pairs need labelling
    const detail=rows.map(r=>{
      const v=c.v[r], t=(L.targets||TARGETS)[r], n=v==null?'—':v;
      return rows.length>1?`${esc(T(L.rows[r]))} ${n} / ${t}`:T('{n} of {t}',{n,t});
    }).join('  ·  ');
    const when=st==='m'?`<span class="gwhen" style="color:var(--green-ink)">${esc(T('done'))}</span>`
      :st==='d'?`<span class="gwhen" style="color:var(--red-ink)">${
         esc(T('closed {date}',{date:fmtDay(c.why[j])}))}</span>`
      :`<span class="gwhen">${esc(T('by {date}',{date:fmtDay(c.why[j])}))}</span>`;
    return `<div class="goalrow${st==='d'?' shut':''}">
      <span class="gtick" data-m="${st==='m'?1:st}">${icon}</span>
      <span class="gname">${esc(T(g))}<span class="gsub">${detail}</span></span>${when}</div>`;
  }).join('');
  renderYearPicker(c.n,away?'@'+away+'|'+L.py:'__live');
  // The open year is the one a club can still act on, so this is where the
  // workbook is worth most: it carries the club's run of years and, first,
  // what is left to do before 30 June.
  $('ddl').style.display='';
  $('ddl').onclick=()=>{
    const btn=$('ddl'); btn.disabled=true;
    clubAwayDocs(c,D).then(away=>saveBlob(clubXlsx(c,D,L,away),
      `${c.m.replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'')}_DCP.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
      .finally(()=>{btn.disabled=false;});
  };
  openDrawer();
}

export function openDetail(i,want){ renderDetail(S.d,S.l,S.d.clubs[i],want,null); }

/* One club's finished year. `D` and `L` are the documents it is read from —
   this district's, or another district's when the reader opened a year the
   club spent elsewhere. `away` is that district's id. */
function renderDetail(D,L,c,want,away){
  /* Which years this club has, and where each one's record sits. A district
     created this program year keeps none of its own, so every record is one
     another district wrote and `y` is empty; reading the year off `D.years`
     there produced a drawer headed "in undefined". */
  const Y=(D.years&&D.years.length)?D.years:(D.cyears||[]);
  const at=k=>{
    const own=(c.y||{})[k];
    if(own&&own.f!=null) return {rec:own,from:null};
    const a=(c.ay||{})[k];
    return a?{rec:a,from:a.x}:{rec:null,from:null};
  };
  const has=k=>!!at(k).rec;
  const yr=(want&&has(want))?want:(has(S.year)?S.year:(Y.filter(has).pop()||Y[Y.length-1]));
  const got=at(yr), y=got.rec||{};
  $('dname').textContent=c.m;
  const now=L?L.clubs.find(x=>x.n===c.n):null;
  const yd=y.d||c.d, ya=y.a||c.a;
  const moved=now&&(now.d!==yd||now.a!==ya)
    ?' · '+T('now Division {d} / Area {a}',{d:now.d,a:now.a}):'';
  $('dsub').innerHTML=`${esc(c.n)} · ${esc(T('Division {d} / Area {a} in {year}',{d:yd,a:ya,year:yr}))}`+
    (moved?`<span style="color:var(--ink)">${esc(moved)}</span>`:'')+
    (!now&&L?' · '+esc(T('no longer in the district')):'')+
    (away?` · <b style="color:var(--ink)">${esc(T('District {n}',{n:away}))}</b>`
        :got.from?' · '+T('earned in <b style="color:var(--ink)">{district}</b>',
            {district:esc(districtName(got.from))}):'');
  const net=(y.md!=null&&y.mb!=null)?y.md-y.mb:null;
  $('dgrid').innerHTML=[
    [T('Goals met'),y.f??'—',y.f==null?'var(--muted)':sig(y.f)==='g'?'var(--green)':sig(y.f)==='a'?'var(--amber)':'var(--red)'],
    [T('Members'),y.md??'—','var(--ink)'],[T('Membership base'),y.mb??'—','var(--ink)'],
    [T('Net growth'),net==null?'—':(net>0?'+':'')+net,net==null?'var(--muted)':net>0?'var(--green)':net<0?'var(--red)':'var(--ink)'],
  ].map(([k,v,col])=>`<div class="dcard"><div class="k">${esc(k)}</div><div class="v" style="color:${ink(col)}">${v}</div></div>`).join('')
   +`<div class="dcard"><div class="k">${esc(T('Status'))}</div><div style="margin-top:8px">${badge(y.st)}</div></div>`
   +`<div class="dcard"><div class="k">${esc(T('Club Success Plan'))}</div><div style="margin-top:9px">${
       y.csp?cspMark(y.csp,true)
            :`<span class="csp" data-v="u"><span class="cspd">?</span>${
               esc(T('Not tracked in {year}',{year:yr}))}</span>`}</div></div>`
   +`<div class="dcard"><div class="k">${esc(T('Five-year trace'))}</div><div style="margin-top:8px">${spark(Y.map(k=>clubScore(c,k).f))}</div></div>`;
  $('dgoals').innerHTML=y.g?D.goals.map((g,j)=>{
    const v=y.g[j],met=v!=null&&v>=TARGETS[j];
    return `<div class="goalrow"><span class="gtick" data-m="${met?1:0}">${met?'✓':''}</span>
      <span class="gname">${esc(T(g))}</span><span class="num">${v??'—'}<span
        style="color:var(--muted)"> / ${TARGETS[j]}</span></span></div>`;}).join('')
    :`<p style="color:var(--muted);font-size:13.5px">${esc(T('No goal detail for this year.'))}</p>`;
  renderYearPicker(c.n,away?'@'+away+'|'+yr:yr);
  $('ddl').style.display='';
  $('ddl').onclick=()=>{
    const btn=$('ddl'); btn.disabled=true;
    clubAwayDocs(c,D).then(away=>saveBlob(clubXlsx(c,D,L,away),
      `${c.m.replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'')}_DCP.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
      .finally(()=>{btn.disabled=false;});
  };
  openDrawer();
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
  closeDrawer();
  // ?c= was a way in, not a state to keep: a reload should show the district.
  if(history.replaceState&&new URLSearchParams(location.search).get('c')){
    try{history.replaceState(null,'',boardUrl({c:null}));}catch(e){}
  }
};
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('detail').classList.contains('open')) closeDrawer();});
