import {LIVE, drawBoard, drawMv, drawScrub} from './js/board.js?v=ac4bbb43bf';
import {SHORT, TARGETS, drawDivisions, drawGoalGap, drawTrend} from './js/charts.js?v=ac4bbb43bf';
import {setYear} from './js/clubtable.js?v=ac4bbb43bf';
import {wireContact} from './js/contact.js?v=ac4bbb43bf';
import {$, S, T, assetUrl, esc, shortYr} from './js/core.js?v=ac4bbb43bf';
import {openAskedClub} from './js/detail.js?v=ac4bbb43bf';
import {DKEY, buildDistrictNav, pickDistrict} from './js/district.js?v=ac4bbb43bf';
import {NARROW, drawClubs} from './js/explorer.js?v=ac4bbb43bf';
import {boardUrl, buildLangNav, langPicked, loadLang} from './js/lang.js?v=ac4bbb43bf';
import {drawLive} from './js/live.js?v=ac4bbb43bf';
import {drawMap, loadGeo, standDownMap} from './js/map.js?v=ac4bbb43bf';
import {applySiteConfig, setEyebrow, setOpenYearRouter, setYearPhrase, spanYr} from './js/masthead.js?v=ac4bbb43bf';

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
  openAskedClub();
  // the two files race; if the history drew first it drew before it could know
  // which clubs the district still has, so give it the roster now. A district
  // created this program year has no finished years and nothing to redraw.
  // the map may have drawn before any club had a score; it has them now
  S.livebyno=null;
  if(S.geo) drawMap();
  if(S.d){
    // the history drew before it knew there was an open year to offer
    if(!S.yearPicked&&L.py) S.year=LIVE;
    drawScrub();drawBoard();
    // the charts were drawn against the last finished year, before this
    // document existed to offer the open one
    drawClubs();drawGoalGap();drawTrend();drawDivisions();setOpenYearRouter();
  }
}).catch(e=>{
  console.error('in-year view failed',e);
  $('inyear').innerHTML=`<p style="color:var(--muted);padding:20px 0">${
    esc(T('The in-year view could not load (live.json: {error}). The Finished Years section below is unaffected.',
          {error:e.message}))}</p>`;
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
    /* A district created this program year has one year, not none. Everything
       that reads a single year still works on it: the board, the club table,
       the goal completion chart and the division standings all take the open
       year. Only two things cannot. The Five-Year Trajectory needs years to
       have a shape, and drawTrend stands its card down. Who Climbed, and Who
       Slipped compares one year against another, and there is no other year to
       compare \u2014 so that section goes, with the link that pointed at it. */
    // The movement lists compare one of a club's years against the next, and
    // crosslink has put those years on the clubs. They are a claim about clubs,
    // so they stand; the board above still shows the one year the district ran.
    const CY=d.cyears||[];
    if(CY.length>1){
      const pairs=CY.slice(1).map((y,i)=>[CY[i],y]);
      S.mv=pairs[pairs.length-1].join('|');
      $('mvyear').innerHTML=pairs.map(([a,b])=>
        `<option value="${a}|${b}">${shortYr(a)} \u2192 ${shortYr(b)}</option>`).join('');
      $('mvyear').value=S.mv;
      $('mvyear').onchange=e=>{S.mv=e.target.value;drawMv();};
      drawMv();
    }else{
      const mv=$('movement'); if(mv) mv.hidden=true;
    }
    // a route to a hidden section is a dead end, and a figure it cannot
    // compute is a dash
    document.querySelectorAll('.router a[href="#board"]').forEach(a=>{
      const n=a.querySelector('.routen'); if(n&&n.textContent.trim()==='\u2014') a.remove();});
    S.year=LIVE;
    if(S.l){
      drawScrub();drawBoard();drawGoalGap();drawTrend();drawDivisions();drawClubs();
      if((d.cyears||[]).length>1) drawMv();
      setOpenYearRouter();
    }
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
  $('fdiv').innerHTML=`<option value="">${esc(T('All divisions'))}</option>`+
    divs.map(x=>`<option value="${esc(x)}">${esc(T('Division {n}',{n:x}))}</option>`).join('');
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
    set('gdName',meta.name||T('This district'));
    set('gdLast',meta.last?spanYr(meta.last):T('its final year'));
  }
}

async function boot(){
  // Before anything draws: the catalogue decides what every section is
  // labelled, and the direction the page runs in.
  await loadLang();
  buildLangNav();
  // A language the board has no catalogue for must not stay in the address,
  // for the same reason a stale ?d= must not: the bar would be claiming
  // something the page is not doing.
  const askedLang=new URLSearchParams(location.search).get('lang');
  if(askedLang&&askedLang!==langPicked()&&history.replaceState){
    try{history.replaceState(null,'',boardUrl({lang:langPicked()}));}catch(e){}
  }
  let index;
  try{
    index=await fetch(assetUrl('districts.json')).then(r=>r.json());
  }catch(e){
    document.querySelector('main').insertAdjacentHTML('afterbegin',
     `<div class="wrap"><p style="color:var(--red-ink);padding:20px 0">${
       esc(T('Could not load the district list. {error}',{error:e.message}))}</p></div>`);
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
    try{history.replaceState(null,'',boardUrl({d:did}));}catch(e){}
  }
  buildDistrictNav(index,did);
  const meta=index.districts[did]||{};
  // versioned from the index, so a deploy cannot serve new markup with stale data
  const v=h=>h?`?v=${h}`:'';
  if(meta.gone) showGone(meta); else loadLive(`d/${did}/live.json${v(meta.v)}`);
  loadHistory(`d/${did}/data.json${v(meta.vd)}`);
  // A third document on its own monthly schedule. Only fetched when the
  // district has one — meta.vg is written by stamp_assets only for a district
  // with a geo.json — so a district without locations costs no request and
  // the section simply never appears.
  if(meta.vg) loadGeo(`d/${did}/geo.json?v=${meta.vg}`); else standDownMap('');
}
boot();
