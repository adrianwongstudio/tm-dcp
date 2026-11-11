import {$, S, T} from './core.js?v=a41e91580d';

/* ---------- contact ---------- */
/* This is a static site with no server of its own, so there are two ways to
   deliver a message. If site.contact_endpoint is set in config.json - a form
   service or a small Worker - the form POSTs there and the sender never leaves
   the page. While it is blank the form hands the message to the sender's own
   mail client instead, which needs no account and no key.

   The spam check is an arithmetic question plus a hidden field no person can
   see. That stops naive bots; it is not a verified captcha, which needs a
   server to check the token. */
const CONTACT={a:0,b:0};

function contactCfg(){
  const s=(S.d&&S.d.site)||{};
  // decoded only at the moment of use, so the address is never sitting in the
  // page as text for a harvester to scrape
  let to='';
  try{ if(s.contact_email_enc) to=[...atob(s.contact_email_enc)].reverse().join(''); }catch(e){}
  return {to, tag:s.contact_tag||'', endpoint:s.contact_endpoint||''};
}
function newSum(){
  CONTACT.a=2+Math.floor(Math.random()*8);
  CONTACT.b=2+Math.floor(Math.random()*8);
  const l=$('cfSumLabel');
  if(l) l.textContent=T('Spam check — what is {a} + {b}?',{a:CONTACT.a,b:CONTACT.b});
  const f=$('cfSum'); if(f){f.value='';f.removeAttribute('aria-invalid');}
}
function setMsg(text,kind){
  const m=$('cfMsg'); if(!m) return;
  m.textContent=text||'';
  if(kind) m.setAttribute('data-t',kind); else m.removeAttribute('data-t');
}
let contactReturnFocus=null;
let contactInerted=[];

function openContact(){
  contactReturnFocus=document.activeElement;
  /* aria-modal alone does not stop Tab leaving the dialog. Everything else is
     made inert, and only what this call changed is restored: the club drawer
     is inert while closed and must stay so. */
  contactInerted=[...document.body.children].filter(e=>
    e.tagName!=='SCRIPT'&&!e.inert&&e.id!=='contactModal'&&e.id!=='contactVeil');
  contactInerted.forEach(e=>{e.inert=true;});
  newSum(); setMsg('');
  $('contactVeil').hidden=false; $('contactModal').hidden=false;
  $('cfName').focus();
}
function closeContact(){
  contactInerted.forEach(e=>{e.inert=false;}); contactInerted=[];
  $('contactVeil').hidden=true; $('contactModal').hidden=true;
  if(contactReturnFocus&&contactReturnFocus.focus) contactReturnFocus.focus();
}

function validateContact(){
  // the whole sentence, not "Please add" plus a noun: the article and the
  // word order are the translator's business, not this function's
  const need=[['cfName','Please add a name.'],['cfEmail','Please add an email address.'],
              ['cfSubject','Please add a subject.'],['cfBody','Please add a message.']];
  for(const [id,msg] of need){
    const el=$(id);
    if(!el.value.trim()){el.setAttribute('aria-invalid','true');el.focus();
      return T(msg);}
    el.removeAttribute('aria-invalid');
  }
  const em=$('cfEmail');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value.trim())){
    em.setAttribute('aria-invalid','true');em.focus();
    return T('That email address does not look right.');
  }
  if($('cfHoney').value) return T('Sorry — that looked automated.');
  const sum=$('cfSum');
  if(parseInt(sum.value,10)!==CONTACT.a+CONTACT.b){
    sum.setAttribute('aria-invalid','true');sum.focus();
    newSum();
    return T('That sum was not right — here is another.');
  }
  return null;
}

async function submitContact(e){
  e.preventDefault();
  const err=validateContact();
  if(err) return setMsg(err,'err');

  const cfg=contactCfg();
  const subject=(cfg.tag?cfg.tag+' — ':'')+$('cfSubject').value.trim();
  // no recipient in the payload — the endpoint decides where mail goes, or it
  // is an open relay for anyone who finds the URL
  const payload={name:$('cfName').value.trim(), email:$('cfEmail').value.trim(),
                 subject, message:$('cfBody').value.trim()};

  if(cfg.endpoint){
    setMsg(T('Sending…'));
    $('cfSend').disabled=true;
    try{
      const r=await fetch(cfg.endpoint,{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!r.ok) throw new Error('the server replied '+r.status);
      $('contactForm').reset(); newSum();
      setMsg(T('Sent. Thank you — you will get a reply by email.'),'ok');
    }catch(ex){
      setMsg(T('Could not send ({error}). Please try again in a moment.',{error:ex.message}),'err');
    }finally{ $('cfSend').disabled=false; }
    return;
  }

  // no endpoint configured: hand off to the sender's mail client
  const body=`${payload.message}\n\n— ${payload.name} (${payload.email})`;
  window.location.href=`mailto:${encodeURIComponent(cfg.to)}`+
    `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  setMsg(T('Opening your mail app with the message ready to send.'),'ok');
}

export function wireContact(){
  const btn=$('contactbtn'); if(!btn) return;
  btn.onclick=openContact;
  $('contactClose').onclick=closeContact;
  $('contactVeil').onclick=closeContact;
  $('contactForm').onsubmit=submitContact;
  addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!$('contactModal').hidden) closeContact();
  });
}
