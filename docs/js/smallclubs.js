import {$, S, T, esc} from './core.js?v=f5db252855';
import {buildXlsx, dprefix, saveBlob} from './workbooks.js?v=f5db252855';

/* ---------- clubs under 8 members on 1 October ----------
   live.json's oct1 block: [this year, last year] member counts per club, for
   every club short in either year. A null count means the club was not on
   that year's report. */
const cell=(n,limit)=>n==null?'<td class="num none">—</td>'
  :`<td class="num${n<limit?' low':''}">${n}</td>`;

export function drawSmall(){
  const o=S.l.oct1, sec=$('small8');
  if(!o){sec.hidden=true;return;}
  sec.hidden=false;
  const [y0,y1]=o.years;
  $('s8Chip').textContent=T('{n} clubs',{n:o.clubs.length});
  $('s8Table').innerHTML=`<thead><tr><th>${esc(T('Club'))}</th><th>${esc(T('Div'))}</th>
    <th class="num">${esc(T('1 Oct {y}',{y:y0}))}</th><th class="num">${esc(T('1 Oct {y}',{y:y1}))}</th></tr></thead>
    <tbody>${o.clubs.map(c=>`<tr><td>${esc(c.m)}</td><td>${esc(c.d+c.a)}</td>
      ${cell(c.c[0],o.limit)}${cell(c.c[1],o.limit)}</tr>`).join('')}</tbody>`;
  $('s8Xlsx').onclick=()=>saveBlob(smallXlsx(o),`${dprefix()}_Under8_Oct1_${y0}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function smallXlsx(o){
  const [y0,y1]=o.years, H=t=>({v:t,s:5});
  const rows=[[{v:T('Clubs under 8 members on 1 October'),s:6}],[],
    [H(T('Club')),H(T('Club number')),H(T('Division')),H(T('Area')),
     H(T('1 Oct {y}',{y:y0})),H(T('1 Oct {y}',{y:y1}))],
    ...o.clubs.map(c=>[c.m,c.n,c.d,c.a,...c.c.map(n=>n==null?'':{v:n,s:n<o.limit?3:0})])];
  return buildXlsx([{name:'Under 8 on 1 Oct',rows,widths:[44,14,10,8,16,16]}]);
}
