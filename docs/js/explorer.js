import {LIVE} from './board.js?v=87ce153cae';
import {$, S, T} from './core.js?v=87ce153cae';
import {dprefix, historyXlsx, saveBlob} from './workbooks.js?v=87ce153cae';

/* ---------- explorer ---------- */
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

/* The workbook that carries every club's run, year by year. The table it used
   to sit under now lives in the club table beside the board, which draws the
   same scores as a trace. */
export function wireHistory(){
  const hb=$('histXlsx'); if(!hb) return;
  const all=districtClubs(), Y=tableYears();
  hb.onclick=()=>saveBlob(historyXlsx(),
    `${dprefix()}_YearByYear.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const rows=all.reduce((n,c)=>n+Y.filter(y=>clubYear(c,y).rec).length,0);
  const m=$('histMeta');
  if(m) m.textContent=Y.length===1
    ? T('Excel workbook · {clubs} clubs · {pairs} club-years · {years} year',
        {clubs:all.length,pairs:rows,years:Y.length})
    : T('Excel workbook · {clubs} clubs · {pairs} club-years · {years} years',
        {clubs:all.length,pairs:rows,years:Y.length});
}
