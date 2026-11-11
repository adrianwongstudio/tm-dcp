import {$, S, T, esc, sig} from './core.js?v=1667967b83';
import {openLiveDetail} from './detail.js?v=1667967b83';
import {LOC} from './lang.js?v=1667967b83';

/* ---------- where the clubs are ----------------------------------------
   The board read geographically, and the only section built from a third
   source: geo.json, written monthly from Toastmasters' own Find a Club
   listing, because the club performance CSV the rest of the board comes from
   carries no address.

   A pin is a club's live score in the board's own three colours, so this is
   the grid above rearranged by where the clubs actually are — not a club
   finder. Everything here stands down quietly when there is nothing to draw:
   a district with no geo.json, a district whose clubs are all online, a
   browser that could not load Leaflet. None of those is an error worth
   putting in front of a district director. */

/* Toastmasters publishes no basemap, so this is the one thing on the page
   fetched from somewhere else at read time. CARTO's Positron carries
   OpenStreetMap's data, and both are credited in the corner because the
   licence requires it. CARTO stopped serving these tiles unkeyed in September
   2026, so each request now names a key. It sits here in the open rather than
   in a secret because the browser has to send it with every tile it asks for;
   it is free, rate-limited by CARTO, and carries nothing but the basemap. */
const TILE_KEY='cb1_55eh_1_a2185ed2909312a0a80adafb';
const TILE_LIGHT='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key='+TILE_KEY;
const TILE_DARK ='https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key='+TILE_KEY;
const TILE_CREDIT='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'+
  ' &copy; <a href="https://carto.com/attributions">CARTO</a>';

const mapDark=()=>document.documentElement.getAttribute('data-theme')==='dark'||
  (!document.documentElement.getAttribute('data-theme')&&
   matchMedia('(prefers-color-scheme: dark)').matches);

/* A club's score for the year still running. The map is drawn as soon as
   geo.json lands, which may be before live.json; an unscored pin is grey and
   says so, rather than claiming a club met nothing. */
function mapScore(n){
  if(!S.l||!S.l.clubs) return null;
  if(!S.livebyno) S.livebyno=new Map(S.l.clubs.map(c=>[c.n,c]));
  const c=S.livebyno.get(n);
  return c?c.met:null;
}
const mapSig=v=>v==null?'x':sig(v);
/* Worst club wins, so a cluster never hides a club in trouble behind nine
   that are fine. */
const WORST={r:3,a:2,g:1,x:0};
const worstSig=sigs=>sigs.reduce((w,s)=>WORST[s]>WORST[w]?s:w,'x');

function mapPopup(c){
  const met=mapScore(c.n), sg=mapSig(met);
  const row=(k,v)=>`<div class="mappop-row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
  const where=[c.ad,c.co].filter(Boolean).map(esc).join('<br>');
  const when=[c.day,c.t].filter(Boolean).map(esc).join(' · ');
  const score=met==null?T('No score this year')
    :met===1?T('{n} goal met',{n:met}):T('{n} goals met',{n:met});
  return `<p class="mappop-name">${esc(c.m)}</p>
    <p class="mappop-no">${esc(c.n)}</p>
    <dl style="margin:0">
      ${c.d?row(T('Area'),esc(T('Division {d}, Area {a}',{d:c.d,a:c.a}))):''}
      ${when?row(T('Meets'),when):''}
      ${where?row(T('Where'),where):''}
      ${c.v?row(T('Online'),esc(T('Also meets online'))):''}
    </dl>
    <span class="mappop-score ${sg}">${esc(score)}</span>
    ${S.l?`<button type="button" class="mappop-open" data-club="${esc(c.n)}">${
      esc(T('Open this club'))} &rarr;</button>`:''}
    ${c.w?`<a class="mappop-open" href="${esc(c.w)}" target="_blank" rel="noopener">${
      esc(T("The club's own site"))} &rarr;</a>`:''}`;
}

function mapVisible(){
  const q=S.mapQ.trim().toLowerCase();
  return (S.geo.clubs||[]).filter(c=>{
    if(S.mapDiv&&c.d!==S.mapDiv) return false;
    if(!q) return true;
    return c.m.toLowerCase().includes(q)||c.n.includes(q);
  });
}

function buildMapFilters(){
  const divs=[...new Set((S.geo.clubs||[]).map(c=>c.d).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,LOC()));
  const box=$('mpDiv');
  // One division is not a choice, and no division at all is not a filter.
  if(divs.length<2){box.innerHTML='';return;}
  box.innerHTML=[['',T('All divisions')]].concat(divs.map(d=>[d,T('Division {d}',{d})]))
    .map(([v,lbl])=>`<button type="button" data-div="${esc(v)}" aria-pressed="${
      v===S.mapDiv}">${esc(lbl)}</button>`).join('');
  box.onclick=e=>{
    const b=e.target.closest('button[data-div]'); if(!b) return;
    S.mapDiv=b.dataset.div;
    [...box.querySelectorAll('button')].forEach(x=>
      x.setAttribute('aria-pressed',String(x===b)));
    drawMapPins(true);
  };
}

function drawMapPins(fit){
  if(!S.map||!S.mapLayer) return;
  const clubs=mapVisible();
  S.mapLayer.clearLayers();

  const markers=clubs.map(c=>{
    const sg=mapSig(mapScore(c.n));
    const m=L.marker([c.lat,c.lng],{
      icon:L.divIcon({className:'',html:`<div class="mappin ${sg}"></div>`,
        iconSize:[17,17],iconAnchor:[8,17],popupAnchor:[0,-17]}),
      title:c.m, alt:c.m
    });
    m.sg=sg;
    m.bindPopup(()=>mapPopup(c));
    return m;
  });
  S.mapLayer.addLayers(markers);

  const total=(S.geo.clubs||[]).length;
  const roster=S.l&&S.l.clubs?S.l.clubs.length:null;
  $('mpChip').textContent=clubs.length===total
    ? T('{n} clubs',{n:total}) : T('{n} of {all}',{n:clubs.length,all:total});
  // The gap between the roster and the map is the honest part of this
  // section: a club with no published address has no pin, and saying so is
  // better than a reader counting pins and finding the district short.
  $('mpNote').textContent = roster==null ? ''
    : roster>total
      ? T('{n} of the district’s {all} clubs have published an address. The rest meet online or have not filled one in.',
          {n:total,all:roster})
      : T('Locations from Toastmasters’ Find a Club listing, refreshed monthly.');

  if(fit&&markers.length){
    try{S.map.fitBounds(L.latLngBounds(markers.map(m=>m.getLatLng())),
      {padding:[40,40],maxZoom:12});}catch(e){}
  }
}

export function standDownMap(why){
  const sec=$('map'); if(!sec) return;
  // A district with no locations gets no section at all; a browser that could
  // not load the library gets a line saying so, because the heading is
  // already in the navigation by then.
  if(!why){sec.hidden=true;return;}
  sec.hidden=false;
  $('mpCanvas').hidden=true;
  $('mpDiv').innerHTML='';
  $('mpq').hidden=true;
  const fb=$('mpFallback'); fb.hidden=false; fb.textContent=why;
}

export function drawMap(){
  const sec=$('map');
  if(!sec||!S.geo||!(S.geo.clubs||[]).length){standDownMap('');return;}
  if(typeof L==='undefined'||!L.markerClusterGroup){
    standDownMap(T('The map could not load in this browser. Every club on it is also in Every Club, Year by Year below.'));
    return;
  }

  sec.hidden=false;
  // Leaflet measures its container when it is created, and a hidden section
  // measures zero — which draws one tile in the top corner and nothing else.
  // So the section is unhidden first and the map created after.
  if(!S.map){
    S.map=L.map('mpCanvas',{scrollWheelZoom:false,worldCopyJump:true})
      .setView([20,0],2);
    // Scroll belongs to the page until a reader has chosen the map; a board
    // is read by scrolling past it far more often than by zooming it.
    S.map.on('click',()=>S.map.scrollWheelZoom.enable());
    S.map.on('mouseout',()=>S.map.scrollWheelZoom.disable());
    L.tileLayer(mapDark()?TILE_DARK:TILE_LIGHT,
      {subdomains:'abcd',maxZoom:19,attribution:TILE_CREDIT}).addTo(S.map);

    S.mapLayer=L.markerClusterGroup({
      maxClusterRadius:48, showCoverageOnHover:false, chunkedLoading:true,
      iconCreateFunction:cl=>{
        const kids=cl.getAllChildMarkers(), n=kids.length;
        const sg=worstSig(kids.map(m=>m.sg||'x'));
        return L.divIcon({className:'',
          html:`<div class="mapclu ${sg}${n>99?' lg':''}">${n}</div>`,
          iconSize:n>99?[42,42]:[34,34]});
      }
    });
    S.map.addLayer(S.mapLayer);

    // A pin's popup opens the same club drawer the rest of the board uses,
    // so the map is a way into the detail rather than a dead end.
    S.map.on('popupopen',e=>{
      const btn=e.popup.getElement().querySelector('.mappop-open[data-club]');
      if(btn) btn.onclick=()=>{S.map.closePopup();openLiveDetail(btn.dataset.club);};
    });

    const q=$('mpq');
    let t=null;
    q.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{
      S.mapQ=q.value;drawMapPins(true);},180);};
  }

  buildMapFilters();
  drawMapPins(true);
  // The container had no size while the section was hidden.
  setTimeout(()=>{try{S.map.invalidateSize();}catch(e){}},0);
}

/* The basemap is the one colour on the page that is not a token, so the
   theme toggle has to reach in and change it. The layer is replaced rather
   than restyled: these are two different sets of images. */
export function retileMap(){
  if(!S.map) return;
  S.map.eachLayer(l=>{if(l instanceof L.TileLayer) S.map.removeLayer(l);});
  L.tileLayer(mapDark()?TILE_DARK:TILE_LIGHT,
    {subdomains:'abcd',maxZoom:19,attribution:TILE_CREDIT}).addTo(S.map);
}

export function loadGeo(url){
 return fetch(url).then(r=>r.ok?r.json():Promise.reject(new Error(r.status))).then(g=>{
  S.geo=g;
  drawMap();
 }).catch(()=>{
  // A district with no geo.json is the normal case for a district that has
  // not been through a monthly pass yet. It is not a failure to report.
  standDownMap('');
 });
}
