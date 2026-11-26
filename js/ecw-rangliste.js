/* EC Wegscheid – Vereinsrangliste (rollierend).
   Alle Ergebnisse werden als „Wettbewerbe“ gespeichert (Kategorie, Wertungsart, Saison, Platzierungen).
   Je Kategorie zählt nur die NEUESTE Saison: Sobald z. B. das Montags Solo 2026/27 eingetragen ist,
   fällt das Montags Solo 2025/26 heraus. Die anderen Kategorien bleiben bis zu ihrem neuen Ergebnis stehen.
   Punkte je Wettbewerb: Höchstpunkte × (100 % Sieger … 10 % Letzter, gleichmäßig abgestuft).
   Vorrunden (Montags Solo, Solo Cup …): je Spieler und Kategorie zählt nur die beste Vorrunde.
   Ergebnis wird in Firestore turnierauswertung/rangliste veröffentlicht (Smartphone „Meine Ergebnisse“). */
(function(){
'use strict';
const DOC=['turnierauswertung','rangliste'];
const TYPES={
  group:{label:'Gruppe / Vorrunde (Mannschaft)',max:70},
  final:{label:'Abschlussturnier / Endergebnis (Mannschaft)',max:80},
  round:{label:'Vorrunde Einzel (nur beste zählt)',max:100},
  soloFinal:{label:'Finale / Endrunde Einzel',max:150},
  pyramid:{label:'Solo Pyramide Endstand',max:150},
  jm:{label:'Ziel-Jahresmeisterschaft',max:120},
  vm:{label:'Vereinsmeisterschaft (zusammengelost)',max:40}
};
const CATEGORIES=['Duo Cup','Montags Solo','Solo Cup','Solo Pyramide','Ziel-JM','Vereinsmeisterschaft','Frauencup','Frauen Solo Pyramide'];
// Frauenwertung: eigene Rangliste aus Frauencup, Vereinsmeisterschaft und Frauen Solo Pyramide.
// Frauencup und Frauen Solo Pyramide zählen nur dort, nicht in der allgemeinen Rangliste.
const WOMEN_CATS=['Frauencup','Vereinsmeisterschaft','Frauen Solo Pyramide'],WOMEN_ONLY=['Frauencup','Frauen Solo Pyramide'];
const inScope=(cat,scope)=>scope==='frauen'?WOMEN_CATS.includes(cat):!WOMEN_ONLY.includes(cat);
const DEFAULT_TYPE={'Frauen Solo Pyramide':'pyramid','Frauencup':'group','Duo Cup':'group','Montags Solo':'round','Solo Cup':'round','Solo Pyramide':'pyramid','Ziel-JM':'jm','Vereinsmeisterschaft':'vm'};
const PYR_WIN=8,PYR_LOSS=2;
let cfg=null,result=null,busy=false,msg='',openEv=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const key=s=>clean(s).toLocaleLowerCase('de-DE').replace(/[.,]/g,'').split(' ').filter(Boolean).sort().join(' ');
const db=()=>typeof firestoreDb!=='undefined'?firestoreDb:null;
const isAdmin=()=>typeof appPermissions!=='undefined'&&appPermissions.admin===true;
const toast=(m,t)=>{if(typeof showToast==='function')showToast(m,t||5000);};
const deDate=iso=>{const p=String(iso||'').slice(0,10).split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0]:''};
const seasonKey=s=>Number(String(s||'').match(/\d{4}/)?.[0]||0);
// Saison Dezember bis November
function currentSeason(){const d=new Date(),y=d.getFullYear();return d.getMonth()>=11?y+'/'+String(y+1).slice(2):(y-1)+'/'+String(y).slice(2);}

function placePoints(max,rank,n){
  if(!(n>0)||!(rank>0))return 0;
  if(n===1)return max;
  return Math.round(max*(0.1+0.9*Math.max(0,n-rank)/(n-1)));
}

/* ---------- Spielerliste und Spitznamen ---------- */
function roster(){
  let list=[];try{list=typeof tpPlayers==='function'?tpPlayers(true):[];}catch(e){}
  const map=new Map();list.filter(n=>n&&n!=='X').forEach(n=>map.set(key(n),n));
  return map;
}
function resolveName(n,ros){
  const t=clean(n);if(!t)return '';
  const alias=cfg.aliases&&cfg.aliases[t];
  if(alias)return alias;
  return ros.get(key(t))||t;
}
// Mannschaftsname → Spieler („Huber Max / Maier Eva“, „Huber Max und Maier Eva“)
function splitPlayers(text,ros){
  const t=clean(text);if(!t)return [];
  if(ros.has(key(t))||cfg.aliases?.[t])return [resolveName(t,ros)];
  return t.split(/\s*(?:\/|&|\+|;|\bund\b|,)\s*/i).map(clean).filter(Boolean).map(x=>resolveName(x,ros));
}
const known=(n,ros)=>ros.size===0||ros.has(key(n));

/* ---------- Laden / Speichern ---------- */
// Ein Lesefehler darf nie zu einer leeren Rangliste führen, die dann gespeichert wird.
async function getDoc(c,d){const s=await db().collection(c).doc(d).get();return s.exists?s.data():null;}
// Wettbewerbe, die es je Kategorie und Saison nur einmal gibt (werden ersetzt statt doppelt gezählt)
const SINGLE=['final','soloFinal','pyramid','jm','vm'];
const sameSlot=(a,b)=>a.category===b.category&&a.season===b.season&&(clean(a.label)===clean(b.label)||(a.type===b.type&&SINGLE.includes(a.type)));
// Startstand 2025/26 einmalig ergänzen (fehlende Wettbewerbe), ohne vorhandene doppelt zu zählen
function mergeSeed(){
  const seed=window.ECW_RANGLISTE_2025_26,ver=Number(seed?.version)||1;if(!seed||(cfg.seeded&&cfg.seedVersion>=ver))return 0;let n=0;
  seed.events.forEach((e,i)=>{if(cfg.events.some(x=>sameSlot(x,e)))return;cfg.events.push({...JSON.parse(JSON.stringify(e)),id:'ev_2526_'+e.category.replace(/\W/g,'')+'_'+i});n++;});
  cfg.aliases={...seed.aliases,...cfg.aliases};cfg.women=[...new Set([...(cfg.women||[]),...(seed.women||[])])];cfg.seeded=true;cfg.seedVersion=ver;return n;
}
async function load(){
  let rl;
  try{rl=await getDoc(DOC[0],DOC[1]);}catch(e){cfg=null;throw Error('Rangliste konnte nicht geladen werden ('+(e.code||e.message)+'). Es wurde nichts verändert.');}
  const c=rl&&rl.config||{};
  cfg={visible:!!c.visible,season:c.season||currentSeason(),events:Array.isArray(c.events)?c.events:[],aliases:c.aliases&&typeof c.aliases==='object'?c.aliases:{},seeded:!!c.seeded,seedVersion:Number(c.seedVersion)||(c.seeded?1:0),women:Array.isArray(c.women)?c.women:[]};
  // ältere Version: nur StockTV-Ergebnisse ohne Kategorie
  cfg.events.forEach(ev=>{if(!ev.category)ev.category=ev.type==='vm'?'Vereinsmeisterschaft':'Duo Cup';if(!ev.season)ev.season=cfg.season;if(ev.type==='cupFinal')ev.type='final';
    if(!Array.isArray(ev.rows))ev.rows=[];ev.rows.forEach(r=>{if(!Array.isArray(r.players))r.players=[];});});
  result=rl&&Array.isArray(rl.rows)?{rows:rl.rows,rowsFrauen:Array.isArray(rl.rowsFrauen)?rl.rowsFrauen:[],updatedAt:rl.updatedAt}:null;
}
async function saveConfig(extra){
  if(!isAdmin())throw Error('Nur Administratoren dürfen die Rangliste bearbeiten.');
  const payload={visible:!!cfg.visible,config:{visible:!!cfg.visible,season:cfg.season,events:cfg.events,aliases:cfg.aliases,seeded:!!cfg.seeded,seedVersion:cfg.seedVersion||0,women:cfg.women||[]},...(extra||{})};
  await db().collection(DOC[0]).doc(DOC[1]).set(JSON.parse(JSON.stringify(payload)),{merge:true});
}

/* ---------- Welche Wettbewerbe zählen? ---------- */
function countingSeasons(){
  const latest={};
  for(const ev of cfg.events){const k=seasonKey(ev.season);if(!latest[ev.category]||k>seasonKey(latest[ev.category]))latest[ev.category]=ev.season;}
  return latest;
}
const counts=(ev,latest)=>latest[ev.category]===ev.season;

/* ---------- Berechnung ---------- */
function isWoman(name,ros){
  try{if(typeof tpGender==='function'){const g=tpGender(name);if(g==='Dame')return true;if(g==='Herr')return false;}}catch(e){}
  const k=key(name);
  if((cfg.women||[]).some(w=>key(resolveName(w,ros))===k))return true;
  // sonst: wer im Frauencup (jeweils die zuerst genannte Person einer Paarung) oder in der Frauen Solo Pyramide gespielt hat
  return cfg.events.some(ev=>WOMEN_ONLY.includes(ev.category)&&(ev.rows.some(r=>r.players[0]&&key(resolveName(r.players[0],ros))===k)||Object.keys(ev.games||{}).some(p=>key(resolveName(p,ros))===k)));
}
function compute(scope){
  const ros=roster(),latest=Object.fromEntries(Object.entries(countingSeasons()).filter(([c])=>inScope(c,scope))),people=new Map(),unknown=new Set();
  // gleiche Person in verschiedener Schreibweise („Stadler Martin“ / „Martin Stadler“) zusammenführen
  const person=n=>{const k=key(n);if(!people.has(k))people.set(k,{name:ros.get(k)||n,total:0,parts:[],cats:new Set()});return people.get(k);};
  const bestRound=new Map(); // Kategorie|Saison|Spieler -> part
  // Startstand zuerst: dessen Schreibweise („Nachname Vorname“) wird für die Anzeige verwendet
  const evs=[...cfg.events].sort((a,b)=>(String(b.id).startsWith('ev_2526_')?1:0)-(String(a.id).startsWith('ev_2526_')?1:0));
  for(const ev of evs){
    if(!inScope(ev.category,scope)||!counts(ev,latest)||!(ev.rows||[]).length&&!Object.keys(ev.games||{}).length)continue;
    const t=TYPES[ev.type]||TYPES.group,n=Number(ev.n)||ev.rows.length;
    for(const r of ev.rows){
      const pts=placePoints(t.max,Number(r.rank),n);
      const seen=new Set(),names=r.players.map(x=>resolveName(x,ros)).map(clean).filter(Boolean);
      // einzelne Wörter, die nur Teil eines vollen Namens derselben Zeile sind (ältere StockTV-Einlesung), überspringen
      const words=new Set(names.filter(n=>/\s/.test(n)).flatMap(n=>n.toLocaleLowerCase('de-DE').split(' ')));
      for(const p of names){
        if(!/\s/.test(p)&&words.has(p.toLocaleLowerCase('de-DE'))&&!ros.has(key(p))&&!cfg.aliases?.[p])continue;
        if(seen.has(key(p)))continue;seen.add(key(p));
        if(!known(p,ros))unknown.add(p);
        const part={type:ev.type,category:ev.category,label:ev.label,date:ev.date||'',place:Number(r.rank),of:n,points:pts};
        if(ev.type==='round'){const k=ev.category+'|'+ev.season+'|'+key(p),old=bestRound.get(k);if(!old||pts>old.part.points)bestRound.set(k,{p,part});continue;}
        const pr=person(p);pr.parts.push(part);pr.total+=pts;pr.cats.add(ev.category);
      }
    }
    for(const [p,g] of Object.entries(ev.games||{})){
      const pr=person(resolveName(p,ros));const pts=(g.w||0)*PYR_WIN+(g.l||0)*PYR_LOSS;
      pr.parts.push({type:'pyramidGames',category:ev.category,label:ev.category+' · Spiele',won:g.w||0,lost:g.l||0,points:pts});pr.total+=pts;pr.cats.add(ev.category);
    }
  }
  for(const {p,part} of bestRound.values()){const pr=person(p);pr.parts.push(part);pr.total+=part.points;pr.cats.add(part.category);}
  const cats=Object.keys(latest);
  // Damen haben eine eigene Rangliste: dort nur Damen, in der Herren-Rangliste keine Damen
  const list=[...people.values()].filter(p=>scope==='frauen'?isWoman(p.name,ros):!isWoman(p.name,ros)).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'de'));
  let rank=0,prev=null;list.forEach((r,i)=>{if(r.total!==prev)rank=i+1;r.rank=rank;prev=r.total;r.all=cats.length>1&&cats.every(c=>r.cats.has(c));});
  return {rows:list,unknown:[...unknown].sort((a,b)=>a.localeCompare(b,'de')),cats};
}
async function publish(){
  if(busy)return;busy=true;msg='Wird berechnet …';render();
  try{
    const r=compute('all'),w=compute('frauen');
    const slim=x=>x.rows.map(p=>({rank:p.rank,name:p.name,total:p.total,all:p.all,parts:p.parts}));
    const rows=slim(r),rowsFrauen=slim(w);
    result={rows,rowsFrauen,updatedAt:new Date().toISOString()};
    await saveConfig({season:cfg.season,rows,updatedAt:result.updatedAt,categories:r.cats,rowsFrauen,categoriesFrauen:w.cats});
    msg='Rangliste berechnet: Herren '+rows.length+', Damen '+rowsFrauen.length+(cfg.visible?' · am Smartphone sichtbar':' · am Smartphone ausgeblendet')+(r.unknown.length?' · nicht in der Spielerliste (trotzdem gewertet, bitte prüfen): '+r.unknown.join(', '):'')+'.';
  }catch(e){msg='Fehler: '+(e.code||e.message);}
  finally{busy=false;render();}
}

/* ---------- Eingabe ---------- */
function parseText(text,ros){
  const rows=[];let auto=0;
  for(const raw of String(text||'').split(/\r?\n/)){
    const line=clean(raw);if(!line)continue;
    const m=line.match(/^(\d+)\s*[.):-]?\s*(?:Platz\s*)?(.*)$/i);
    const rank=m?Number(m[1]):auto+1;
    const rest=clean(m?m[2]:line).replace(/\s+\d+([,.]\d+)?(\s.*)?$/,'');
    if(!rest)continue;auto=rank;
    rows.push({rank,team:rest,players:splitPlayers(rest,ros)});
  }
  return rows;
}
async function readSkmr(file){
  if(!window.ECWMontagsSolo||!ECWMontagsSolo.parseSkmr)throw Error('StockTV-Leser nicht geladen.');
  const text=await file.text();const res=ECWMontagsSolo.parseSkmr(text);
  const date=(text.match(/<DateOfTournament>(\d{4}-\d{2}-\d{2})/)||[])[1]||'';
  if(res.played<res.total&&!confirm('In der Datei sind erst '+res.played+' von '+res.total+' Spielen eingetragen. Trotzdem übernehmen?'))return null;
  const ros=roster();
  return {date,title:res.title,rows:res.rows.map(r=>({rank:r.rank,team:r.name,players:splitPlayers(r.name,ros)}))};
}
function formValues(root){
  const v=id=>root.querySelector('#'+id)?.value||'';
  return {category:v('rlNewCat'),type:v('rlNewType'),season:clean(v('rlNewSeason'))||cfg.season,label:clean(v('rlNewLabel')),date:v('rlNewDate'),text:v('rlNewText')};
}
async function addEvent(root){
  const f=formValues(root),file=root.querySelector('#rlNewFile')?.files?.[0];
  if(!f.category)return toast('Bitte eine Kategorie wählen.');
  let rows=[],date=f.date,title='';
  if(file){const r=await readSkmr(file);if(!r)return;rows=r.rows;date=date||r.date;title=r.title;}
  else rows=parseText(f.text,roster());
  if(!rows.length)return toast('Keine Platzierungen gefunden. StockTV-Datei wählen oder Liste eingeben („1. Name“ je Zeile).');
  const latest=countingSeasons()[f.category];
  if(latest&&seasonKey(f.season)<seasonKey(latest)&&!confirm('Für „'+f.category+'“ gibt es schon die neuere Saison '+latest+'. Dieses Ergebnis würde nicht zählen. Trotzdem speichern?'))return;
  const ev={id:'ev_'+Date.now(),category:f.category,type:f.type||DEFAULT_TYPE[f.category]||'group',season:f.season,label:f.label||(f.category+(title?' · '+title:'')),date,rows};
  cfg.events.push(ev);openEv=ev.id;
  await saveConfig();
  const replaced=latest&&seasonKey(f.season)>seasonKey(latest);
  msg='„'+ev.label+'“ gespeichert ('+rows.length+' Plätze).'+(replaced?' Die Ergebnisse '+f.category+' '+latest+' zählen ab jetzt nicht mehr.':'')+' Bitte unten die Spieler prüfen und danach „Rangliste berechnen“.';
}
async function importSeed(){
  const seed=window.ECW_RANGLISTE_2025_26;if(!seed)return toast('Daten 2025/26 nicht geladen.');
  cfg.seeded=false;const n=mergeSeed();
  await saveConfig();msg='Saison 2025/26: '+n+' Wettbewerbe ergänzt. Jetzt „Rangliste berechnen“.';
}
// Aus dem Programm übernehmen (Momentaufnahme als normaler Wettbewerb)
async function importFromApp(kind){
  const ros=roster(),season=cfg.season,add=[];
  if(kind==='ms'){
    const ms=await getDoc('turnierauswertung','montagsSolo');if(!ms)return toast('Kein Montags Solo gespeichert.');
    ['v1','v2','v3'].forEach((k,i)=>{const r=ms.rounds?.[k];const rows=r?.result?.rows;if(rows?.length)add.push({category:'Montags Solo',type:'round',label:'Montags Solo · Vorrunde '+(i+1),date:r.date||'',rows:rows.map(x=>({rank:x.rank,team:x.name,players:[resolveName(x.name,ros)]}))});});
    const fr=ms.finale?.result?.rows;if(fr?.length)add.push({category:'Montags Solo',type:'soloFinal',label:'Montags Solo · Finale',date:ms.finale.date||'',rows:fr.map(x=>({rank:x.rank,team:x.name,players:[resolveName(x.name,ros)]}))});
  }else if(kind==='jm'){
    const st=(await getDoc('turnierauswertung','jahresmeisterschaft'))?.state;if(!st?.players)return toast('Keine Ziel-Jahresmeisterschaft gespeichert.');
    const rows=st.players.map(p=>{const vals=Array.from({length:6},(_,i)=>{const r=p?.r?.[i];const s=Array.isArray(r)?r:(r&&r.__ecwNestedArrayV1);return Array.isArray(s)&&s.every(Number.isFinite)?s.reduce((a,b)=>a+b,0):null;});
      const played=vals.filter(v=>v!==null).length,v=vals.map(x=>x??0),total=v.reduce((a,b)=>a+b,0);return {name:clean(p?.n),result:total-Math.min(...v),played};})
      .filter(r=>r.name&&r.played>0).sort((a,b)=>b.result-a.result);
    let rk=0,prev=null;add.push({category:'Ziel-JM',type:'jm',label:clean(st.title)||'Ziel-Jahresmeisterschaft',date:'',rows:rows.map((r,i)=>{if(r.result!==prev)rk=i+1;prev=r.result;return {rank:rk,team:r.name,players:[resolveName(r.name,ros)]};})});
  }else if(kind==='pyr'){
    const s=await getDoc('soloPyramide','state');if(!s?.players)return toast('Keine Solo Pyramide gespeichert.');
    const list=s.players.filter(p=>typeof p==='string'&&clean(p)&&p!=='FREI');const games={};
    for(const line of s.hist||[]){const m=String(line).match(/^(.*?)\s+-\s+(.+?)\s+besiegte\s+(.+?)\s+(\d+):(\d+)\s*$/);if(!m)continue;
      for(const [nm,won] of [[m[2],true],[m[3],false]]){const who=resolveName(nm,ros);const g=games[who]||(games[who]={w:0,l:0});won?g.w++:g.l++;}}
    add.push({category:'Solo Pyramide',type:'pyramid',label:'Solo Pyramide · Endstand',date:new Date().toISOString().slice(0,10),rows:list.map((p,i)=>({rank:i+1,team:p,players:[resolveName(p,ros)]})),games});
  }
  if(!add.length)return toast('Keine Ergebnisse gefunden.');
  // gleiche Übernahme derselben Saison ersetzen
  cfg.events=cfg.events.filter(e=>!(e.source==='app-'+kind&&e.season===season));
  add.forEach((e,i)=>cfg.events.push({...e,id:'ev_'+kind+'_'+Date.now()+'_'+i,season,source:'app-'+kind}));
  await saveConfig();msg=add.length+' Wettbewerb(e) aus dem Programm übernommen (Saison '+season+').';
}

/* ---------- Drucken ---------- */
function printList(){
  if(!result||!result.rows.length)return toast('Noch keine Rangliste berechnet.');
  const sum=(r,c)=>r.parts.filter(p=>p.category===c).reduce((a,p)=>a+p.points,0);
  const tbl=list=>{const cats=CATEGORIES.filter(c=>list.some(r=>r.parts.some(p=>p.category===c)));
    return '<table><thead><tr><th>Pl.</th><th>Name</th>'+cats.map(c=>'<th class="r">'+esc(c)+'</th>').join('')+'<th class="r">Gesamt</th></tr></thead><tbody>'+list.map(r=>'<tr><td>'+r.rank+'.</td><td>'+esc(r.name)+(r.all?' ★':'')+'</td>'+cats.map(c=>'<td class="r">'+(sum(r,c)||'–')+'</td>').join('')+'<td class="r"><b>'+r.total+'</b></td></tr>').join('')+'</tbody></table>';};
  const latest=countingSeasons();
  const w=window.open('','_blank');if(!w)return toast('Bitte Pop-ups erlauben.');
  w.document.write('<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Vereinsrangliste</title><style>@page{size:A4;margin:12mm}body{font:10pt Arial}h1{font-size:17pt;margin:0 0 3px}p{font-size:8.5pt;color:#444;margin:0 0 8px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #bbb;padding:3px 5px;text-align:left}th{background:#8b0000;color:#fff;font-size:8.5pt}.r{text-align:right}</style></head><body><h1>Rangliste Herren EC Wegscheid</h1><p>Stand '+new Date(result.updatedAt).toLocaleDateString('de-DE')+' · gezählt: '+esc(Object.entries(latest).map(([c,s])=>c+' '+s).join(' · '))+' · ★ = bei allen Wettbewerben dabei</p>'+tbl(result.rows)+((result.rowsFrauen||[]).length?'<h1 style="margin-top:18px;page-break-before:always">Rangliste Damen EC Wegscheid</h1><p>Frauencup · Vereinsmeisterschaft · Frauen Solo Pyramide</p>'+tbl(result.rowsFrauen):'')+'<script>onload=()=>print()<\/script></body></html>');
  w.document.close();
}

/* ---------- Anzeige ---------- */
function css(){
  if(document.getElementById('rlCss'))return;
  const s=document.createElement('style');s.id='rlCss';
  s.textContent='.rl-table{width:100%;border-collapse:collapse}.rl-table th,.rl-table td{padding:5px 7px;border-bottom:1px solid rgba(255,255,255,.14);text-align:left;vertical-align:top}.rl-table .r{text-align:right}'
   +'.rl-table details summary{cursor:pointer}.rl-parts{font-size:.85rem;opacity:.9;margin:4px 0 0;padding-left:18px}'
   +'.rl-ev{border:1px solid rgba(255,255,255,.18);border-radius:8px;margin:6px 0}.rl-ev>summary{cursor:pointer;padding:7px 10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.rl-ev.old{opacity:.5}.rl-ev table{width:100%;border-collapse:collapse;margin:0 0 8px}.rl-ev td{padding:3px 8px;border-bottom:1px solid rgba(255,255,255,.08)}.rl-ev input{margin:0!important}'
   +'.rl-badge{font-size:.75rem;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,.15)}.rl-badge.ok{background:#1e7d32}.rl-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px 12px}.rl-form label{display:flex;flex-direction:column;gap:3px;margin:0;font-size:.85rem}#rlNewText{min-height:120px;font-family:inherit;width:100%}'
   +'.rl-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.rl-star{color:#f3c34b}';
  document.head.appendChild(s);
}
function render(){
  const root=document.getElementById('rlRoot');if(!root)return;
  if(!cfg){root.innerHTML='<div class="card">'+esc(msg||'Wird geladen …')+'</div>';return;}
  const latest=countingSeasons(),ros=roster();
  const sum=(r,c)=>r.parts.filter(p=>p.category===c).reduce((a,p)=>a+p.points,0);
  const tableOf=list=>{const cats=CATEGORIES.filter(c=>list.some(r=>r.parts.some(p=>p.category===c)));return list.length?'<div style="overflow:auto"><table class="rl-table"><thead><tr><th>Pl.</th><th>Spieler</th>'+cats.map(c=>'<th class="r">'+esc(c)+'</th>').join('')+'<th class="r">Gesamt</th></tr></thead><tbody>'
    +list.map(r=>'<tr><td>'+r.rank+'.</td><td><details><summary>'+esc(r.name)+(r.all?' <span class="rl-star" title="bei allen Wettbewerben dabei">★</span>':'')+'</summary><ul class="rl-parts">'+r.parts.map(p=>'<li>'+esc(p.label)+(p.type==='pyramidGames'?': '+p.won+' Siege, '+p.lost+' Niederlagen':': Platz '+p.place+' von '+p.of)+' → <b>'+p.points+'</b></li>').join('')+'</ul></details></td>'+cats.map(c=>'<td class="r">'+(sum(r,c)||'–')+'</td>').join('')+'<td class="r"><b>'+r.total+'</b></td></tr>').join('')+'</tbody></table></div>'
    +'<div class="small">Stand '+new Date(result.updatedAt).toLocaleString('de-DE')+' · ★ = bei allen Wettbewerben dabei</div>':'<div class="small">Noch keine Rangliste berechnet.</div>';};
  const table=tableOf(result?.rows||[]),tableW=tableOf(result?.rowsFrauen||[]);
  const byCat=CATEGORIES.concat([...new Set(cfg.events.map(e=>e.category))].filter(c=>!CATEGORIES.includes(c)));
  const evHtml=byCat.map(c=>{const list=cfg.events.filter(e=>e.category===c).sort((a,b)=>seasonKey(b.season)-seasonKey(a.season)||String(a.date).localeCompare(String(b.date)));if(!list.length)return '';
    return '<h4 style="margin:12px 0 4px">'+esc(c)+(latest[c]?' <span class="rl-badge ok">zählt: '+esc(latest[c])+'</span>':'')+'</h4>'+list.map(ev=>{const i=cfg.events.indexOf(ev),on=counts(ev,latest),bad=ev.rows.some(r=>!r.players.length||r.players.some(p=>!known(p,ros)));
      return '<details class="rl-ev'+(on?'':' old')+'"'+(openEv===ev.id?' open':'')+'><summary><b>'+esc(ev.label)+'</b><span class="rl-badge">'+esc(ev.season)+'</span><span class="small">'+esc(TYPES[ev.type]?.label||ev.type)+' · '+ev.rows.length+' Plätze'+(ev.date?' · '+deDate(ev.date):'')+'</span>'+(on?'':'<span class="rl-badge">zählt nicht mehr</span>')+(bad?'<span class="rl-badge" style="background:#a33">Spieler prüfen</span>':'')+'</summary>'
        +'<table>'+ev.rows.map((r,j)=>{const ok=r.players.length&&r.players.every(p=>known(p,ros));return '<tr><td style="width:40px">'+r.rank+'.</td><td style="width:30%">'+esc(r.team||'')+'</td><td><input type="text" data-rl-evp="'+i+'" data-j="'+j+'" value="'+esc(r.players.join(' / '))+'" placeholder="Spieler mit / trennen" style="width:100%;'+(ok?'':'border-color:#ff9d9d')+'"></td></tr>';}).join('')+'</table>'
        +'<div class="rl-row" style="padding:0 10px 8px"><label class="small" style="display:flex;gap:6px;align-items:center;margin:0">Saison <input type="text" data-rl-evseason="'+i+'" value="'+esc(ev.season)+'" style="width:90px"></label><button type="button" data-rl-evdel="'+i+'">Wettbewerb löschen</button></div></details>';}).join('');}).join('');
  const typeOpts=Object.entries(TYPES).map(([k,t])=>'<option value="'+k+'">'+esc(t.label)+' – max. '+t.max+'</option>').join('');
  root.innerHTML='<div class="card"><div class="rl-row">'
    +'<button type="button" class="primary" data-rl-publish'+(busy?' disabled':'')+'>Rangliste berechnen</button><button type="button" data-rl-print>Drucken</button></div>'
    +'<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" data-rl-visible'+(cfg.visible?' checked':'')+' style="width:auto;margin:0"> <b>Am Smartphone in „Meine Ergebnisse“ anzeigen</b></label>'
    +(msg?'<div class="small" style="margin-top:8px">'+esc(msg)+'</div>':'')+'</div>'
    +'<div class="card"><h3 style="margin-top:0">Rangliste Herren</h3>'+table+'</div>'
    +'<div class="card"><h3 style="margin-top:0">Rangliste Damen</h3><div class="small" style="margin-bottom:6px">Frauencup · Vereinsmeisterschaft · Frauen Solo Pyramide. Als Dame zählt, wer unten eingetragen ist, in der Spielerliste als „Dame“ zugeordnet ist oder im Frauencup (zuerst genannt) / in der Frauen Solo Pyramide gespielt hat. Damen erscheinen nicht in der Rangliste Herren.</div>'+tableW
      +'<label class="small" style="display:block;margin-top:8px">Damen (eine pro Zeile)<textarea id="rlWomen" style="width:100%;min-height:90px">'+esc((cfg.women||[]).join('\n'))+'</textarea></label><div class="rl-row"><button type="button" data-rl-women>Damen speichern und neu berechnen</button></div></div>'
    +'<div class="card"><h3 style="margin-top:0">Neues Ergebnis eintragen</h3>'
    +'<div class="small" style="margin-bottom:8px">Je Kategorie zählt nur die neueste Saison. Ein Ergebnis einer neuen Saison ersetzt automatisch alle Ergebnisse derselben Kategorie aus der Vorsaison.</div>'
    +'<div class="rl-form"><label>Kategorie<select id="rlNewCat">'+CATEGORIES.map(c=>'<option>'+esc(c)+'</option>').join('')+'</select></label>'
    +'<label>Wertung<select id="rlNewType">'+typeOpts+'</select></label>'
    +'<label>Saison<input id="rlNewSeason" type="text" value="'+esc(cfg.season)+'"></label>'
    +'<label>Bezeichnung<input id="rlNewLabel" type="text" placeholder="z. B. Duo Cup · Gruppe A"></label>'
    +'<label>Datum<input id="rlNewDate" type="date"></label>'
    +'<label>StockTV-Datei (.skmr)<input id="rlNewFile" type="file" accept=".skmr,.xml"></label></div>'
    +'<label style="display:block;margin-top:8px">… oder Platzierungen eingeben (je Zeile: Platz und Name, Mannschaften mit „/“ oder „und“)<textarea id="rlNewText" placeholder="1. Höglinger Paul&#10;2. Höglinger Heinz&#10;3. Freund Heiner und Höglinger Paul"></textarea></label>'
    +'<div class="rl-row" style="margin-top:8px"><button type="button" class="primary" data-rl-add>Ergebnis speichern</button></div>'
    +'<h4 style="margin:14px 0 4px">Aus dem Programm übernehmen (Saison '+esc(cfg.season)+')</h4><div class="rl-row"><button type="button" data-rl-app="ms">Montags Solo</button><button type="button" data-rl-app="pyr">Solo Pyramide (mit Spielen)</button><button type="button" data-rl-app="jm">Ziel-Jahresmeisterschaft</button></div>'
    +(cfg.seeded||!window.ECW_RANGLISTE_2025_26?'':'<div class="rl-row" style="margin-top:12px"><button type="button" class="primary" data-rl-seed>Ergebnisse Saison 2025/26 übernehmen (Startstand)</button></div>')
    +'<div class="rl-row" style="margin-top:12px"><label class="small" style="display:flex;gap:6px;align-items:center;margin:0">Aktuelle Saison (Vorgabe für neue Einträge) <input type="text" data-rl-season value="'+esc(cfg.season)+'" style="width:90px"></label></div></div>'
    +'<div class="card"><h3 style="margin-top:0">Eingetragene Wettbewerbe</h3>'+(evHtml||'<div class="small">Noch keine Wettbewerbe eingetragen.</div>')+'<div class="small" style="margin-top:8px">Spieler, die nicht in der Spielerliste stehen, sind rot markiert. Bei Spitznamen (z. B. „Masy“) den richtigen Namen eintragen – die Zuordnung wird gemerkt und beim nächsten Einlesen automatisch verwendet.</div></div>'
    +'<div class="card"><h3 style="margin-top:0">Punkteverteilung</h3><table class="rl-table">'+Object.values(TYPES).map(t=>'<tr><td>'+esc(t.label)+'</td><td class="r"><b>'+t.max+'</b></td></tr>').join('')+'<tr><td>Solo Pyramide · je gewonnenes / verlorenes Spiel</td><td class="r"><b>'+PYR_WIN+' / '+PYR_LOSS+'</b></td></tr></table><div class="small">Sieger 100 %, Letzter 10 % der Höchstpunkte, dazwischen gleichmäßig. Mannschaften: jeder Spieler bekommt die Punkte der Mannschaft.</div></div>';
  const catSel=root.querySelector('#rlNewCat'),typeSel=root.querySelector('#rlNewType');
  if(catSel&&typeSel){typeSel.value=DEFAULT_TYPE[catSel.value]||'group';catSel.onchange=()=>{typeSel.value=DEFAULT_TYPE[catSel.value]||'group';};}
}
async function onChange(e){
  const t=e.target,d=t.dataset;if(!cfg)return;
  try{
    if('rlVisible' in d){
      if(t.checked&&!confirm('Rangliste jetzt für alle Spieler am Smartphone anzeigen?')){t.checked=false;return;}
      cfg.visible=t.checked;await saveConfig();msg=cfg.visible?'Rangliste ist am Smartphone sichtbar.':'Rangliste am Smartphone ausgeblendet.';render();
    }else if('rlSeason' in d){cfg.season=clean(t.value)||currentSeason();await saveConfig();render();}
    else if('rlEvseason' in d){const ev=cfg.events[+d.rlEvseason];ev.season=clean(t.value)||ev.season;openEv=ev.id;await saveConfig();render();}
    else if('rlEvp' in d){
      const ev=cfg.events[+d.rlEvp],r=ev.rows[+d.j],ros=roster();
      r.players=t.value.split('/').map(clean).filter(Boolean).map(n=>ros.get(key(n))||n);
      // Spitzname merken: einzelner Name in der Datei → ein Spieler
      if(r.team&&r.players.length===1&&!/[\/&]|\bund\b/i.test(r.team)&&key(r.team)!==key(r.players[0]))cfg.aliases[clean(r.team)]=r.players[0];
      openEv=ev.id;await saveConfig();render();
    }
  }catch(err){toast(err.message||String(err),7000);}
}
async function onClick(e){
  const b=e.target.closest('button');if(!b||!cfg)return;const d=b.dataset;const root=document.getElementById('rlRoot');
  try{
    if('rlPublish' in d)await publish();
    else if('rlPrint' in d)printList();
    else if('rlAdd' in d){b.disabled=true;try{await addEvent(root);}finally{b.disabled=false;}render();}
    else if('rlSeed' in d){await importSeed();render();}
    else if('rlWomen' in d){cfg.women=[...new Set(String(document.getElementById('rlWomen').value||'').split(/\n/).map(clean).filter(Boolean))];await saveConfig();await publish();}
    else if('rlApp' in d){await importFromApp(d.rlApp);render();}
    else if('rlEvdel' in d){const ev=cfg.events[+d.rlEvdel];if(ev&&confirm('„'+ev.label+'“ ('+ev.season+') löschen?')){cfg.events.splice(+d.rlEvdel,1);await saveConfig();msg='Gelöscht. Bitte Rangliste neu berechnen.';render();}}
  }catch(err){toast(err.message||String(err),7000);}
}
async function open(){
  if(!isAdmin())return toast('Die Vereinsrangliste ist nur für Administratoren.');
  const a=document.getElementById('adminMain');if(!a)return;
  css();
  a.innerHTML='<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px"><h2 style="margin:0">Vereinsrangliste</h2><button type="button" onclick="adminSection(\'ic\')">← Zurück zu Interne Cups</button></div><div id="rlRoot"></div>';
  const root=a.querySelector('#rlRoot');root.addEventListener('change',onChange);root.addEventListener('click',onClick);
  cfg=null;msg='';render();
  try{await load();}catch(e){msg=e.message;render();return;}
  // Startstand 2025/26 fehlt noch → automatisch ergänzen und neu berechnen
  const sv=Number(window.ECW_RANGLISTE_2025_26?.version)||1;
  if((!cfg.seeded||(cfg.seedVersion||0)<sv)&&window.ECW_RANGLISTE_2025_26){const n=mergeSeed();try{await saveConfig();await publish();msg='Saison 2025/26 ergänzt ('+n+' Wettbewerbe, Damenliste) und Rangliste neu berechnet. '+msg;}catch(e){msg='Fehler: '+(e.code||e.message);}}
  render();
}
// Schnittstelle für den Ergebnis-Assistenten
async function addEventApi(ev){
  if(!isAdmin())throw Error('Nur Administratoren dürfen die Rangliste bearbeiten.');
  if(!cfg)await load();
  mergeSeed();
  const latest=countingSeasons()[ev.category];
  cfg.events=cfg.events.filter(e=>!sameSlot(e,ev));
  cfg.events.push({...ev,id:'ev_'+Date.now()});
  await saveConfig();await publish();
  return {replaced:latest&&seasonKey(ev.season)>seasonKey(latest)?latest:''};
}
function resolvePlayersApi(team){if(!cfg)return [];return splitPlayers(team,roster());}
async function ensureLoaded(){if(!cfg)await load();}
window.ECWRangliste={open,placePoints,addEvent:addEventApi,resolvePlayers:resolvePlayersApi,ensureLoaded,_test:{compute,parseText,setCfg:c=>{cfg=Object.assign({visible:false,season:'2026/27',events:[],aliases:{}},c);},countingSeasons}};
})();
