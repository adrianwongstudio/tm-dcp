import {$, T, esc, shortYr} from './core.js?v=d722d32934';
import {boardUrl} from './lang.js?v=d722d32934';

/* ---------- which district ---------- */
/* Which district this page is showing. The URL wins, then the last one the
   reader chose, then the index's default. An unknown id is not an error worth
   a message — it is a stale link, and the default is the useful answer. */
export const DKEY='tm-district';
export function pickDistrict(index){
  const known=new Set(Object.keys(index.districts));
  const asked=new URLSearchParams(location.search).get('d');
  if(asked&&known.has(asked)) return asked;
  let saved=null; try{saved=localStorage.getItem(DKEY);}catch(e){}
  if(saved&&known.has(saved)) return saved;
  return known.has(index.default)?index.default:Object.keys(index.districts)[0];
}

/* Numbered districts in numeric order, then the lettered ones (F, U). */
const byNumber=(a,b)=>{
  const na=/^\d+$/.test(a), nb=/^\d+$/.test(b);
  return na&&nb?a-b:na?-1:nb?1:a.localeCompare(b);
};

export function buildDistrictNav(index,did){
  const sel=$('districtPick');
  if(!sel) return;
  // "District 21" is the build's own wording, not a name Toastmasters
  // registered, so the word in front of the number is translated like any other
  const dName=n=>/^District\s+\S+$/.test(n||'')?T('District {n}',{n:n.split(/\s+/)[1]}):n;
  const opt=d=>{
    const e=index.districts[d]||{};
    const lbl=e.gone?T('{district} · to {year}',{district:dName(e.name),year:shortYr(e.last||'')})
                    :dName(e.name);
    return `<option value="${esc(d)}"${d===did?' selected':''}>${esc(lbl)}</option>`;
  };
  // The 2026-27 realignment dissolved 68 districts. Their finished years are
  // still the record of those clubs, so they stay on the list — in a group of
  // their own, because they are not part of any region the dashboard has now.
  const gone=(index.retired||[]).filter(d=>index.districts[d]);
  const live=index.regions.flatMap(r=>r.d).filter(d=>index.districts[d]).sort(byNumber);
  sel.innerHTML=live.map(opt).join('')
    +(gone.length?`<optgroup label="${esc(T('No longer a district'))}">`+gone.sort(byNumber).map(opt).join('')+`</optgroup>`:'');
  sel.value=did;
  const lbl=$('districtLabel');
  if(lbl) lbl.innerHTML=esc(dName((index.districts[did]||{}).name)||T('District {n}',{n:did}))
    .replace(/\s/,'&nbsp;');
  sel.onchange=()=>{
    const next=sel.value;
    try{localStorage.setItem(DKEY,next);}catch(e){}
    // A full navigation rather than an in-place swap: every section, the
    // drawer and the year scrub all derive from the two documents, and
    // reloading is the one way that cannot leave a stale corner behind.
    location.assign(boardUrl({d:next,c:null}));
  };
}
