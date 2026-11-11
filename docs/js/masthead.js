import {SHORT, TARGETS} from './charts.js?v=a41e91580d';
import {$, S, T, esc} from './core.js?v=a41e91580d';
import {LOC} from './lang.js?v=a41e91580d';
import {retileMap} from './map.js?v=a41e91580d';

/* ---------- masthead state ---------- */
/* Four destinations cover the sections: Climbed and Slipped is read against
   the charts beside it, so the two share Trends. */
(function(){
  const nav=$('mastnav'); if(!nav||!('IntersectionObserver' in window)) return;
  const OWNER={inyear:'#inyear',board:'#board',signals:'#signals',movement:'#signals',clubs:'#clubs'};
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
  },{rootMargin:'-88px 0px -55% 0px',threshold:[0,.1,.35,.7,1]});
  Object.keys(OWNER).forEach(id=>{const el=$(id); if(el) io.observe(el);});
})();

/* ---------- phone menu ---------- */
(function(){
  const mast=document.querySelector('.mast'),btn=$('menubtn');
  const set=open=>{mast.classList.toggle('menu-open',open);btn.setAttribute('aria-expanded',String(open));};
  btn.onclick=()=>set(btn.getAttribute('aria-expanded')!=='true');
  $('mastnav').addEventListener('click',e=>{if(e.target.closest('a')) set(false);});
  mast.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&btn.getAttribute('aria-expanded')==='true'){set(false);btn.focus();}
  });
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
  const label=()=>btn.setAttribute('aria-label',isDark()?T('Switch to light theme'):T('Switch to dark theme'));
  btn.onclick=()=>{
    const next=isDark()?'light':'dark';
    root.setAttribute('data-theme',next);
    try{localStorage.setItem('tm-theme',next);}catch(e){}
    label();
    // Every other colour on the page is a token and turns over on its own.
    // The basemap is an image from somewhere else, so it has to be swapped.
    if(typeof retileMap==='function') retileMap();
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{
    label();
    if(typeof retileMap==='function') retileMap();
  });
  label();
})();


/* Everything that names a district or points off-site comes from config.json,
   travels in data.json, and is applied here — so a new district is a config
   edit, not a hunt through the markup. */
export function applySiteConfig(d){
  const s=d.site||{}, name=d.district||'';
  const set=(id,fn)=>{const el=$(id); if(el) fn(el);};
  if(s.description){const m=document.querySelector('meta[name="description"]');
    if(m) m.setAttribute('content',s.description);}
  if(s.eyebrow) S.eyebrow=s.eyebrow;
  setEyebrow();
  setUpdateNote(s);
  document.title=`${name||T('Club Health')} \u2014 ${T(s.title_suffix||'Club Health Board')}`;
  if(name){ set('footSource',el=>el.textContent=
    /^District\s+\S+$/.test(name)?T('District {n}',{n:name.split(/\s+/)[1]}):name); }
  ['footRepo','navData'].forEach(id=>{ if(s.repo_url) set(id,el=>el.href=s.repo_url); });
  set('footDash',el=>{ if(d.district_id) el.href=`https://dashboards.toastmasters.org/District.aspx?id=${d.district_id}`; });
}

/* How often the board moves, and when it moves next — in the reader's own day
   and clock, because they are spread across the world and the refresh is a
   single instant: 16:00 UTC Sunday is Sunday morning in Vancouver and Monday
   before dawn in Sydney. The build sends that instant; everything local is
   worked out here, from the browser's own zone and locale, so nobody has to be
   asked where they are.

   The cadence is the owner's sentence from config.json and `{day}` in it is
   the reader's weekday, not the schedule's. The date is dropped once it has
   passed — someone can be reading a copy the cache kept, and a promise for
   last Sunday is worse than no promise — while the weekday survives, since a
   weekly schedule keeps its local day whether or not this one has gone. */
function setUpdateNote(s){
  const el=$('updNote'); if(!el) return;
  const cadence=(s.update_cadence||'').trim();
  if(!cadence){ el.hidden=true; return; }
  // An instant or nothing: a bare date would be read as midnight UTC, which
  // is the evening before for half the world — the exact mistake this line
  // exists to avoid. A cache serving data older than this script hits it.
  let at=/T/.test(s.next_update||'')?new Date(s.next_update):null;
  const known=at&&!isNaN(at.getTime());
  // The build names the next occasion; the page carries it forward. A build
  // is what re-dates the field and it always lands after the hour it named,
  // so without this the line would go blank every week in the gap between
  // the two — and for a week whenever a run was missed.
  const every=(s.update_every||0)*864e5;
  if(known&&every>0&&at<=Date.now()){
    at=new Date(at.getTime()+(Math.floor((Date.now()-at.getTime())/every)+1)*every);
  }
  // The cadence's day is the standing promise's, read off a moment that is
  // still ahead and so can be put in the reader's zone. A one-off lends it
  // nothing — "back on the 25th" does not make the board a Friday board — and
  // then the configured weekday stands in, in the schedule's own zone, which
  // is the best available with no live moment to read it off.
  const due=known&&at>new Date()?at:null;
  const day=(due&&every>0)?due.toLocaleDateString(LOC(),{weekday:'long'})
    :T(s.update_weekday||'');
  // A cadence that asks for a day and cannot be given one says nothing true.
  if(cadence.includes('{day}')&&!day){ el.hidden=true; return; }
  const when=due?due.toLocaleDateString(LOC(),{weekday:'short',day:'numeric',month:'short'})
    +', '+due.toLocaleTimeString(LOC(),{hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'';
  el.innerHTML=`<span class="updcad">${esc(T(cadence).replace('{day}',day))}</span>`
    +(when?' \u00b7 '+T('Next Update <b>{when}</b>',{when:esc(when)}):'');
  el.hidden=false;
}

/* The eyebrow names the programme and the span the page covers. The span is
   read off the data — the finished years plus the open one — rather than being
   written into the config, so it is right the morning after a year rolls. */
export const spanYr=y=>y.slice(0,4)+'\u2013'+y.slice(7,9);

/* Thirty districts were created this program year and have no finished years
   at all, so the deck cannot claim five of them. */
const NUM=['no','one','two','three','four','five','six'];
function yearPhrase(d,l){
  const n=((d&&d.years)||[]).length;
  if(!n) return l?T('the year still running'):T('no finished years yet');
  const w=T(NUM[n]||String(n));
  const finished=n===1?T('{n} finished year',{n:w}):T('{n} finished years',{n:w});
  return l?T('{years} and the one still running',{years:finished}):finished;
}
/* The router's counts normally come off the last finished year. A district
   that has none can still answer two of them from the year it is running, and
   this is called from both loaders because they race: whichever of the two
   documents lands second is the first moment both figures are knowable. */
export function setOpenYearRouter(){
  if(!S.l||!S.d||(S.d.years||[]).length) return;
  const rows=S.l.clubs.map(c=>c.v).filter(Boolean);
  if(rows.length){
    const worst=Math.min(...SHORT.map((_,j)=>
      rows.filter(g=>g[j]!=null&&g[j]>=TARGETS[j]).length/rows.length*100));
    const rg=$('rGap'); if(rg) rg.innerHTML=Math.round(worst)+'<u>%</u>';
  }
  const ry=$('rYears'); if(ry) ry.innerHTML='1<u>yr</u>';
}

export function setYearPhrase(){
  const el=$('hYears'); if(el) el.textContent=yearPhrase(S.d,S.l);
}

export function setEyebrow(){
  const el=$('heroEyebrow'); if(!el) return;
  const Y=(S.d&&S.d.years)||[];
  const last=(S.l&&S.l.py)||Y[Y.length-1];
  const lead=S.eyebrow||el.textContent.trim();
  el.textContent=(Y.length&&last)
    ?T('{lead} \u00b7 {first} to {last}',{lead:T(lead),first:spanYr(Y[0]),last:spanYr(last)})
    :T(lead);
}
