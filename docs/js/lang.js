import {$, DICT, assetUrl, esc, setDict} from './core.js?v=2674e1fc7c';

/* ---------- language ---------- */
/* The board is read worldwide, and Toastmasters publishes its own material in
   seven languages. The English text in index.html is the source: a catalogue
   is keyed by that English, so a missing or broken translation falls back to
   the words that are already in the markup rather than to a blank page or a
   key. English therefore costs no fetch at all.

   Switching language reloads the page, the same way switching district does.
   Every section, the drawer and the year scrub are drawn from the two
   documents, and a reload is the one way that cannot leave a stale corner
   behind — here it also saves re-running every draw with a new catalogue. */
const LKEY='tm-lang';
/* Only languages with a catalogue are listed. A language in this list with no
   file behind it would be a dead option in the menu. */
const LANGS=[
  {c:'en',n:'English'},
  {c:'es',n:'Español'},
  {c:'fr',n:'Français'},
  {c:'de',n:'Deutsch'},
  {c:'zh-Hans',n:'简体中文'},
  {c:'zh-Hant',n:'繁體中文'},
  {c:'ar',n:'العربية'},
];
const RTL={ar:1};
/* Every address the page writes for itself is built here, so a part nobody
   happened to be thinking about — the language, usually — cannot be dropped
   by a path that only cared about the district. Order is scope, then how it
   is read, then what is open. */
export function boardUrl(over){
  over=over||{};
  const now=new URLSearchParams(location.search);
  const pick=k=>k in over?over[k]:now.get(k);
  const p=new URLSearchParams();
  ['d','lang','c'].forEach(k=>{const v=pick(k); if(v) p.set(k,v);});
  const q=p.toString();
  return q?'?'+q:location.pathname;
}
/* A language in the address wins over the remembered one: a link sent in
   Español is a request to read it in Español, the same way ?d= is a request
   for that district. Both are then remembered, so the next visit holds. */
export const langPicked=()=>{
  const asked=new URLSearchParams(location.search).get('lang');
  if(LANGS.some(l=>l.c===asked)) return asked;
  let v=null; try{v=localStorage.getItem(LKEY);}catch(e){}
  return LANGS.some(l=>l.c===v)?v:'en';
};
/* Collapse the markup's own indentation so a key written on three lines in
   index.html matches the one line in the catalogue. */
const i18nKey=el=>el.innerHTML.replace(/\s+/g,' ').trim();
/* Dates and numbers follow the language the reader picked, not the browser's:
   a page set in Spanish that dates itself in English is half-translated. */
export const LOC=()=>langPicked();
function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const v=DICT[i18nKey(el)];
    if(v) el.innerHTML=v;
  });
  document.querySelectorAll('[data-i18n-label]').forEach(el=>{
    const v=DICT[el.getAttribute('aria-label')];
    if(v) el.setAttribute('aria-label',v);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{
    const v=DICT[el.placeholder];
    if(v) el.placeholder=v;
  });
  const t=DICT[document.title];
  if(t) document.title=t;
}
/* Fetched before anything draws, so no section is ever built in one language
   and labelled in another. A catalogue that fails to load leaves the English
   in place, which is a working page, so the failure is logged and not shown. */
export async function loadLang(){
  const lang=langPicked();
  try{localStorage.setItem(LKEY,lang);}catch(e){}
  document.documentElement.lang=lang;
  document.documentElement.dir=RTL[lang]?'rtl':'ltr';
  if(lang==='en') return;
  try{
    setDict(await fetch(assetUrl(`i18n/${lang}.json`)).then(r=>r.ok?r.json():Promise.reject(new Error(r.status))));
  }catch(e){ console.error('language catalogue failed, staying in English',e); setDict({}); }
  applyI18n();
}
export function buildLangNav(){
  const sel=$('langPick'), lab=$('langLabel');
  if(!sel) return;
  const cur=langPicked();
  /* Each language is written in its own language: a reader looking for Deutsch
     should not have to recognise the English word "German". */
  sel.innerHTML=LANGS.map(l=>
    `<option value="${l.c}"${l.c===cur?' selected':''}>${esc(l.n)}</option>`).join('');
  sel.value=cur;
  if(lab) lab.textContent=(LANGS.find(l=>l.c===cur)||LANGS[0]).n;
  /* One language is no choice. Until a second catalogue lands, the control
     would be a menu with a single item in it. */
  const pick=sel.closest('.langpick');
  if(pick) pick.hidden=LANGS.length<2;
  /* The language goes into the address, the way the district does: a reader
     who has the board in their own language can send that page to someone
     else and have it arrive the same way. */
  sel.onchange=()=>{
    try{localStorage.setItem(LKEY,sel.value);}catch(e){}
    location.assign(boardUrl({lang:sel.value}));
  };
}
