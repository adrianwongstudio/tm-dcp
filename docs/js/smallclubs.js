import {$, S, T, esc} from './core.js?v=a2dc3aa5d9';
import {openDetail, openLiveDetail} from './detail.js?v=a2dc3aa5d9';
import {buildXlsx, dprefix, saveBlob} from './workbooks.js?v=a2dc3aa5d9';

/* ---------- clubs under 8 members on October 1st ----------
   live.json's oct1 block: [this year, last year] member counts per club, for
   every club short this year. A null last-year count means the club was not on
   that report. */
const cell=(n,limit)=>n==null?'<td class="num none">—</td>'
  :`<td class="num${n<limit?' low':''}">${n}</td>`;

export function drawSmall(){
  const o=S.l.oct1, sec=$('small8');
  if(!o){sec.hidden=true;return;}
  sec.hidden=false;
  const [y0,y1]=o.years;
  $('s8Chip').textContent=T('{n} clubs',{n:o.clubs.length});
  $('s8Table').innerHTML=`<thead><tr><th>${esc(T('Club'))}</th><th>${esc(T('Division'))}</th><th>${esc(T('Area'))}</th>
    <th class="num">${esc(T('Oct 1st {y}',{y:y0}))}</th><th class="num">${esc(T('Oct 1st {y}',{y:y1}))}</th></tr></thead>
    <tbody>${o.clubs.map(c=>`<tr data-n="${esc(c.n)}" style="cursor:pointer"><td>${esc(c.m)}</td><td>${esc(c.d)}</td><td>${esc(c.a)}</td>
      ${cell(c.c[0],o.limit)}${cell(c.c[1],o.limit)}</tr>`).join('')}</tbody>`;
  $('s8Table').querySelectorAll('tbody tr').forEach(tr=>{tr.onclick=()=>{
    // the open year first, as the club search does; a club that has left the
    // live roster has only its finished years to open
    const n=tr.dataset.n;
    if(S.l.clubs.some(c=>c.n===n)) return openLiveDetail(n);
    const i=(S.d.clubs||[]).findIndex(c=>c.n===n);
    if(i>=0) openDetail(i);};});
  $('s8Xlsx').onclick=()=>saveBlob(smallXlsx(o),`${dprefix()}_Under8_Oct1_${y0}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function smallXlsx(o){
  const [y0,y1]=o.years, H=t=>({v:t,s:5});
  const rows=[[{v:T('Clubs Not in Good Standing'),s:6}],[],
    [H(T('Club')),H(T('Club number')),H(T('Division')),H(T('Area')),
     H(T('Oct 1st {y}',{y:y0})),H(T('Oct 1st {y}',{y:y1}))],
    ...o.clubs.map(c=>[c.m,c.n,c.d,c.a,...c.c.map(n=>n==null?'':{v:n,s:n<o.limit?3:0})])];
  return buildXlsx([{name:'Under 8 on Oct 1st',rows,widths:[44,14,10,8,16,16]}]);
}
