export const S={d:null,year:null,mv:null,lvSort:{k:'met',dir:-1},l:null,fc:null,did:null,index:null,askedClub:null,
  geo:null,map:null,mapLayer:null,mapDiv:'',mapQ:''};
export const $=id=>document.getElementById(id);

/* Tells a screen reader what a filter, sort or year change did to a list.
   Silent until the reader has done something, so page load announces nothing. */
let touched=false;
['input','change','click','keydown'].forEach(t=>
  addEventListener(t,()=>{touched=true;},{capture:true,once:true}));
function say(text){
  const el=$('srStatus');
  if(touched&&el) el.textContent=text;
}
export const sayCount=n=>say(n?T('{n} clubs shown',{n}):T('No clubs match.'));
export let DICT={};
/* An imported binding cannot be reassigned from another module. */
export const setDict=d=>{DICT=d;};
/* T('English source', {vars}) — the English is the key and the fallback. */
export function T(src,vars){
  let out=DICT[src]||src;
  if(vars) out=out.replace(/\{(\w+)\}/g,(m,k)=>k in vars?vars[k]:m);
  return out;
}

/* Every signal colour is a pair, not a value. The fill stays vivid so the
   traffic-light reading holds; ink() is the same status set as type against the
   page, and on() is the text that sits ON the fill — amber never takes white,
   which is where the old single value measured near 2:1. */
const PAIR={'var(--green)':['var(--green-ink)','var(--green-on)'],
            'var(--amber)':['var(--amber-ink)','var(--amber-on)'],
            'var(--red)'  :['var(--red-ink)',  'var(--red-on)']};
export const ink=v=>(PAIR[v]||[v])[0];
export const on =v=>(PAIR[v]||[,'var(--ink)'])[1];

export const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const sig=v=>v==null?'x':v>=5?'g':v>=3?'a':'r';
export const shortYr=y=>y.slice(2,4)+'–'+y.slice(7,9);
export function badge(st){
  if(!st) return '<span class="badge">—</span>';
  const t=/President/.test(st)?'p':/Select|Smedley/.test(st)?'s':'d';
  const lbl=st.replace(/ Distinguished$/,'');
  return `<span class="badge" data-t="${t}">${esc(T(lbl))}</span>`;
}
/* Five-year trace: the line, a dotted rule at the 5-goal mark labelled "5",
   and the goal count above each year's point. In a right-to-left page the x
   positions are mirrored so the line still runs oldest to newest. */
export function spark(vals){
  const w=112,h=34,n=vals.length,pw=94,lead=14,rtl=document.documentElement.dir==='rtl';
  const X=i=>{const x=lead+4+i*((pw-8)/(n-1)); return rtl?w-x:x;};
  const Y=v=>h-3-(v/10)*(h-13);
  const pts=vals.map((v,i)=>v==null?null:[X(i),Y(v),v]).filter(Boolean);
  if(pts.length<2) return `<svg width="${w}" height="${h}" aria-hidden="true"></svg>`;
  const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const last=pts[pts.length-1];
  const c=ink(sig(last[2])==='g'?'var(--green)':sig(last[2])==='a'?'var(--amber)':'var(--red)');
  const y5=Y(5).toFixed(1), x1=rtl?w-lead-4:lead+4, x2=rtl?w-lead-pw+4:lead+pw-4, lx=rtl?w:0;
  const txt="font-family:'IBM Plex Mono',monospace;font-size:9.5px";
  const nums=pts.map(p=>`<text x="${p[0].toFixed(1)}" y="${(p[1]-5).toFixed(1)}" text-anchor="middle" style="${txt}" fill="var(--muted)">${p[2]}</text>`).join('');
  return `<svg width="${w}" height="${h}" aria-hidden="true" style="overflow:visible">
    <line x1="${x1}" y1="${y5}" x2="${x2}" y2="${y5}" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 2"/>
    <text x="${lx}" y="${(+y5+3).toFixed(1)}" text-anchor="${rtl?'end':'start'}" style="${txt};font-weight:700" fill="var(--ink)">5</text>
    <path d="${d}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6" fill="${c}"/>${nums}</svg>`;
}

/* index.html stamps content hashes onto the data files so a deploy cannot
   leave this script fetching a copy the preload never warmed. Falls back to
   the plain name when nothing stamped it. */
let ASSETS=null;
export function assetUrl(name){
  if(!ASSETS) ASSETS=JSON.parse($('assets').textContent);
  return ASSETS[name]||name;
}
