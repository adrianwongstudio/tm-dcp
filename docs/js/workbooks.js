import {LIVE} from './board.js?v=a41e91580d';
import {TARGETS} from './charts.js?v=a41e91580d';
import {GOAL10} from './clubtable.js?v=a41e91580d';
import {S, shortYr} from './core.js?v=a41e91580d';
import {GOALROWS, fetchAway} from './detail.js?v=a41e91580d';
import {clubYear, clubYears, districtClubs, districtName, tableYears} from './explorer.js?v=a41e91580d';
import {asofText, fmtDate, goneFromRoster} from './live.js?v=a41e91580d';

/* ---------- a very small .xlsx writer ----------
   Enough of the OOXML package to emit a genuine workbook from the browser
   with no library: a ZIP of stored (uncompressed) parts. The rest of this
   page has no external JS and no build step; this keeps it that way. */
const CRCT=(()=>{const t=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}
  return t;})();
const crc32=u8=>{let c=0xFFFFFFFF;
  for(let i=0;i<u8.length;i++)c=CRCT[(c^u8[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
const U8=s=>new TextEncoder().encode(s);

function zipStore(files){
  const chunks=[],cd=[];let off=0;
  files.forEach(f=>{
    const nm=U8(f.name),crc=crc32(f.data),sz=f.data.length;
    const lh=new Uint8Array(30+nm.length),lv=new DataView(lh.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0,true);
    lv.setUint16(8,0,true);lv.setUint16(10,0,true);lv.setUint16(12,0x2821,true);
    lv.setUint32(14,crc,true);lv.setUint32(18,sz,true);lv.setUint32(22,sz,true);
    lv.setUint16(26,nm.length,true);lv.setUint16(28,0,true);lh.set(nm,30);
    chunks.push(lh,f.data);
    const ch=new Uint8Array(46+nm.length),cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
    cv.setUint16(8,0,true);cv.setUint16(10,0,true);cv.setUint16(12,0,true);
    cv.setUint16(14,0x2821,true);cv.setUint32(16,crc,true);cv.setUint32(20,sz,true);
    cv.setUint32(24,sz,true);cv.setUint16(28,nm.length,true);cv.setUint16(30,0,true);
    cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);
    cv.setUint32(38,0,true);cv.setUint32(42,off,true);ch.set(nm,46);
    cd.push(ch); off+=lh.length+sz;
  });
  const cdSize=cd.reduce((n,b)=>n+b.length,0);
  const end=new Uint8Array(22),ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);
  ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);
  ev.setUint32(12,cdSize,true);ev.setUint32(16,off,true);ev.setUint16(20,0,true);
  const all=[...chunks,...cd,end];
  const out=new Uint8Array(all.reduce((n,b)=>n+b.length,0));
  let q=0; all.forEach(b=>{out.set(b,q);q+=b.length;});
  return out;
}

const xe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const colName=n=>{let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=(n-m-1)/26;}return s;};
// styles: 0 plain, 1 bold, 2 met(green), 3 short(pink), 4 closed(grey), 5 header, 6 title
function sheetXml(rows,widths){
  const cols=widths&&widths.length?'<cols>'+widths.map((w,i)=>
    `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')+'</cols>':'';
  const body=rows.map((r,ri)=>{
    const cells=r.map((c,ci)=>{
      if(c==null||c==='')return '';
      const o=(typeof c==='object'&&c!==null&&'v' in c)?c:{v:c};
      const ref=colName(ci)+(ri+1), st=o.s?` s="${o.s}"`:'';
      return (typeof o.v==='number'&&isFinite(o.v))
        ? `<c r="${ref}"${st}><v>${o.v}</v></c>`
        : `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xe(o.v)}</t></is></c>`;
    }).join('');
    return `<row r="${ri+1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`;
}

function buildXlsx(sheets){
  const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="6"><fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD6EBDA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFBE0DD"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE4E9ED"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf xfId="0"/>
<xf xfId="0" fontId="1" applyFont="1"/>
<xf xfId="0" fillId="2" applyFill="1"/>
<xf xfId="0" fillId="3" applyFill="1"/>
<xf xfId="0" fillId="4" applyFill="1"/>
<xf xfId="0" fontId="2" fillId="5" applyFont="1" applyFill="1"/>
<xf xfId="0" fontId="3" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s,i)=>`<sheet name="${xe(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
  const wbr=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}
<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const files=[{name:'[Content_Types].xml',data:U8(ct)},{name:'_rels/.rels',data:U8(rels)},
    {name:'xl/workbook.xml',data:U8(wb)},{name:'xl/_rels/workbook.xml.rels',data:U8(wbr)},
    {name:'xl/styles.xml',data:U8(STYLES)}];
  sheets.forEach((s,i)=>files.push({name:`xl/worksheets/sheet${i+1}.xml`,
    data:U8(sheetXml(s.rows,s.widths))}));
  return zipStore(files);
}

export function saveBlob(bytes,name,mime){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([bytes],{type:mime}));
  a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

/* ---------- one club, as a workbook ----------
   What an area director opens next to a club officer: where the club stands
   in the open year, which goals are still reachable, and the five closed
   years behind it. */
/* One club, as a workbook: what it still has to do this year, then its run of
   finished years. `ref` need only carry a club number - the history record and
   the live one are both looked up, so this works from either drawer, and from
   a district that has no finished years at all. */
/* Every finished year this club has, wherever it was earned, oldest first.
   Three sources in order of authority: this district's own archive, the
   records crosslink carried onto it, and any other district's document handed
   in by the caller.

   The third matters for a club that transferred in this program year. Its new
   district has no archive row for it at all \u2014 4,664 such clubs in the thirty
   districts created this year and 1,204 more in established ones \u2014 while the
   drawer has been showing those years as chips the whole time. A workbook that
   said "no finished years" was contradicting the screen it came from. */
function clubHistory(ref,D,away){
  const hist=(D&&D.clubs)?D.clubs.find(x=>x.n===ref.n):null;
  const out={};
  (((D&&D.years&&D.years.length)?D.years:(D&&D.cyears)||[])).forEach(y=>{
    const r=hist&&(hist.y||{})[y];
    if(r&&r.f!=null) out[y]={rec:r,from:null};
  });
  Object.keys((hist&&hist.ay)||{}).forEach(y=>{
    if(!out[y]) out[y]={rec:hist.ay[y],from:hist.ay[y].x};
  });
  Object.keys(away||{}).forEach(src=>{
    const doc=away[src];
    const rec=doc&&(doc.clubs||[]).find(x=>x.n===ref.n);
    if(!rec) return;
    Object.keys(rec.y||{}).forEach(y=>{
      const r=rec.y[y];
      if(!out[y]&&r&&r.f!=null) out[y]={rec:r,from:src};
    });
  });
  return Object.keys(out).sort().map(y=>({y,rec:out[y].rec,from:out[y].from}));
}

/* The other districts' documents this club's workbook needs. Only fetched when
   the district's own archive has nothing for the club, which is the only case
   that needs them; everywhere else crosslink has already carried the records. */
export function clubAwayDocs(ref,D){
  const hist=(D&&D.clubs)?D.clubs.find(x=>x.n===ref.n):null;
  const own=hist&&((D.years||[]).some(y=>(hist.y||{})[y])||Object.keys(hist.ay||{}).length);
  const o=(hist&&hist.o)||ref.o||[];
  if(own||!o.length) return Promise.resolve(null);
  const srcs=[...new Set(o.map(p=>p[0]))];
  return Promise.all(srcs.map(d=>fetchAway(d).then(r=>[d,r.d]).catch(()=>[d,null])))
    .then(pairs=>{const m={};pairs.forEach(([d,doc])=>{if(doc)m[d]=doc;});return m;});
}

export function clubXlsx(ref,D,L,away){
  D=D||S.d; L=L===undefined?S.l:L;
  const live=L?L.clubs.find(x=>x.n===ref.n):null;
  const hist=(D&&D.clubs)?D.clubs.find(x=>x.n===ref.n):null;
  const c=hist||ref;
  const Y=hist?(D.years||[]):[];
  const G12=(D&&D.goals)||(L&&L.rows)||[];
  const H=v=>({v,s:5}), B=v=>({v,s:1}), TTL=v=>({v,s:6});
  const rows=[];
  rows.push([TTL(c.m)]);
  rows.push([`Club ${Number(c.n)}`,`Division ${c.d||'\u2014'}`,`Area ${c.a||'\u2014'}`]);
  rows.push([]);

  if(live){
    const TG=L.targets||TARGETS, g10=L.goals||GOAL10, r12=L.rows||G12;
    /* Every goal the club has not met yet, with the shortfall spelled out per
       report row: a paired goal can be half done, and "4 more" against the
       wrong window is advice a club cannot act on. */
    const todo=[],shut=[];
    g10.forEach((g,j)=>{
      if(live.st[j]==='m') return;
      const short=(GOALROWS[j]||[]).map(r=>{
        const have=live.v[r]??0, need=TG[r];
        return have>=need?null:{r,have,need,gap:need-have};
      }).filter(Boolean);
      if(!short.length) return;
      const pair=(GOALROWS[j]||[]).length>1;
      const rec={g,
        what:short.map(s=>pair?`${r12[s.r]}: ${s.gap} more`:`${s.gap} more`).join(' \u00b7 '),
        have:short.map(s=>s.have).join(' / '),
        need:short.map(s=>s.need).join(' / '),
        by:fmtDate(short.map(s=>L.acts[s.r]).filter(Boolean).sort()[0])};
      (live.st[j]==='d'?shut:todo).push(rec);
    });

    rows.push([B(`What is left this year \u2014 ${L.py}`)]);
    rows.push([`${L.days} days to 30 June ${L.py.slice(-4)}. ${live.met} of 10 goals met so far. `+
      `Best still possible: ${live.best?live.best+' Distinguished':'no recognition'}. `+
      `Snapshot ${asofText()}.`]);
    rows.push([]);
    if(todo.length){
      rows.push([H('Goal'),H('Still needed'),H('To date'),H('Needs'),H('Act by')]);
      todo.forEach(r=>rows.push([r.g,r.what,r.have,r.need,r.by]));
    }else{
      rows.push(['Nothing is outstanding on a goal that is still open.']);
    }
    rows.push([]);
    if(shut.length){
      rows.push([B('No longer possible this year')]);
      rows.push([H('Goal'),H('Short by'),H('Window closed')]);
      shut.forEach(r=>rows.push([{v:r.g,s:3},{v:r.what,s:3},{v:r.by,s:3}]));
      rows.push([]);
    }
    rows.push([B('Membership')]);
    rows.push([`${live.md} members against a base of ${live.mb}, ${
      live.ng>0?'+':''}${live.ng} net. `+(live.memok
        ?'Meets the membership rule: 20 members, or five net new.'
        :'Short of the membership rule \u2014 20 members, or five net new \u2014 which gates every recognition level, whatever the goal count.')]);
    rows.push([]);

    rows.push([B(`Every goal, ${L.py}`)]);
    rows.push([H('Goal'),H('Needs'),H('To date'),H('Status'),H('Act by')]);
    // the twelve printed rows, mapped onto the ten goals they earn
    const OWNER=[0,1,2,3,4,5,6,7,8,8,9,9];
    (r12||[]).forEach((g,j)=>{
      const need=TG[j], v=live.v[j], st=live.st[OWNER[j]];
      const met=v!=null&&v>=need;
      const style=met?2:(st==='d'?4:3);
      rows.push([{v:g,s:style},{v:need,s:style},{v:v==null?'\u2014':v,s:style},
        {v:met?'met':(st==='d'?'window closed':'still reachable'),s:style},
        {v:met?'':fmtDate(L.acts[j]),s:style}]);
    });
    rows.push([]);
    rows.push(['Rows 9 and 10 together earn one goal, and so do rows 11 and 12.']);
    rows.push([`That is why "goals met" is ${live.met} of 10, not a count of ticks above.`]);
    rows.push([]);
  }

  rows.push([B('Year by year')]);
  const held=clubHistory(ref,D,away);
  if(!held.length){
    rows.push([(D&&D.years||[]).length
      ? `No finished years for this club. ${(D&&D.district)||'This district'} has an archive back to ${
          D.years[0]}, no year in it records this club, and no other district holds one either.`
      : `No finished years. ${(D&&D.district)||'This district'} was created for ${
          (L&&L.py)||'the year now running'}, and Toastmasters fills a district's archive only once a program year has closed.`]);
    rows.push([]);
  }else{
    rows.push([H('Year'),H('Goals met'),H('Status'),H('Members'),H('Base'),H('Net growth'),H('Recorded by')]);
    held.forEach(({y,rec:d,from})=>{
      const net=(d.md!=null&&d.mb!=null)?d.md-d.mb:null;
      const s=from?4:0;
      rows.push([{v:y,s},{v:d.f==null?'\u2014':d.f,s},{v:d.st||'\u2014',s},
                 {v:d.md==null?'\u2014':d.md,s},{v:d.mb==null?'\u2014':d.mb,s},
                 {v:net==null?'\u2014':net,s},
                 {v:from?districtName(from):(D&&D.district)||'this district',s}]);
    });
    rows.push([]);
    rows.push([B('Goal detail, year by year')]);
    rows.push([H('Goal'),H('Needs'),...held.map(h=>H(shortYr(h.y)))]);
    G12.forEach((g,j)=>{
      const need=TARGETS[j];
      rows.push([g,need,...held.map(({rec:d})=>{
        if(!d||!d.g)return '';
        const v=d.g[j];
        return {v:v==null?'\u2014':v,s:(v!=null&&v>=need)?2:3};
      })]);
    });
    rows.push([]);
    if(held.some(h=>h.from)){
      rows.push(['A shaded year was earned in another district. The club number survives a']);
      rows.push(['realignment and the district does not, so the record follows the club.']);
      rows.push([]);
    }
  }
  rows.push(['Source: dashboards.toastmasters.org \u00b7 '+(L?L.generated:'')]);

  const widths=[46,30,11,17,12,10,13,22];
  return buildXlsx([{name:'Club',rows,widths}]);
}

/* ---------- every finished year, as a workbook ----------
   The counterpart to the in-year workbook: that one is the open year across
   the district, this is the archive. A club that transferred in carries its
   own score in the year columns, as the table does, and the row names the
   years that came from elsewhere rather than letting them pass as this
   district's. The goal-detail sheet cannot follow it there \u2014 crosslink
   carries the club's score across a district line, not its twelve rows. */
export function historyXlsx(){
  const D=S.d, L=S.l, Y=tableYears(), CY=clubYears(), G12=D.goals;
  const yl=y=>y===LIVE?`${shortYr(L.py)} so far`:shortYr(y);
  const H=v=>({v,s:5}), B=v=>({v,s:1}), TTL=v=>({v,s:6});
  const list=districtClubs().sort((a,b)=>
    (a.d||'').localeCompare(b.d||'')||(a.a||'').localeCompare(b.a||'')||a.m.localeCompare(b.m));
  const sheets=[];

  const r1=[];
  r1.push([TTL(`${D.district} \u2014 every club, year by year`)]);
  r1.push([`${list.length} clubs`,`${CY.length} finished years`,
           L?`plus ${L.py} so far, snapshot ${asofText()}`:'',
           `generated ${D.generated||''}`]);
  r1.push([]);
  r1.push([H('Div'),H('Area'),H('Club No'),H('Club'),...Y.map(y=>H(yl(y))),
           H('Latest recognition'),H('Members'),H('Base'),H('Net growth'),
           H('On the roster now'),H('Years brought from another district')]);
  list.forEach(c=>{
    const latest=Y.slice().reverse().map(y=>clubYear(c,y).rec).find(Boolean)||{};
    const net=(latest.md!=null&&latest.mb!=null)?latest.md-latest.mb:null;
    const brought=CY.filter(y=>(c.ay||{})[y])
      .map(y=>`${shortYr(y)} ${districtName(c.ay[y][1])}`).join('; ');
    r1.push([c.d||'\u2014',c.a||'\u2014',Number(c.n),c.m,
      ...Y.map(y=>{
        const {rec,away}=clubYear(c,y);
        if(!rec||rec.f==null) return '\u2014';
        // the open year is a partial score, so it is not shaded as a result
        return {v:rec.f,s:y===LIVE?0:(away?4:(rec.f>=5?2:0))};
      }),
      latest.st||'\u2014',
      latest.md==null?'\u2014':latest.md, latest.mb==null?'\u2014':latest.mb,
      net==null?'\u2014':net,
      goneFromRoster(c.n)?'no':'yes', brought]);
  });
  r1.push([]);
  r1.push(['A shaded score was earned in another district. The club number survives a']);
  r1.push(['realignment and the district does not, so the score follows the club.']);
  if(L) r1.push([`The last column is ${L.py}, still running: goals met so far, not a year-end score.`]);
  sheets.push({name:'Year by year',rows:r1,
    widths:[6,7,10,38,...Y.map(()=>9),24,10,8,11,18,40]});

  const r2=[];
  r2.push([H('Div'),H('Area'),H('Club No'),H('Club'),H('Year'),H('Closed'),H('Goals met'),
           H('Recognition'),H('Members'),H('Base'),H('Net growth'),
           ...G12.map((g,j)=>H(`${g} (need ${TARGETS[j]})`))]);
  list.forEach(c=>Y.forEach(y=>{
    const {rec:d}=clubYear(c,y); if(!d) return;
    const net=(d.md!=null&&d.mb!=null)?d.md-d.mb:null;
    r2.push([d.d||c.d||'\u2014',d.a||c.a||'\u2014',Number(c.n),c.m,
      y===LIVE?L.py:y, y===LIVE?'no':'yes',
      d.f==null?'\u2014':d.f, d.st||'\u2014',
      d.md==null?'\u2014':d.md, d.mb==null?'\u2014':d.mb, net==null?'\u2014':net,
      ...G12.map((g,j)=>{
        const v=d.g?d.g[j]:null, need=TARGETS[j];
        return v==null?'\u2014':{v,s:v>=need?2:3};
      })]);
  }));
  sheets.push({name:'Goal detail',rows:r2,
    widths:[6,7,10,38,11,9,10,24,10,8,11,...G12.map(()=>13)]});

  return buildXlsx(sheets);
}

/* ---------- an area or a division, as a workbook ----------
   The district file is too wide for one conversation and a single club is too
   narrow for a director's patch. This is the middle: every club they are
   responsible for, and the windows about to shut on them. */
function scopeXlsx(kind,label,clubs){
  const L=S.l, Y=S.d.years, G12=S.d.goals, TG=(L&&L.targets)||TARGETS;
  const H=v=>({v,s:5}), B=v=>({v,s:1}), TTL=v=>({v,s:6});
  const live=c=>L?L.clubs.find(x=>x.n===c.n):null;
  const inScope=clubs.slice().sort((a,b)=>
    (a.a||'').localeCompare(b.a||'')||a.m.localeCompare(b.m));
  const lv=inScope.map(live).filter(Boolean);
  const sheets=[];

  /* --- clubs --- */
  const r1=[];
  r1.push([TTL(`${kind} ${label}`)]);
  r1.push([`${inScope.length} clubs`,
           L?`open year ${L.py}`:'',
           L?`dashboard snapshot ${asofText()}`:'',
           L?`${L.days} days to 30 June`:'']);
  // clubs realign between program years; a director wants the current list,
  // but should be told when it differs from the board they clicked from
  if(L){
    const yr=Y[Y.length-1];
    const moved=inScope.filter(c=>{
      const l=live(c); if(!l)return false;
      return kind==='Division' ? (c.d||'—')!==(l.d||'—')
                               : (c.d||'—')+(c.a||'—')!==(l.d||'—')+(l.a||'—');
    });
    r1.push([`Roster as it stands in ${L.py}.`]);
    if(moved.length) r1.push([`${moved.length} of these were listed elsewhere in ${yr}: `+
      moved.map(c=>`${c.m} (was ${c.d||'—'}/${c.a||'—'})`).join('; ')]);
  }
  if(lv.length){
    const avg=(lv.reduce((n,c)=>n+c.met,0)/lv.length).toFixed(2);
    r1.push([`Average goals met ${avg}`,
      `Distinguished now ${lv.filter(c=>c.met>=5).length}`,
      `Can still reach it ${lv.filter(c=>c.met<5&&c.ceil>=5).length}`,
      `No longer able to ${lv.filter(c=>c.ceil<5).length}`]);
  }
  r1.push([]);
  r1.push([H('Area'),H('Club No'),H('Club'),H('Goals met'),H('Of'),H('Ceiling'),
    H('Best still possible'),H('Members'),H('Base'),H('Net growth'),
    H('Meets membership rule'),H('Next deadline'),H('What closes then'),
    ...G12.map((g,j)=>H(`${g} (need ${TG[j]})`))]);
  inScope.forEach(c=>{
    const l=live(c);
    if(!l){ r1.push([c.a,Number(c.n),c.m,'no current data']); return; }
    const OWNER=[0,1,2,3,4,5,6,7,8,8,9,9];
    r1.push([l.a||c.a,Number(c.n),c.m,{v:l.met,s:1},10,
      {v:l.ceil,s:l.ceil<5?3:0},l.best||'none',l.md,l.mb,l.ng,
      {v:l.memok?'yes':'no',s:l.memok?0:3},
      l.nd?fmtDate(l.nd):'',l.ndl||'',
      ...G12.map((g,j)=>{
        const v=l.v[j],need=TG[j],met=v!=null&&v>=need;
        const st=l.st[OWNER[j]];
        return {v:v==null?'—':v,s:met?2:(st==='d'?4:3)};
      })]);
  });
  sheets.push({name:'Clubs',rows:r1,
    widths:[7,10,36,10,6,9,17,10,8,11,20,14,26,...G12.map(()=>13)]});

  /* --- the windows about to shut, and who is short --- */
  if(L&&L.agg.close&&L.agg.close.length){
    const ROWIDX={'Officers trained Jun-Aug':8,'Officers trained Nov-Feb':9,
                  'Renewal dues on time':10,'Officer list on time':11};
    const r2=[];
    r2.push([TTL('What shuts next')]);
    r2.push(['A goal here cannot be recovered once its window closes.']);
    r2.push([]);
    L.agg.close.forEach(w=>{
      const j=ROWIDX[w.lbl]; if(j==null)return;
      const short=lv.filter(c=>c.v[j]!=null&&c.v[j]<TG[j]);
      r2.push([B(w.lbl),
        w.open?`closes ${fmtDate(w.date)} — ${w.days} days`
              :`opens ${fmtDate(w.opens)}, closes ${fmtDate(w.date)}`,
        `${short.length} of ${lv.length} clubs short`]);
      if(!w.open){ r2.push(['','This window has not opened yet.']); r2.push([]); return; }
      if(!short.length){ r2.push(['','Every club here has met it.']); r2.push([]); return; }
      r2.push([H('Area'),H('Club'),H('Has'),H('Needs'),H('Short by')]);
      short.sort((a,b)=>(a.a||'').localeCompare(b.a||'')||a.m.localeCompare(b.m))
        .forEach(c=>r2.push([c.a,c.m,{v:c.v[j],s:3},TG[j],{v:TG[j]-c.v[j],s:3}]));
      r2.push([]);
    });
    sheets.push({name:'What shuts next',rows:r2,widths:[8,38,10,10,11]});
  }

  /* --- the closed years behind them --- */
  const r3=[];
  r3.push([TTL('Year-end goals met')]);
  r3.push([]);
  r3.push([H('Area'),H('Club'),...Y.map(y=>H(shortYr(y))),H(`Status ${shortYr(Y[Y.length-1])}`)]);
  inScope.forEach(c=>{
    const l=live(c);
    r3.push([(l&&l.a)||c.a,c.m,...Y.map(y=>{
      const f=(c.y[y]||{}).f;
      return f==null?'—':{v:f,s:f>=5?2:3};
    }),(c.y[Y[Y.length-1]]||{}).st||'—']);
  });
  sheets.push({name:'Five years',rows:r3,widths:[8,38,...Y.map(()=>9),26]});

  return buildXlsx(sheets);
}

/* Every file a reader saves is named for the district it came from, so two
   districts' workbooks do not collide in one downloads folder. */
export const dprefix=()=>`District${S.did}`;

export function scopeDownload(kind,label,clubs){
  saveBlob(scopeXlsx(kind,label,clubs),
    `${dprefix()}_${kind}_${String(label).replace(/[^A-Za-z0-9]+/g,'')}_DCP.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
