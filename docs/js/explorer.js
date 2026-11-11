import {LIVE} from './board.js?v=747c374189';
import {$, S, T, esc, sayCount, shortYr, sig, spark} from './core.js?v=747c374189';
import {openDetail, openLiveDetail} from './detail.js?v=747c374189';
import {asofText, goneFromRoster} from './live.js?v=747c374189';
import {dprefix, historyXlsx, saveBlob} from './workbooks.js?v=747c374189';

/* ---------- explorer ---------- */
/* On a phone the year columns run newest-first, so the year everyone came for
   is on screen before any sideways scrolling. The pinned club column is CSS. */
export const NARROW=matchMedia('(max-width:768px)');
/* The columns of the club table: every finished year, then the one still
   running. A club's run does not stop at the last closed year, and this is the
   section that is about a club rather than about a district. */
/* The finished years the club-level views span. For most districts that is
   simply its own archive. A district created this program year has none, and
   its clubs' years sit in `cyears` instead \u2014 the record belongs to the clubs,
   so the club table and the movement lists read it, and nothing that reports on
   the district does. */
export const clubYears=()=>{
  const d=S.d||{};
  return (d.years&&d.years.length)?d.years:(d.cyears||[]);
};

export const tableYears=()=>{
  const a=clubYears().slice();
  if(S.l&&S.l.py) a.push(LIVE);
  return a;
};
const yearOrder=()=>NARROW.matches?tableYears().reverse():tableYears();

/* A club's year-end score for one year: this district's own record, or, where
   the district has no row for the club that year, the score the district that
   did hold it recorded. crosslink.py writes that as `ay`.

   The number is the club's either way \u2014 a club that transferred in did not
   stop earning goals, and five dashes on a page about that club is simply
   wrong. Which district recorded it is a footnote the cell carries rather than
   a claim this district makes. Nothing that aggregates a district uses this:
   the board, the division averages, the goal gap and the movement lists all
   stay on the years the district really had. */
export const districtName=did=>{
  const e=S.index&&S.index.districts&&S.index.districts[did];
  return (e&&e.name)||`District ${did}`;
};

export function clubYear(c,y){
  if(y===LIVE){
    const l=S.l?S.l.clubs.find(x=>x.n===c.n):null;
    // the open year's figures, shaped like a finished year's record so every
    // reader of one can read the other: `v` is the same twelve rows as `g`
    return l?{rec:{f:l.met,st:l.now?l.now+' Distinguished':'',mb:l.mb,md:l.md,g:l.v,csp:l.csp},
              away:null,live:true}
           :{rec:null,away:null,live:true};
  }
  const own=(c.y||{})[y];
  if(own&&own.f!=null) return {rec:own,away:null};
  const a=(c.ay||{})[y];
  return a?{rec:a,away:a.x}:{rec:null,away:null};
}
export function clubScore(c,y){
  const {rec,away}=clubYear(c,y);
  return {f:rec?rec.f:null,away};
}

/* Every club this district has had or has. The archive alone is not that list:
   a club that joined this July has no row in it, so it was missing from a table
   that now carries a column for the year it joined \u2014 154 clubs in District 227,
   which has no archive at all, and 4 in District 21, which does. */
export function districtClubs(){
  const out=((S.d&&S.d.clubs)||[]).slice();
  const seen=new Set(out.map(c=>c.n));
  ((S.l&&S.l.clubs)||[]).forEach(l=>{
    if(seen.has(l.n)) return;
    out.push({n:l.n,m:l.m,d:l.d,a:l.a,y:{}});
  });
  return out;
}

export function drawClubs(){
  const q=$('q').value.trim().toLowerCase(),dv=$('fdiv').value,so=$('fsort').value;
  const Y=tableYears(), YO=yearOrder(), latest=Y[Y.length-1];
  const head=$('clubHead');
  if(head) head.innerHTML=`<th>${esc(T('Club'))}</th><th>${esc(T('Div'))}</th>`+
    YO.map(y=>`<th class="yrcell${y===LIVE?' nowcol':''}">${
      esc(y===LIVE?shortYr(S.l.py):shortYr(y))}</th>`).join('')+`<th>${esc(T('Trace'))}</th>`;
  const chip=$('clChip');
  if(chip){
    const n=clubYears().length, own=(S.d.years||[]).length;
    chip.textContent=(n===1?T('{n} finished year',{n}):T('{n} finished years',{n}))
      +(own?'':T(' the clubs bring'))
      +(S.l&&S.l.py?T(' + the one running'):'');
  }
  const all=districtClubs();
  // the division list belongs here too: it has to cover clubs the archive
  // never saw, and only this function knows the whole roster
  const sel=$('fdiv');
  if(sel){
    const divs=[...new Set(all.map(c=>c.d).filter(Boolean))].sort(), sig=divs.join(',');
    if(sel.dataset.sig!==sig){
      const want=sel.value;
      sel.dataset.sig=sig;
      sel.innerHTML=`<option value="">${esc(T('All divisions'))}</option>`+
        divs.map(x=>`<option value="${esc(x)}">${esc(T('Division {n}',{n:x}))}</option>`).join('');
      sel.value=divs.indexOf(want)>=0?want:'';
    }
  }
  let list=all.filter(c=>(!dv||c.d===dv)&&(!q||c.m.toLowerCase().includes(q)||c.n.includes(q)));
  // the column shows a brought-in score, so the sorts count it too
  const last=c=>clubScore(c,Y[Y.length-1]).f??-1;
  const swing=c=>{const v=Y.map(y=>clubScore(c,y).f).filter(x=>x!=null);
    return v.length<2?-1:Math.max(...v)-Math.min(...v);};
  list.sort(so==='name'?(a,b)=>a.m.localeCompare(b.m):so==='last'?(a,b)=>last(b)-last(a)
    :so==='lastasc'?(a,b)=>last(a)-last(b):(a,b)=>swing(b)-swing(a));
  sayCount(list.length);
  $('clubtb').innerHTML=list.map(c=>{
    // The numeral stays ink. A coloured numeral at this size is the least
    // legible use of colour and the worst case for red-green deficiency, so
    // where a figure needs a status it gets a dot beside it instead.
    const cells=YO.map(y=>{const {f,away}=clubScore(c,y);
      if(f==null) return '<td class="yrcell num" style="color:var(--muted)">—</td>';
      const now=y===latest;
      const t=y===LIVE
        ? ` title="${esc(T('{met} of 10 goals so far in {year}, as of {date}',
            {met:f,year:S.l.py,date:asofText()}))}"`
        : away?` title="${esc(T('{met} of 10 goals in {year}, earned in {district}',
            {met:f,year:y,district:districtName(away)}))}"`:'';
      return `<td class="yrcell"><span class="yv${now?' now':''}${away?' away':''}"${t}>${
        now?'<i class="sdot" data-sig="n"></i>':''}${f}</span></td>`;}).join('');
    return `<tr data-n="${esc(c.n)}" style="cursor:pointer">
      <td class="cname"><button class="rowbtn ${goneFromRoster(c.n)?'gone':''}" type="button"
        translate="no">${esc(c.m)}</button>${
        goneFromRoster(c.n)?`<span class="cgone" title="${esc(GONE)}">${esc(T('off roster'))}</span>`:''
      }<span class="cmeta">${esc(c.d)}/${esc(c.a)} · ${esc(c.n)}</span></td>
      <td class="num">${esc(c.d)}/${esc(c.a)}</td>${cells}
      <td>${spark(Y.map(y=>clubScore(c,y).f))}</td></tr>`;}).join('');
  $('clubtb').querySelectorAll('tr').forEach(tr=>{
    const go=()=>{
      // a club with no archive row has only an open year to open
      const i=(S.d.clubs||[]).findIndex(c=>c.n===tr.dataset.n);
      return i>=0?openDetail(i):openLiveDetail(tr.dataset.n);
    };
    tr.onclick=go;});
  $('clubnote').textContent=T('{shown} of {total} clubs',{shown:list.length,total:all.length});
  const hb=$('histXlsx');
  if(hb){
    hb.onclick=()=>saveBlob(historyXlsx(),
      `${dprefix()}_YearByYear.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const rows=all.reduce((n,c)=>n+Y.filter(y=>clubYear(c,y).rec).length,0);
    const m=$('histMeta');
    if(m) m.textContent=Y.length===1
      ? T('Excel workbook \u00b7 {clubs} clubs \u00b7 {pairs} club-years \u00b7 {years} year',
          {clubs:all.length,pairs:rows,years:Y.length})
      : T('Excel workbook \u00b7 {clubs} clubs \u00b7 {pairs} club-years \u00b7 {years} years',
          {clubs:all.length,pairs:rows,years:Y.length});
  }
}
