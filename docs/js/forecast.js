import {$, S, T, esc} from './core.js?v=747c374189';

/* The forecast is a third document per district (forecast.json), written by
   scripts/build_forecast.py. It is odds, not a result, so every place that
   shows it says so and nothing breaks when it is missing or late. */

export function fcFor(n){ return S.fc&&S.fc.clubs?S.fc.clubs[n]:null; }

/* On track / Winnable / At risk by P(Distinguished). "Out of reach" is kept for
   outcomes that are locked - no Success Plan, suspension, no goals left - so a
   merely unlikely club is told what to do, not that it is finished. */
export function fcLabel(f,c){
  if(!f) return null;
  if(f.status==='suspended') return ['out',T('Suspended')];
  if(c&&(c.csp==='N'||c.ceil<5)) return ['out',T('Out of reach')];
  const p=f.pTier.distinguished;
  return p>=.8?['on',T('On track')]:p>=.4?['win',T('Winnable')]
    :p>=.1?['risk',T('At risk')]:['long',T('Long shot')];
}

const pct=p=>Math.round(p*100)+'%';

/* Table cell: median goals with its P10-P90 range, then the odds chip. */
export function fcCell(c){
  const f=fcFor(c.n); if(!f) return '<span class="lvfc"></span>';
  if(f.status==='suspended')
    return `<span class="lvfc"><span class="fcchip" data-l="out">${esc(T('Suspended'))}</span></span>`;
  const [l,word]=fcLabel(f,c), g=f.goals;
  const held=g.median>=5&&f.pTier.distinguished<.4
    ?' '+T('Held back by membership: likely {n} members at 30 June.',{n:f.members.median}):'';
  return `<span class="lvfc" title="${esc(T('Forecast for 30 June: {m} goals, range {lo} to {hi}.',
    {m:g.median,lo:g.p10,hi:g.p90})+held)}"><b>${g.median}</b><span class="fcr">${g.p10}–${g.p90}</span>`+
    `<span class="fcchip" data-l="${l}">${esc(word)} ${pct(f.pTier.distinguished)}</span></span>`;
}

/* Drawer: one line of forecast under an existing tile, never a tile of its own.
   which is 'goals', 'members' or 'odds'. Empty when there is no forecast. */
export function fcSub(c,which){
  const f=fcFor(c.n); if(!f||f.status!=='active') return '';
  const r=which==='goals'?f.goals:f.members;
  const dcp=which==='goals'?'DCP ':'';
  const t=which==='odds'
    ? T('{p} to finish Distinguished',{p:pct(f.pTier.distinguished)})
    : T('Likely {dcp}{m} by June 30',{dcp,m:r.median})+'\n'
      +T('({dcp}range: {lo}\u2013{hi})',{dcp:which==='goals'?'DCP ':'',lo:r.p10,hi:r.p90});
  return `<div class="fcsub${which==='goals'?' fcdcp':''}">${esc(t)}</div>`;
}

/* Tally tile: expected Distinguished clubs for the district, with its 80% band. */
export function fcTile(){
  const d=S.fc&&S.fc.district; if(!d) return null;
  return [T('Expected Distinguished by 30 June'),`${d.expected|0}`,
    T('likely range {lo}–{hi}',{lo:d.p10,hi:d.p90})];
}

export function loadForecast(url){
  return fetch(url).then(r=>r.ok?r.json():Promise.reject(new Error(r.status))).then(doc=>{
    S.fc=doc;
    // whichever of live.json and this lands second draws the forecast in
    if(S.l) document.dispatchEvent(new Event('forecast'));
  }).catch(e=>console.warn('forecast unavailable',e.message));
}
