/* EC Wegscheid – Montags Solo (Interne Cups).
   3 Vorrunden-Montage mit je höchstens 9 Spielern, die besten 3 jeder Vorrunde
   spielen am 4. Montag das Finale. StockTV-Dateien (.skmr) erstellen und die
   Ergebnis-Datei wieder einlesen, Nachrücker nominieren, Kassenliste drucken.
   Daten: Firestore turnierauswertung/montagsSolo (öffentlich lesbar für die
   Smartphone-Anbindung, Schreiben nur mit Administrator-Anmeldung). */
(function(){
'use strict';
const DOC_PATH=['turnierauswertung','montagsSolo'];
const MAX_PLAYERS=9, FINAL_PER_ROUND=3, ROUND_KEYS=['v1','v2','v3'];
const ROUND_LABEL={v1:'Vorrunde 1',v2:'Vorrunde 2',v3:'Vorrunde 3',finale:'Finale'};
let state=null, busy=false, lastError='';

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const key=s=>clean(s).toLocaleLowerCase('de-DE').split(' ').sort().join(' ');
const sameName=(a,b)=>key(a)===key(b)&&!!key(a);
const deDate=iso=>{const p=String(iso||'').split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0]:''};
const euro=n=>(Number(n)||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
const db=()=>typeof firestoreDb!=='undefined'?firestoreDb:null;
const isAdmin=()=>typeof appPermissions!=='undefined'&&appPermissions.admin===true;
const toast=(m,t)=>{if(typeof showToast==='function')showToast(m,t||4000);};

function nextMondays(count){
  const d=new Date();d.setHours(12,0,0,0);
  d.setDate(d.getDate()+((8-d.getDay())%7||7));
  return Array.from({length:count},(_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i*7);return x.toISOString().slice(0,10);});
}
function emptyState(){
  const dates=nextMondays(4);
  const round=(k,i)=>({key:k,date:dates[i],players:[],result:null,reserves:[]});
  return {title:'Montags Solo',fee:10,time:'19:00',location:'Vereinsheim',
    rounds:{v1:round('v1',0),v2:round('v2',1),v3:round('v3',2)},
    finale:{key:'finale',date:dates[3],slots:[],players:[],result:null},
    plannerIds:{},archive:[],updatedAt:''};
}
function normalize(s){
  const d=emptyState(),x=s&&typeof s==='object'?s:{};
  const out={...d,...x};
  out.rounds={};
  for(const k of ROUND_KEYS){const r={...d.rounds[k],...(x.rounds?.[k]||{})};r.players=(r.players||[]).filter(p=>p&&clean(p.name)).map(p=>({name:clean(p.name),paid:!!p.paid}));r.reserves=(r.reserves||[]).map(clean).filter(Boolean);out.rounds[k]=r;}
  const f={...d.finale,...(x.finale||{})};
  f.slots=(f.slots||[]).map(s=>({name:clean(s.name),from:s.from,slot:Number(s.slot)||0,rank:Number(s.rank)||0,status:s.status==='abgesagt'?'abgesagt':'ok',substitute:!!s.substitute,paid:!!s.paid}));
  f.players=f.players||[];
  out.finale=f;out.plannerIds=x.plannerIds||{};out.archive=Array.isArray(x.archive)?x.archive:[];
  out.fee=Number(x.fee??10);
  return out;
}

/* ---------- SKMR: Ergebnis lesen (gleiche Wertung wie im Turnierarchiv) ---------- */
function parseSkmr(text){
  const xml=new DOMParser().parseFromString(text,'application/xml');
  if(xml.querySelector('parsererror')||xml.documentElement.tagName!=='Turnier')throw Error('Das ist keine gültige StockTV-Datei (.skmr).');
  const val=(e,k)=>e?.getElementsByTagName(k)?.[0]?.textContent?.trim()||'';
  const ts=[...xml.getElementsByTagName('Mannschaft')].map(e=>({id:val(e,'StartNumber'),name:val(e,'TeamName'),points:0,minus:0,for:0,against:0,games:0}));
  const map=new Map(ts.map(t=>[t.id,t]));
  let played=0,total=0;
  for(const g of xml.getElementsByTagName('Spiel')){
    const ia=val(g,'StartnummerA'),ib=val(g,'StartnummerB');if(ia===ib)continue;
    const a=map.get(ia),b=map.get(ib);if(!a||!b)continue;total++;
    const sc=g.getElementsByTagName('Spielstand')[0];const x=Number(val(sc,'A')),y=Number(val(sc,'B'));
    if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    if(x===0&&y===0)continue; // noch nicht gespielt
    played++;a.games++;b.games++;a.for+=x;a.against+=y;b.for+=y;b.against+=x;
    if(x>y){a.points+=2;b.minus+=2;}else if(y>x){b.points+=2;a.minus+=2;}else{a.points++;a.minus++;b.points++;b.minus++;}
  }
  ts.sort((a,b)=>b.points-a.points||((b.for-b.against)-(a.for-a.against))||b.for-a.for||a.name.localeCompare(b.name,'de'));
  return {title:val(xml,'TournamentName'),played,total,
    rows:ts.map((t,i)=>({rank:i+1,name:t.name,points:t.points,minus:t.minus,for:t.for,against:t.against,diff:t.for-t.against}))};
}

/* ---------- SKMR: Datei für StockTV erstellen (wie Turnierverwaltung) ---------- */
function xText(parent,tag,value){const n=parent?.querySelector(tag);if(n)n.textContent=String(value??'');}
function buildSchedule(b,teams){
  const n=teams.length;
  const parent=b.querySelector('Mannschaften'),sample=parent.querySelector('Mannschaft').cloneNode(true);
  parent.replaceChildren();
  teams.forEach((name,i)=>{const node=sample.cloneNode(true);xText(node,'StartNumber',i+1);xText(node,'TeamName',name);parent.appendChild(node);});
  if(n===9)return;
  const matches=b.querySelector('Spiele'),ms=matches.querySelector('Spiel').cloneNode(true);
  matches.replaceChildren();
  const count=n%2===0?n:n+1,slots=Array.from({length:count},(_,i)=>i<n?i+1:0);
  for(let round=1;round<=count-1;round++){
    let court=0;
    for(let i=0;i<count/2;i++){
      const a=slots[i],c=slots[count-1-i],bye=(!a||!c),g=ms.cloneNode(true);
      if(!bye)court++;
      const an=bye?(a||c):a,bn=bye?an:c;
      for(const [t,v] of Object.entries({RoundOfGame:1,CourtNumber:bye?0:court,GameNumber:round,GameNumberOverAll:round,StartnummerA:an,StartnummerB:bn,IsTeamA_Starting:(round+i)%2===0?'true':'false'}))xText(g,t,v);
      xText(g,'Spielstand > A',0);xText(g,'Spielstand > B',0);
      const k=g.querySelector('Spielstand > Kehren');if(k)k.replaceChildren();
      matches.appendChild(g);
    }
    slots.splice(1,0,slots.pop());
  }
  xText(b,'Spielplan','0');xText(b,'AnzahlAussetzer',n%2);xText(b,'SpielRunden','1');
}
async function createSkmr(name,date,players){
  if(players.length<2||players.length>15)throw Error('Für die StockTV-Datei werden 2 bis 15 Spieler benötigt.');
  const response=await fetch('assets/stockapp-vorlage-9-teams.skmr?v=2.5.2c',{cache:'no-store'});
  if(!response.ok)throw Error('StockTV-Vorlage fehlt.');
  const xml=new DOMParser().parseFromString(await response.text(),'application/xml');
  const org=xml.querySelector('Organisation'),b=xml.querySelector('Teambewerb');
  if(!org||!b)throw Error('StockTV-Vorlage ist ungültig.');
  for(const [t,v] of Object.entries({Venue:state.location||'',Organizer:'EC Wegscheid',Operator:'EC Wegscheid',TournamentName:name,DateOfTournament:date?date+'T00:00:00':''}))xText(org,t,v);
  xText(org,'Starttgebuehr > Value',state.fee?String(state.fee):'');
  buildSchedule(b,players);
  const written=[...b.querySelectorAll('Mannschaften > Mannschaft')].map(n=>n.querySelector('TeamName')?.textContent||'');
  if(written.join('|')!==players.join('|'))throw Error('Kontrolle fehlgeschlagen: Spielernamen wurden nicht vollständig übernommen.');
  const text=new XMLSerializer().serializeToString(xml);
  const blob=new Blob(['<?xml version="1.0" encoding="utf-8"?>\n'+text.replace(/^<\?xml[^>]*>\s*/,'')],{type:'application/xml;charset=utf-8'});
  const file='ECW_StockTV_'+name.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g,'_').slice(0,60)+'_'+players.length+'_Spieler.skmr';
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  return file+(players.length===9?'':' (Spielplan für '+players.length+' Spieler bitte in StockTV prüfen)');
}

/* ---------- Finale zusammenstellen ---------- */
function qualifiersOf(k){const r=state.rounds[k];return r.result?r.result.rows.slice(0,FINAL_PER_ROUND):[];}
// Ergänzt fehlende Finalplätze aus den Vorrunden-Ergebnissen, vorhandene Einträge bleiben erhalten.
function syncFinaleSlots(){
  const f=state.finale,slots=[];
  for(const k of ROUND_KEYS){
    const q=qualifiersOf(k);
    for(let i=0;i<FINAL_PER_ROUND;i++){
      const old=f.slots.find(s=>s.from===k&&s.slot===i);
      if(old&&old.name&&(old.substitute||old.status==='abgesagt')){slots.push(old);continue;}
      const same=old&&q[i]&&sameName(old.name,q[i].name);
      slots.push(q[i]?{name:q[i].name,from:k,slot:i,rank:i+1,status:same?old.status:'ok',substitute:false,paid:same?!!old.paid:false}
        :{name:'',from:k,slot:i,rank:i+1,status:'ok',substitute:false,paid:false});
    }
  }
  f.slots=slots;
}
function finaleNames(){return state.finale.slots.filter(s=>s.status==='ok'&&s.name).map(s=>s.name);}
function finaleComplete(){return state.finale.slots.length===ROUND_KEYS.length*FINAL_PER_ROUND&&finaleNames().length===state.finale.slots.length;}
function availableReserves(k){
  const r=state.rounds[k];if(!r.result)return [];
  const inFinale=new Set(state.finale.slots.filter(s=>s.name).map(s=>key(s.name)));
  const listed=r.reserves.length?r.reserves:r.result.rows.slice(FINAL_PER_ROUND,FINAL_PER_ROUND+2).map(x=>x.name);
  return listed.filter(n=>!inFinale.has(key(n)));
}

/* ---------- Laden / Speichern ---------- */
async function load(){
  if(!db())throw Error('Firebase ist nicht verbunden.');
  const snap=await db().collection(DOC_PATH[0]).doc(DOC_PATH[1]).get();
  state=normalize(snap.exists?snap.data():null);
}
async function save(msg){
  if(!isAdmin()){toast('Nur Administratoren dürfen speichern.');return false;}
  if(busy)return false;busy=true;
  try{
    state.updatedAt=new Date().toISOString();
    await db().collection(DOC_PATH[0]).doc(DOC_PATH[1]).set(JSON.parse(JSON.stringify(state)));
    if(msg)toast(msg);lastError='';return true;
  }catch(e){lastError='Speichern fehlgeschlagen: '+(e.code||e.message);toast(lastError,7000);return false;}
  finally{busy=false;render();}
}

/* ---------- Terminplaner ---------- */
async function syncPlanner(){
  if(typeof data==='undefined'||!db())return toast('Terminplaner nicht verfügbar.');
  data.tournamentPlanner=data.tournamentPlanner||[];
  const entries=[...ROUND_KEYS.map(k=>[k,state.rounds[k].date]),['finale',state.finale.date]];
  let n=0;
  for(const [k,date] of entries){
    if(!date)continue;
    const name=state.title+' · '+ROUND_LABEL[k];
    let id=state.plannerIds[k],item=id?data.tournamentPlanner.find(x=>x&&x.id===id):null;
    if(item){
      // Vorhandener (verknüpfter) Termin: nur das Datum angleichen, Name und Angaben bleiben.
      if(item.date===date)continue;
      Object.assign(item,{date,updatedAt:new Date().toISOString()});
    }else{
      id='tp_ms_'+k+'_'+Date.now();item={id,players:['','','',''],reportedBy:'',contestClass:'',addToTurnierWirtschaftlichkeit:false};data.tournamentPlanner.push(item);state.plannerIds[k]=id;
      Object.assign(item,{name,date,time:state.time||'',location:state.location||'',type:'Turnier intern',internal:true,updatedAt:new Date().toISOString()});
    }
    await db().collection('tournamentPlanner').doc(id).set(JSON.parse(JSON.stringify(item)));n++;
  }
  try{window.save?.()}catch(e){}
  await save(n?n+' Termine im Terminplaner eingetragen bzw. aktualisiert.':'Alle Termine stehen bereits im Terminplaner.');
  try{if(typeof renderTournamentPlannerAdminList==='function')renderTournamentPlannerAdminList();}catch(e){}
}

function plannerEvents(){
  const list=(typeof data!=='undefined'&&Array.isArray(data.tournamentPlanner))?data.tournamentPlanner:[];
  return list.filter(x=>x&&x.date&&!x.cancelled&&!x.abgesagt).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
const allKeys=()=>[...ROUND_KEYS,'finale'];
const dateOf=k=>k==='finale'?state.finale.date:state.rounds[k].date;
function setDate(k,v){if(k==='finale')state.finale.date=v;else state.rounds[k].date=v;}
// Verknüpfte Termine: Datumsänderungen im Terminplaner automatisch übernehmen.
function adoptPlannerDates(){
  let changed=false;
  for(const k of allKeys()){
    const id=state.plannerIds[k];if(!id)continue;
    const ev=plannerEvents().find(x=>x.id===id);
    if(ev&&ev.date&&ev.date!==dateOf(k)){setDate(k,ev.date);changed=true;}
  }
  return changed;
}
// Vorhandene Termine mit „Solo“ im Namen der Reihe nach zuordnen (3 Vorrunden + Finale).
async function importFromPlanner(){
  const today=new Date().toISOString().slice(0,10);
  const found=plannerEvents().filter(x=>/solo/i.test(x.name||'')&&!/pyramide/i.test(x.name||'')&&x.date>=today);
  if(!found.length)return toast('Im Terminplaner wurden keine kommenden Termine mit „Solo“ im Namen gefunden. Termine einzeln über die Auswahl „aus Terminplaner“ zuordnen.',8000);
  const fin=found.find(x=>/finale/i.test(x.name||''));
  const rest=found.filter(x=>x!==fin);
  const pick=[...ROUND_KEYS.map((k,i)=>[k,rest[i]]),['finale',fin||rest[3]]].filter(([,x])=>x);
  if(!confirm('Folgende Termine übernehmen?\n'+pick.map(([k,x])=>ROUND_LABEL[k]+': '+deDate(x.date)+' · '+x.name).join('\n')))return;
  for(const [k,x] of pick){setDate(k,x.date);state.plannerIds[k]=x.id;}
  await save(pick.length+' Termine aus dem Terminplaner übernommen.');
}
async function linkPlanner(k,id){
  const ev=plannerEvents().find(x=>x.id===id);if(!ev)return;
  setDate(k,ev.date);state.plannerIds[k]=ev.id;
  await save(ROUND_LABEL[k]+': Termin '+deDate(ev.date)+' übernommen.');
}
function plannerSelect(k){
  const today=new Date().toISOString().slice(0,10),linked=state.plannerIds[k];
  const evs=plannerEvents().filter(x=>x.date>=today||x.id===linked);
  return '<select data-ms-link="'+k+'" title="Termin aus dem Terminplaner übernehmen"><option value="">aus Terminplaner …</option>'
    +evs.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===linked?' selected':'')+'>'+deDate(x.date)+' · '+esc(x.name||'')+'</option>').join('')+'</select>';
}

/* ---------- Kassenliste ---------- */
function printCashList(k){
  if(k==='finale')return;
  const date=state.rounds[k].date,names=state.rounds[k].players.map(p=>p.name);
  const rows=Array.from({length:Math.max(names.length,MAX_PLAYERS)},(_,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(names[i]||'')+'</td><td class="r">'+euro(state.fee)+'</td><td class="c">☐</td><td></td></tr>').join('');
  const html='<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Kassenliste</title><style>body{font:14px Arial,sans-serif;margin:18mm}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:8px 6px;height:22px}th{background:#eee;text-align:left}.r{text-align:right;width:80px}.c{text-align:center;width:70px;font-size:18px}td:first-child{width:30px;text-align:center}tfoot td{font-weight:bold}</style></head><body>'
    +'<h1>'+esc(state.title)+' · '+ROUND_LABEL[k]+'</h1><p>Montag, '+deDate(date)+(state.time?' · '+esc(state.time)+' Uhr':'')+' · Startgeld '+euro(state.fee)+' pro Spieler</p>'
    +'<table><thead><tr><th>Nr.</th><th>Name</th><th class="r">Startgeld</th><th class="c">bezahlt</th><th>Unterschrift / Bemerkung</th></tr></thead><tbody>'+rows+'</tbody>'
    +'<tfoot><tr><td></td><td>Summe ('+names.length+' Spieler)</td><td class="r">'+euro(state.fee*names.length)+'</td><td></td><td>Kassiert: ____________ €</td></tr></tfoot></table>'
    +'<script>window.onload=()=>{window.print()}<\/script></body></html>';
  const w=window.open('','_blank');
  if(!w){toast('Bitte Pop-ups für die Vereinsverwaltung erlauben, um die Kassenliste zu drucken.',6000);return;}
  w.document.open();w.document.write(html);w.document.close();
}

/* ---------- Anzeige ---------- */
function playerOptions(){
  let list=[];try{list=typeof tpPlayers==='function'?tpPlayers(false):[];}catch(e){}
  return list.filter(n=>n&&n!=='X');
}
function resultTable(res,k){
  if(!res)return '';
  const reserves=k&&k!=='finale'?new Set((state.rounds[k].reserves.length?state.rounds[k].reserves:res.rows.slice(FINAL_PER_ROUND,FINAL_PER_ROUND+2).map(x=>x.name)).map(key)):new Set();
  return '<table class="ms-table"><thead><tr><th>Platz</th><th>Spieler</th><th>Punkte</th><th>Stockpunkte</th><th>Diff.</th>'+(k!=='finale'?'<th></th>':'')+'</tr></thead><tbody>'
    +res.rows.map(r=>{
      const q=k!=='finale'&&r.rank<=FINAL_PER_ROUND,isRes=reserves.has(key(r.name));
      return '<tr class="'+(q?'ms-q':'')+'"><td>'+r.rank+'.</td><td>'+esc(r.name)+'</td><td>'+r.points+':'+r.minus+'</td><td>'+r.for+':'+r.against+'</td><td>'+(r.diff>0?'+':'')+r.diff+'</td>'
        +(k!=='finale'?'<td>'+(q?'<span class="ms-badge">Finale</span>':'<label class="ms-res"><input type="checkbox" data-ms-reserve="'+k+'" data-name="'+esc(r.name)+'"'+(isRes?' checked':'')+'> Nachrücker</label>')+'</td>':'')+'</tr>';
    }).join('')+'</tbody></table>'
    +'<div class="small">'+esc(res.filename||'')+(res.played<res.total?' · Achtung: erst '+res.played+' von '+res.total+' Spielen eingetragen':'')+'</div>';
}
function roundCard(k){
  const r=state.rounds[k],paid=r.players.filter(p=>p.paid).length;
  const opts=playerOptions().filter(n=>!r.players.some(p=>sameName(p.name,n)));
  const other=n=>ROUND_KEYS.filter(x=>x!==k&&state.rounds[x].players.some(p=>sameName(p.name,n))).map(x=>ROUND_LABEL[x]);
  return '<div class="card ms-card"><div class="ms-head"><h3>'+ROUND_LABEL[k]+'</h3><div class="ms-dates"><label>Montag <input type="date" data-ms-date="'+k+'" value="'+esc(r.date)+'"></label>'+plannerSelect(k)+'</div></div>'
    +'<div class="ms-players">'+(r.players.length?r.players.map((p,i)=>'<div class="ms-player"><span class="ms-n">'+(i+1)+'.</span><span class="ms-name">'+esc(p.name)+(other(p.name).length?' <span class="small">(auch '+other(p.name).join(', ')+')</span>':'')+'</span><label class="ms-paid"><input type="checkbox" data-ms-paid="'+k+'" data-i="'+i+'"'+(p.paid?' checked':'')+'> bezahlt</label>'+(r.result?'':'<button type="button" class="ms-x" data-ms-remove="'+k+'" data-i="'+i+'" title="Entfernen">✕</button>')+'</div>').join(''):'<div class="small">Noch keine Spieler eingetragen.</div>')+'</div>'
    +(r.players.length<MAX_PLAYERS&&!r.result?'<div class="row ms-add"><select data-ms-pick="'+k+'"><option value="">Spieler aus der Spielerliste …</option>'+opts.map(n=>'<option>'+esc(n)+'</option>').join('')+'</select><input type="text" data-ms-free="'+k+'" placeholder="oder Name eingeben"><button type="button" data-ms-add="'+k+'">Hinzufügen</button></div>':'')
    +'<div class="small">'+r.players.length+' von '+MAX_PLAYERS+' Spielern · bezahlt '+paid+' · kassiert '+euro(paid*state.fee)+'</div>'
    +'<div class="row ms-actions"><button type="button" data-ms-skmr="'+k+'"'+(r.players.length<2?' disabled':'')+'>StockTV-Datei (.skmr) erstellen</button><button type="button" data-ms-cash="'+k+'">Kassenliste drucken</button><label class="ms-file">Ergebnis-Datei (.skmr) einlesen<input type="file" accept=".skmr,.xml" data-ms-result="'+k+'"></label>'+(r.result?'<button type="button" data-ms-clear="'+k+'">Ergebnis entfernen</button>':'')+'</div>'
    +resultTable(r.result,k)+'</div>';
}
function finaleCard(){
  syncFinaleSlots();
  const f=state.finale,complete=finaleComplete();
  const slotRow=s=>{
    const label=ROUND_LABEL[s.from]+' · '+(s.substitute?'Nachrücker':s.rank+'. Platz');
    if(!s.name)return '<div class="ms-player ms-open"><span class="ms-name small">'+label+': noch offen</span></div>';
    const res=availableReserves(s.from);
    return '<div class="ms-player'+(s.status==='abgesagt'?' ms-off':'')+'"><span class="ms-name">'+esc(s.name)+' <span class="small">'+label+'</span></span>'
      +(s.status==='ok'?'<button type="button" data-ms-cancel="'+s.from+'" data-slot="'+s.slot+'">Kann nicht</button>'
        :'<span class="small">abgesagt</span>'+(res.length?'<select data-ms-sub="'+s.from+'" data-slot="'+s.slot+'"><option value="">Nachrücker wählen …</option>'+res.map(n=>'<option>'+esc(n)+'</option>').join('')+'</select>':'<span class="small"> – kein Nachrücker vorgemerkt</span>')+'<button type="button" data-ms-undo="'+s.from+'" data-slot="'+s.slot+'">Rückgängig</button>')
      +'</div>';
  };
  return '<div class="card ms-card"><div class="ms-head"><h3>Finale</h3><div class="ms-dates"><label>Montag <input type="date" data-ms-date="finale" value="'+esc(f.date)+'"></label>'+plannerSelect('finale')+'</div></div>'
    +'<div class="small">Die besten '+FINAL_PER_ROUND+' jeder Vorrunde werden automatisch eingetragen. Kann ein Spieler nicht, „Kann nicht“ drücken und einen vorgemerkten Nachrücker derselben Vorrunde wählen.</div>'
    +'<div class="ms-players">'+f.slots.map(slotRow).join('')+'</div>'
    +'<div class="small">'+finaleNames().length+' von '+f.slots.length+' Finalplätzen besetzt · im Finale ist kein Startgeld zu bezahlen</div>'
    +'<div class="row ms-actions"><button type="button" data-ms-skmr="finale"'+(complete?'':' disabled title="Erst möglich, wenn alle Finalplätze besetzt sind"')+'>StockTV-Datei (.skmr) erstellen</button><label class="ms-file">Ergebnis-Datei (.skmr) einlesen<input type="file" accept=".skmr,.xml" data-ms-result="finale"></label>'+(f.result?'<button type="button" data-ms-clear="finale">Ergebnis entfernen</button>':'')+'</div>'
    +(complete?'':'<div class="small">StockTV-Datei für das Finale erst, wenn das Finale komplett ist.</div>')
    +resultTable(f.result,'finale')+'</div>';
}
function css(){
  if(document.getElementById('msCss'))return;
  const s=document.createElement('style');s.id='msCss';
  s.textContent='.ms-card{margin-bottom:12px}.ms-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.ms-head h3{margin:0}.ms-head input,.ms-head select{width:auto!important;margin:0!important}.ms-dates{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ms-dates select{max-width:260px}'
   +'.ms-players{display:grid;gap:4px;margin:10px 0}.ms-player{display:flex;align-items:center;gap:10px;padding:6px 10px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(0,0,0,.18)}'
   +'.ms-player .ms-name{flex:1}.ms-n{width:24px;opacity:.7}.ms-paid,.ms-res{display:flex;align-items:center;gap:6px;white-space:nowrap;margin:0!important}.ms-paid input,.ms-res input{width:auto!important;margin:0!important}'
   +'.ms-off .ms-name{text-decoration:line-through;opacity:.6}.ms-open{opacity:.7;border-style:dashed}.ms-x{padding:4px 9px!important;min-height:0!important}'
   +'.ms-add select,.ms-add input{flex:1;margin:0!important}.ms-actions{flex-wrap:wrap;gap:8px;margin-top:8px}.ms-file{display:inline-flex!important;align-items:center;gap:6px;padding:8px 12px;border:1px solid rgba(255,255,255,.3);border-radius:8px;cursor:pointer;margin:0!important}.ms-file input{display:none}'
   +'.ms-table{width:100%;border-collapse:collapse;margin-top:10px}.ms-table th,.ms-table td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.14);text-align:left}.ms-q td{background:rgba(46,160,90,.18)}'
   +'.ms-badge{background:#2e9e5a;color:#fff;border-radius:6px;padding:2px 8px;font-size:.8rem;font-weight:700}.ms-top input{margin:0!important}';
  document.head.appendChild(s);
}
function render(){
  const a=document.getElementById('adminMain');if(!a||!a.querySelector('#msRoot'))return;
  const root=a.querySelector('#msRoot');
  if(!state){root.innerHTML='<div class="card">'+(lastError?esc(lastError):'Wird geladen …')+'</div>';return;}
  root.innerHTML='<div class="card"><div class="row ms-top" style="flex-wrap:wrap;gap:10px;align-items:end">'
    +'<label style="flex:2">Name<input type="text" data-ms-set="title" value="'+esc(state.title)+'"></label>'
    +'<label>Beginn<input type="time" data-ms-set="time" value="'+esc(state.time)+'"></label>'
    +'<label style="flex:1">Ort<input type="text" data-ms-set="location" value="'+esc(state.location)+'"></label>'
    +'<label>Startgeld €<input type="number" min="0" step="0.5" data-ms-set="fee" value="'+esc(state.fee)+'" style="width:90px"></label></div>'
    +'<div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px"><button type="button" class="primary" data-ms-planner>4 Montage in den Terminplaner eintragen</button><button type="button" data-ms-fromplanner>Termine aus dem Terminplaner übernehmen</button><button type="button" data-ms-new>Neues Montags Solo beginnen</button></div>'
    +'<div class="small" style="margin-top:6px">3 Vorrunden mit je höchstens '+MAX_PLAYERS+' Spielern, die besten '+FINAL_PER_ROUND+' jeder Vorrunde spielen das Finale. Alles wird sofort gespeichert'+(state.updatedAt?' · zuletzt '+new Date(state.updatedAt).toLocaleString('de-DE'):'')+'.</div>'
    +(lastError?'<div class="small" style="color:#ff9d9d">'+esc(lastError)+'</div>':'')+'</div>'
    +ROUND_KEYS.map(roundCard).join('')+finaleCard()
    +(state.archive.length?'<div class="card"><h3>Frühere Montags Solos</h3>'+state.archive.map(x=>'<div class="small">'+esc(x.title)+' · Finale '+deDate(x.date)+(x.winner?' · Sieger: '+esc(x.winner):'')+'</div>').join('')+'</div>':'');
}
function slotOf(from,slot){return state.finale.slots.find(s=>s.from===from&&s.slot===Number(slot));}
async function onClick(e){
  const t=e.target.closest('button');if(!t||!state)return;
  const d=t.dataset;
  try{
    if('msAdd' in d){
      const k=d.msAdd,r=state.rounds[k],pick=document.querySelector('[data-ms-pick="'+k+'"]'),free=document.querySelector('[data-ms-free="'+k+'"]');
      const name=clean(free?.value)||clean(pick?.value);
      if(!name)return toast('Bitte einen Spieler auswählen oder einen Namen eingeben.');
      if(r.players.length>=MAX_PLAYERS)return toast('Höchstens '+MAX_PLAYERS+' Spieler pro Vorrunde.');
      if(r.players.some(p=>sameName(p.name,name)))return toast(name+' ist bereits eingetragen.');
      r.players.push({name,paid:false});await save();
    }else if('msRemove' in d){
      const r=state.rounds[d.msRemove],p=r.players[+d.i];
      if(p&&confirm(p.name+' aus der '+ROUND_LABEL[d.msRemove]+' entfernen?')){r.players.splice(+d.i,1);await save();}
    }else if('msSkmr' in d){
      const k=d.msSkmr,isF=k==='finale';
      const names=isF?finaleNames():state.rounds[k].players.map(p=>p.name);
      if(isF&&!finaleComplete())return toast('Das Finale ist noch nicht komplett.');
      const file=await createSkmr(state.title+' '+ROUND_LABEL[k],isF?state.finale.date:state.rounds[k].date,names);
      toast('StockTV-Datei erstellt: '+file,7000);
    }else if('msCash' in d){printCashList(d.msCash);}
    else if('msClear' in d){
      const k=d.msClear;if(!confirm('Ergebnis der '+ROUND_LABEL[k]+' entfernen?'))return;
      if(k==='finale')state.finale.result=null;else{state.rounds[k].result=null;state.rounds[k].reserves=[];}
      await save();
    }else if('msCancel' in d){
      const s=slotOf(d.msCancel,d.slot);if(!s)return;
      if(!confirm(s.name+' kann am Finale nicht teilnehmen?'))return;
      s.status='abgesagt';await save();
    }else if('msUndo' in d){
      const s=slotOf(d.msUndo,d.slot);if(!s)return;
      if(s.substitute){const q=qualifiersOf(s.from)[s.slot];Object.assign(s,{name:q?.name||'',rank:s.slot+1,substitute:false});}
      s.status='ok';await save();
    }else if('msPlanner' in d){await syncPlanner();}
    else if('msFromplanner' in d){await importFromPlanner();}
    else if('msNew' in d){
      if(!confirm('Das aktuelle Montags Solo abschließen und ein neues beginnen? Spieler und Ergebnisse werden ins Archiv verschoben.'))return;
      const winner=state.finale.result?.rows?.[0]?.name||'';
      const archive=[{title:state.title,date:state.finale.date,winner,finale:state.finale.result?.rows||[]},...state.archive].slice(0,20);
      state={...emptyState(),title:state.title,fee:state.fee,time:state.time,location:state.location,archive};
      await save('Neues Montags Solo angelegt.');
    }
  }catch(err){toast(err.message||String(err),7000);}
}
async function onChange(e){
  const t=e.target,d=t.dataset;if(!state)return;
  try{
    if('msSet' in d){state[d.msSet]=d.msSet==='fee'?Number(t.value)||0:t.value;await save();}
    else if('msLink' in d){if(t.value)await linkPlanner(d.msLink,t.value);else{delete state.plannerIds[d.msLink];await save();}}
    else if('msDate' in d){if(d.msDate==='finale')state.finale.date=t.value;else state.rounds[d.msDate].date=t.value;await save();}
    else if('msPaid' in d){const p=state.rounds[d.msPaid].players[+d.i];if(p){p.paid=t.checked;await save();}}
    else if('msFpaid' in d){const s=slotOf(d.msFpaid,d.slot);if(s){s.paid=t.checked;await save();}}
    else if('msReserve' in d){
      const r=state.rounds[d.msReserve];
      if(!r.reserves.length&&r.result)r.reserves=r.result.rows.slice(FINAL_PER_ROUND,FINAL_PER_ROUND+2).map(x=>x.name);
      r.reserves=r.reserves.filter(n=>!sameName(n,d.name));
      if(t.checked){const order=r.result.rows.map(x=>key(x.name));r.reserves.push(d.name);r.reserves.sort((a,b)=>order.indexOf(key(a))-order.indexOf(key(b)));}
      await save();
    }else if('msSub' in d){
      const s=slotOf(d.msSub,d.slot);if(!s||!t.value)return;
      const rank=state.rounds[d.msSub].result?.rows.find(x=>sameName(x.name,t.value))?.rank||0;
      Object.assign(s,{name:t.value,rank,status:'ok',substitute:true,paid:false});
      state.rounds[d.msSub].reserves=state.rounds[d.msSub].reserves.filter(n=>!sameName(n,t.value));
      await save(t.value+' rückt ins Finale nach.');
    }else if('msResult' in d){
      const f=t.files?.[0];if(!f)return;
      const k=d.msResult,res=parseSkmr(await f.text());
      const expected=k==='finale'?finaleNames():state.rounds[k].players.map(p=>p.name);
      const unknown=res.rows.filter(x=>!expected.some(n=>sameName(n,x.name))).map(x=>x.name);
      if(expected.length&&unknown.length&&!confirm('In der Datei stehen Spieler, die nicht in der '+ROUND_LABEL[k]+' eingetragen sind: '+unknown.join(', ')+'. Trotzdem übernehmen?')){t.value='';return;}
      if(res.played<res.total&&!confirm('In der Datei sind erst '+res.played+' von '+res.total+' Spielen eingetragen. Trotzdem als Ergebnis übernehmen?')){t.value='';return;}
      const entry={...res,filename:f.name,uploadedAt:new Date().toISOString()};
      if(k==='finale')state.finale.result=entry;
      else{
        state.rounds[k].result=entry;state.rounds[k].reserves=res.rows.slice(FINAL_PER_ROUND,FINAL_PER_ROUND+2).map(x=>x.name);
        // Spielerliste der Vorrunde aus der Datei ergänzen, falls dort jemand fehlte.
        for(const x of res.rows)if(!state.rounds[k].players.some(p=>sameName(p.name,x.name)))state.rounds[k].players.push({name:x.name,paid:false});
        syncFinaleSlots();
      }
      t.value='';
      await save('Ergebnis der '+ROUND_LABEL[k]+' übernommen'+(k==='finale'?'.':' – die besten '+FINAL_PER_ROUND+' stehen im Finale.'));
    }
  }catch(err){t.value&&t.type==='file'&&(t.value='');toast(err.message||String(err),7000);}
}
async function open(){
  if(!isAdmin()){toast('Montags Solo ist nur für Administratoren freigegeben.');return;}
  const a=document.getElementById('adminMain');if(!a)return;
  css();
  a.innerHTML='<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px"><h2 style="margin:0">Montags Solo</h2><button type="button" onclick="adminSection(\'ic\')">← Zurück zu Interne Cups</button></div><div id="msRoot"></div>';
  const root=a.querySelector('#msRoot');
  root.addEventListener('click',onClick);root.addEventListener('change',onChange);
  state=null;lastError='';render();
  try{await load();if(adoptPlannerDates())await save('Geänderte Termine aus dem Terminplaner übernommen.');}catch(e){lastError='Laden fehlgeschlagen: '+(e.code||e.message);}
  render();
}
window.ECWMontagsSolo={open,parseSkmr,normalize,_test:{set:s=>{state=normalize(s)},get:()=>state,render,syncFinaleSlots,finaleComplete,finaleNames,availableReserves}};
})();
