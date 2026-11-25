/* EC Wegscheid – Vereinsrangliste (Interne Cups).
   Saisonablauf: Frauencup/Duo Cup → Montags Solo → Solo Pyramide → Ziel-Jahresmeisterschaft → Vereinsmeisterschaft.
   Punkte je Wettbewerb: Höchstpunkte × (10 % für den Letzten … 100 % für den Sieger), gleichmäßig abgestuft.
   Gezählt werden nur Spieler aus der Spielerliste. Die berechnete Rangliste wird in
   Firestore turnierauswertung/rangliste veröffentlicht (Smartphone „Meine Ergebnisse“). */
(function(){
'use strict';
const DOC=['turnierauswertung','rangliste'];
const MAX={cupGroup:70,cupFinal:80,msRound:100,msFinal:150,pyramid:150,jm:120,vm:40};
const PYR_WIN=8,PYR_LOSS=2;
const LABEL={cupGroup:'Cup · Gruppenphase',cupFinal:'Cup · Abschlussturnier',msRound:'Montags Solo · Vorrunde',msFinal:'Montags Solo · Finale',pyramid:'Solo Pyramide',jm:'Ziel-Jahresmeisterschaft',vm:'Vereinsmeisterschaft'};
let cfg=null,src=null,result=null,busy=false,msg='';

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const key=s=>clean(s).toLocaleLowerCase('de-DE').replace(/[.,]/g,'').split(' ').filter(Boolean).sort().join(' ');
const db=()=>typeof firestoreDb!=='undefined'?firestoreDb:null;
const isAdmin=()=>typeof appPermissions!=='undefined'&&appPermissions.admin===true;
const toast=(m,t)=>{if(typeof showToast==='function')showToast(m,t||5000);};
const deDate=iso=>{const p=String(iso||'').slice(0,10).split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0]:''};

// Platzpunkte: Sieger 100 %, Letzter 10 %, dazwischen gleichmäßig.
function placePoints(max,rank,n){
  if(!(n>0)||!(rank>0))return 0;
  if(n===1)return max;
  return Math.round(max*(0.1+0.9*(n-rank)/(n-1)));
}
// Gemeinsame Plätze bei Gleichstand: gleiche Werte → gleicher Rang.
function ranks(rows,score){let r=0,prev=null;rows.forEach((x,i)=>{const v=score(x);if(i===0||v!==prev)r=i+1;x.rank=r;prev=v;});return rows;}

/* ---------- Spielerliste ---------- */
function roster(){
  let list=[];try{list=typeof tpPlayers==='function'?tpPlayers(true):[];}catch(e){}
  list=list.filter(n=>n&&n!=='X');
  const map=new Map();list.forEach(n=>map.set(key(n),n));
  return map;
}
// Findet Spieler der Spielerliste in einem Mannschaftsnamen („Huber Max / Maier Eva“).
function playersIn(teamName,ros){
  const t=clean(teamName);if(!t)return [];
  const direct=ros.get(key(t));if(direct)return [direct];
  const parts=t.split(/\s*(?:\/|&|\+|,|;|\bund\b| - )\s*/i).map(clean).filter(Boolean);
  const out=[];
  for(const p of parts){const hit=ros.get(key(p));if(hit&&!out.includes(hit))out.push(hit);}
  if(out.length)return out;
  // Notlösung: Spieler, deren Vor- und Nachname beide im Namen vorkommen.
  const words=new Set(key(t).split(' '));
  for(const [k,n] of ros){const w=k.split(' ');if(w.length>1&&w.every(x=>words.has(x))&&!out.includes(n))out.push(n);}
  return out;
}

/* ---------- Quellen laden ---------- */
async function getDoc(c,d){try{const s=await db().collection(c).doc(d).get();return s.exists?s.data():null;}catch(e){console.warn('Rangliste: '+c+'/'+d,e);return null;}}
async function loadSources(){
  const [cup,ms,jm,pyr,rl]=await Promise.all([getDoc('turnierauswertung','cup'),getDoc('turnierauswertung','montagsSolo'),getDoc('turnierauswertung','jahresmeisterschaft'),getDoc('soloPyramide','state'),getDoc(DOC[0],DOC[1])]);
  src={cups:(cup&&cup.tournaments)||{},ms,jm:jm&&jm.state||null,pyr};
  cfg=Object.assign({visible:false,season:'',cups:{},msCurrent:true,msArchive:{},pyramid:true,jm:true,events:[],archive:[]},rl&&rl.config||{});
  cfg.events=Array.isArray(cfg.events)?cfg.events:[];cfg.archive=Array.isArray(rl&&rl.archive)?rl.archive:[];
  if(!cfg.season){const y=new Date().getFullYear(),m=new Date().getMonth();cfg.season=m>=6?y+'/'+String(y+1).slice(2):(y-1)+'/'+String(y).slice(2);}
  result=rl&&rl.rows?{rows:rl.rows,updatedAt:rl.updatedAt}:null;
}

/* ---------- Cup-Tabellen (gleiche Wertung wie die Cupauswertung) ---------- */
function cupStandings(g){
  if(typeof window.ecwCupStandings==='function')return window.ecwCupStandings(g);
  const N=x=>Number(x)||0,stats=new Map();
  for(const t of (g.teams||[]))stats.set(String(t.id),{id:String(t.id),name:t.name||'',points:0,sets:0,for:0,against:0,dq:!!t.dq,dnf:!!t.dnf,played:0});
  for(const m of Object.values(g.matches||{})){const a=stats.get(String(m.teamA)),b=stats.get(String(m.teamB));if(!a||!b||!m.completed)continue;a.played++;b.played++;
    a.for+=N(m.stocksA);a.against+=N(m.stocksB);b.for+=N(m.stocksB);b.against+=N(m.stocksA);const pa=N(m.pointsA),pb=N(m.pointsB);
    if(pa>pb)a.points+=3;else if(pb>pa)b.points+=3;else{a.points++;b.points++;}a.sets+=pa;b.sets+=pb;}
  const arr=[...stats.values()];arr.forEach(r=>r.quota=r.against===0?(r.for?999:1):r.for/r.against);
  return arr.sort((a,b)=>Number(a.dq)-Number(b.dq)||Number(a.dnf)-Number(b.dnf)||b.points-a.points||b.sets-a.sets||b.quota-a.quota);
}

/* ---------- Berechnung ---------- */
function compute(){
  const ros=roster(),people=new Map(),warn=[];
  const add=(name,part)=>{if(!name)return;if(!people.has(name))people.set(name,{name,total:0,parts:[]});const p=people.get(name);p.parts.push(part);p.total+=part.points;};
  const unknown=new Set();
  const award=(type,label,date,rows,teamMode)=>{
    // rows: [{rank, name}] bereits sortiert; teamMode: Name enthält mehrere Spieler
    const n=rows.length;
    for(const r of rows){
      const pts=placePoints(MAX[type],r.rank,n);
      const who=r.players||(teamMode?playersIn(r.name,ros):(ros.get(key(r.name))?[ros.get(key(r.name))]:[]));
      if(!who.length){unknown.add(r.name);continue;}
      for(const w of who)add(w,{type,label,date:date||'',place:r.rank,of:n,points:pts});
    }
  };
  // 1. Frauencup und Duo Cup – Gruppenphase je Gruppe
  for(const [id,t] of Object.entries(src.cups||{})){
    if(!t||!cfg.cups[id])continue;
    for(const [gid,g] of Object.entries(t.groups||{})){
      const table=cupStandings(g).filter(r=>!r.dq&&!r.dnf);
      ranks(table,r=>r.points*1e6+r.sets*1e3+Math.round((r.quota||0)*100));
      award('cupGroup',clean(t.name)+' · '+clean(g.name||gid),'',table.map(r=>({rank:r.rank,name:r.name})),true);
    }
  }
  // StockTV-Ergebnisse (Cup-Abschlussturniere zu Saisonbeginn, Vereinsmeisterschaft am Saisonende)
  const skmrEvents=type=>{for(const ev of cfg.events){
    if(!ev||!Array.isArray(ev.rows)||(ev.type==='vm')!==(type==='vm'))continue;
    award(type,ev.label,ev.date,ev.rows.map(r=>({rank:r.rank,name:r.team,players:(r.players||[]).filter(Boolean)})),true);
  }};
  skmrEvents('cupFinal');
  // 2. Montags Solo – aktuelle und ausgewählte frühere Ausgaben
  const msEditions=[];
  if(src.ms&&cfg.msCurrent)msEditions.push({title:src.ms.title||'Montags Solo',rounds:src.ms.rounds||{},finale:src.ms.finale||{}});
  for(const a of (src.ms&&src.ms.archive)||[])if(cfg.msArchive[a.id||a.date])msEditions.push({title:a.title,rounds:a.rounds||{},finale:{date:a.date,result:{rows:a.finale||[]}}});
  for(const e of msEditions){
    ['v1','v2','v3'].forEach((k,i)=>{const r=e.rounds[k];const rows=r&&r.result&&r.result.rows;if(rows&&rows.length)award('msRound',clean(e.title)+' · Vorrunde '+(i+1),r.date,rows.map(x=>({rank:x.rank,name:x.name})),false);});
    const fr=e.finale&&e.finale.result&&e.finale.result.rows;
    if(fr&&fr.length)award('msFinal',clean(e.title)+' · Finale',e.finale.date,fr.map(x=>({rank:x.rank,name:x.name})),false);
  }
  // 3. Solo Pyramide – Platz in der Pyramide + jedes gespielte Spiel
  if(cfg.pyramid&&src.pyr){
    const list=(src.pyr.players||[]).filter(p=>typeof p==='string'&&clean(p)&&p!=='FREI');
    award('pyramid','Solo Pyramide · Platz','',list.map((p,i)=>({rank:i+1,name:p})),false);
    const games=new Map();
    for(const line of src.pyr.hist||[]){
      const m=String(line).match(/^(.*?)\s+-\s+(.+?)\s+besiegte\s+(.+?)\s+(\d+):(\d+)\s*$/);if(!m)continue;
      for(const [nm,won] of [[m[2],true],[m[3],false]]){const who=ros.get(key(nm));if(!who){unknown.add(nm);continue;}const g=games.get(who)||{w:0,l:0};won?g.w++:g.l++;games.set(who,g);}
    }
    for(const [who,g] of games)add(who,{type:'pyramidGames',label:'Solo Pyramide · Spiele',date:'',won:g.w,lost:g.l,points:g.w*PYR_WIN+g.l*PYR_LOSS});
  }
  // 4. Ziel-Jahresmeisterschaft (Summe der Durchgänge minus schwächster)
  if(cfg.jm&&src.jm&&Array.isArray(src.jm.players)){
    const rows=src.jm.players.map(p=>{
      const vals=Array.from({length:6},(_,i)=>{const r=p&&p.r&&p.r[i];const s=Array.isArray(r)?r:(r&&r.__ecwNestedArrayV1);return Array.isArray(s)&&s.every(Number.isFinite)?s.reduce((a,b)=>a+b,0):null;});
      const played=vals.filter(v=>v!==null).length,v=vals.map(x=>x??0),total=v.reduce((a,b)=>a+b,0);
      return {name:clean(p&&p.n),result:total-Math.min(...v),played};
    }).filter(r=>r.name&&r.played>0).sort((a,b)=>b.result-a.result);
    ranks(rows,r=>r.result);
    award('jm',clean(src.jm.title)||'Ziel-Jahresmeisterschaft','',rows,false);
  }
  // 5. Vereinsmeisterschaft – letztes Event der Saison
  skmrEvents('vm');
  const list=[...people.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'de'));
  ranks(list,r=>r.total);
  return {rows:list,unknown:[...unknown].sort((a,b)=>a.localeCompare(b,'de'))};
}

/* ---------- Speichern ---------- */
async function saveConfig(extra){
  if(!isAdmin())return toast('Nur Administratoren dürfen die Rangliste bearbeiten.');
  const payload={visible:!!cfg.visible,config:{visible:!!cfg.visible,season:cfg.season,cups:cfg.cups,msCurrent:cfg.msCurrent,msArchive:cfg.msArchive,pyramid:cfg.pyramid,jm:cfg.jm,events:cfg.events},archive:cfg.archive,...(extra||{})};
  await db().collection(DOC[0]).doc(DOC[1]).set(JSON.parse(JSON.stringify(payload)),{merge:true});
}
async function publish(){
  if(busy)return;busy=true;msg='Wird berechnet …';render();
  try{
    const r=compute();
    const rows=r.rows.map(p=>({rank:p.rank,name:p.name,total:p.total,parts:p.parts}));
    result={rows,updatedAt:new Date().toISOString()};
    await saveConfig({season:cfg.season,rows,updatedAt:result.updatedAt});
    msg='Rangliste berechnet: '+rows.length+' Spieler'+(cfg.visible?' · am Smartphone sichtbar':' · am Smartphone ausgeblendet')+(r.unknown.length?' · nicht in der Spielerliste und daher nicht gewertet: '+r.unknown.join(', '):'')+'.';
  }catch(e){msg='Fehler: '+(e.code||e.message);}
  finally{busy=false;render();}
}

/* ---------- StockTV-Ergebnis einlesen ---------- */
async function importSkmr(file,type){
  if(!window.ECWMontagsSolo||!ECWMontagsSolo.parseSkmr)throw Error('StockTV-Leser nicht geladen.');
  const res=ECWMontagsSolo.parseSkmr(await file.text());
  if(res.played<res.total&&!confirm('In der Datei sind erst '+res.played+' von '+res.total+' Spielen eingetragen. Trotzdem übernehmen?'))return;
  const ros=roster();
  const label=prompt('Bezeichnung für die Rangliste:',type==='vm'?'Vereinsmeisterschaft '+cfg.season:(res.title||'Cup-Abschlussturnier'));
  if(label===null)return;
  const date=prompt('Datum (TT.MM.JJJJ):',new Date().toLocaleDateString('de-DE'))||'';
  const dm=date.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  cfg.events.push({id:'ev_'+Date.now(),type,label:clean(label)||LABEL[type],date:dm?dm[3]+'-'+dm[2].padStart(2,'0')+'-'+dm[1].padStart(2,'0'):'',filename:file.name,
    rows:res.rows.map(r=>({rank:r.rank,team:r.name,players:playersIn(r.name,ros)}))});
  await saveConfig();
  msg='„'+file.name+'“ eingelesen. Bitte bei jeder Mannschaft die Spieler prüfen und danach „Rangliste berechnen“.';
}

/* ---------- Drucken ---------- */
function printList(){
  if(!result||!result.rows.length)return toast('Noch keine Rangliste berechnet.');
  const rows=result.rows.map(r=>'<tr><td>'+r.rank+'.</td><td>'+esc(r.name)+'</td><td class="r">'+r.total+'</td><td class="s">'+esc(summary(r))+'</td></tr>').join('');
  const w=window.open('','_blank');if(!w)return toast('Bitte Pop-ups erlauben.');
  w.document.write('<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Vereinsrangliste</title><style>body{font:12px Arial;margin:14mm}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #999;padding:5px 6px;text-align:left}.r{text-align:right;font-weight:bold}.s{font-size:10px;color:#444}</style></head><body><h1>Vereinsrangliste '+esc(cfg.season)+'</h1><p>Stand '+new Date(result.updatedAt).toLocaleDateString('de-DE')+'</p><table><thead><tr><th>Pl.</th><th>Name</th><th class="r">Punkte</th><th>Zusammensetzung</th></tr></thead><tbody>'+rows+'</tbody></table><script>onload=()=>print()<\/script></body></html>');
  w.document.close();
}
function summary(r){
  const by={};for(const p of r.parts){const k=p.type==='pyramidGames'?'pyramid':p.type;by[k]=(by[k]||0)+p.points;}
  return Object.entries(by).map(([k,v])=>(LABEL[k]||k).replace(' · Gruppenphase','')+' '+v).join(' · ');
}

/* ---------- Anzeige ---------- */
function css(){
  if(document.getElementById('rlCss'))return;
  const s=document.createElement('style');s.id='rlCss';
  s.textContent='.rl-table{width:100%;border-collapse:collapse}.rl-table th,.rl-table td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.14);text-align:left;vertical-align:top}.rl-table td.r,.rl-table th.r{text-align:right}'
   +'.rl-table details summary{cursor:pointer}.rl-parts{font-size:.85rem;opacity:.9;margin:4px 0 0;padding-left:18px}.rl-src label{display:flex;gap:8px;align-items:center;margin:4px 0}.rl-src input[type=checkbox]{width:auto!important;margin:0!important}'
   +'.rl-ev{border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:8px 10px;margin:8px 0}.rl-ev table{width:100%;border-collapse:collapse}.rl-ev td{padding:3px 6px;border-bottom:1px solid rgba(255,255,255,.08)}.rl-ev input{margin:0!important}'
   +'.rl-file{display:inline-flex!important;align-items:center;gap:6px;padding:8px 12px;border:1px solid rgba(255,255,255,.3);border-radius:8px;cursor:pointer;margin:0!important}.rl-file input{display:none}.rl-points td{padding:3px 8px}';
  document.head.appendChild(s);
}
function render(){
  const root=document.getElementById('rlRoot');if(!root)return;
  if(!cfg){root.innerHTML='<div class="card">'+esc(msg||'Wird geladen …')+'</div>';return;}
  const cupRows=Object.entries(src.cups||{}).filter(([,t])=>t&&typeof t==='object').map(([id,t])=>'<label><input type="checkbox" data-rl-cup="'+esc(id)+'"'+(cfg.cups[id]?' checked':'')+'> '+esc(t.name||id)+'</label>').join('')||'<div class="small">Keine Cups gespeichert.</div>';
  const msArch=((src.ms&&src.ms.archive)||[]).map(a=>'<label><input type="checkbox" data-rl-msarch="'+esc(a.id||a.date)+'"'+(cfg.msArchive[a.id||a.date]?' checked':'')+'> '+esc(a.title)+' · Finale '+deDate(a.date)+(a.rounds?'':' (nur Finale gespeichert)')+'</label>').join('');
  const ros=roster();
  const evHtml=cfg.events.map((ev,i)=>'<div class="rl-ev"><div class="row" style="justify-content:space-between;align-items:center"><b>'+esc(ev.label)+'</b><span class="small">'+LABEL[ev.type==='vm'?'vm':'cupFinal']+(ev.date?' · '+deDate(ev.date):'')+'</span><button type="button" data-rl-evdel="'+i+'">Entfernen</button></div>'
    +'<table>'+ev.rows.map((r,j)=>{const ok=(r.players||[]).length&&r.players.every(p=>ros.has(key(p)));return '<tr><td>'+r.rank+'.</td><td>'+esc(r.team)+'</td><td><input type="text" data-rl-evp="'+i+'" data-j="'+j+'" value="'+esc((r.players||[]).join(' / '))+'" placeholder="Spieler mit / trennen" style="'+(ok?'':'border-color:#ff9d9d')+'"></td></tr>';}).join('')+'</table></div>').join('');
  const pts='<table class="rl-points">'+Object.entries(MAX).map(([k,v])=>'<tr><td>'+LABEL[k]+'</td><td class="r"><b>'+v+'</b></td></tr>').join('')+'<tr><td>Solo Pyramide · je gewonnenes / verlorenes Spiel</td><td class="r"><b>'+PYR_WIN+' / '+PYR_LOSS+'</b></td></tr></table>'
    +'<div class="small">Sieger 100 %, Letzter 10 % der Höchstpunkte, dazwischen gleichmäßig abgestuft. Bei Mannschaften bekommt jeder Spieler die Punkte der Mannschaft. Gezählt werden nur Spieler aus der Spielerliste.</div>';
  const table=result&&result.rows.length?'<table class="rl-table"><thead><tr><th>Pl.</th><th>Spieler</th><th class="r">Punkte</th></tr></thead><tbody>'
    +result.rows.map(r=>'<tr><td>'+r.rank+'.</td><td><details><summary>'+esc(r.name)+'</summary><ul class="rl-parts">'+r.parts.map(p=>'<li>'+esc(p.label)+(p.type==='pyramidGames'?': '+p.won+' Siege, '+p.lost+' Niederlagen':': Platz '+p.place+' von '+p.of)+' → <b>'+p.points+'</b></li>').join('')+'</ul></details></td><td class="r"><b>'+r.total+'</b></td></tr>').join('')+'</tbody></table>'
    +'<div class="small">Stand '+new Date(result.updatedAt).toLocaleString('de-DE')+'</div>':'<div class="small">Noch keine Rangliste berechnet.</div>';
  root.innerHTML='<div class="card"><div class="row" style="gap:10px;align-items:end;flex-wrap:wrap"><label>Saison<input type="text" data-rl-season value="'+esc(cfg.season)+'" style="width:120px"></label>'
    +'<button type="button" class="primary" data-rl-publish'+(busy?' disabled':'')+'>Rangliste berechnen</button><button type="button" data-rl-print>Drucken</button><button type="button" data-rl-close>Saison abschließen</button></div>'
    +'<label class="rl-vis" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" data-rl-visible'+(cfg.visible?' checked':'')+' style="width:auto;margin:0"> <b>Am Smartphone in „Meine Ergebnisse“ anzeigen</b></label>'
    +'<div class="small">'+(cfg.visible?'Die Spieler sehen ihren Platz und ihre Punkte.':'Ausgeblendet: Die Rangliste wird nur hier intern berechnet, die Spieler sehen sie nicht.')+'</div>'
    +(msg?'<div class="small" style="margin-top:8px">'+esc(msg)+'</div>':'')+'</div>'
    +'<div class="card"><h3 style="margin-top:0">Rangliste '+esc(cfg.season)+'</h3>'+table+'</div>'
    +'<div class="card rl-src"><h3 style="margin-top:0">Wettbewerbe dieser Saison</h3>'
    +'<div class="small">Reihenfolge: Frauencup und Duo Cup → Montags Solo → Solo Pyramide → Ziel-Jahresmeisterschaft → Vereinsmeisterschaft (Saisonende)</div>'
    +'<h4>1. Cups (Gruppenphase)</h4>'+cupRows
    +'<h4>Cup-Abschlussturniere (StockTV-Ergebnis)</h4><label class="rl-file">Abschlussturnier (.skmr) einlesen<input type="file" accept=".skmr,.xml" data-rl-import="cupFinal"></label>'
    +'<h4>2. Montags Solo</h4><label><input type="checkbox" data-rl-ms'+(cfg.msCurrent?' checked':'')+'> Aktuelles Montags Solo'+(src.ms?' ('+esc(src.ms.title||'')+')':' – noch keines angelegt')+'</label>'+msArch
    +'<h4>3. Solo Pyramide</h4><label><input type="checkbox" data-rl-pyr'+(cfg.pyramid?' checked':'')+'> Platz in der Pyramide und alle gespielten Spiele</label>'
    +'<h4>4. Ziel-Jahresmeisterschaft</h4><label><input type="checkbox" data-rl-jm'+(cfg.jm?' checked':'')+'> '+esc((src.jm&&src.jm.title)||'Ziel-Jahresmeisterschaft')+'</label>'
    +'<h4>5. Vereinsmeisterschaft (StockTV-Ergebnis)</h4><label class="rl-file">Vereinsmeisterschaft (.skmr) einlesen<input type="file" accept=".skmr,.xml" data-rl-import="vm"></label>'
    +(cfg.events.length?'<h4>Eingelesene Ergebnisse</h4><div class="small">Spieler werden aus dem Mannschaftsnamen erkannt. Rot = bitte prüfen; Namen wie in der Spielerliste, mit / getrennt.</div>'+evHtml:'')
    +'</div><div class="card"><h3 style="margin-top:0">Punkteverteilung</h3>'+pts+'</div>'
    +(cfg.archive.length?'<div class="card"><h3 style="margin-top:0">Frühere Saisonen</h3>'+cfg.archive.map(a=>'<div class="small">'+esc(a.season)+': '+((a.rows||[]).slice(0,3).map(r=>r.rank+'. '+esc(r.name)+' ('+r.total+')').join(' · '))+'</div>').join('')+'</div>':'');
}
async function onChange(e){
  const t=e.target,d=t.dataset;if(!cfg)return;
  try{
    if('rlVisible' in d){
      if(t.checked&&!confirm('Rangliste jetzt für alle Spieler am Smartphone anzeigen?')){t.checked=false;return;}
      cfg.visible=t.checked;await saveConfig();msg=cfg.visible?'Rangliste ist am Smartphone sichtbar.':'Rangliste am Smartphone ausgeblendet.';
    }
    else if('rlCup' in d){cfg.cups[d.rlCup]=t.checked;await saveConfig();}
    else if('rlMs' in d){cfg.msCurrent=t.checked;await saveConfig();}
    else if('rlMsarch' in d){cfg.msArchive[d.rlMsarch]=t.checked;await saveConfig();}
    else if('rlPyr' in d){cfg.pyramid=t.checked;await saveConfig();}
    else if('rlJm' in d){cfg.jm=t.checked;await saveConfig();}
    else if('rlSeason' in d){cfg.season=clean(t.value);await saveConfig();}
    else if('rlEvp' in d){const r=cfg.events[+d.rlEvp].rows[+d.j];r.players=t.value.split('/').map(clean).filter(Boolean).map(n=>roster().get(key(n))||n);await saveConfig();render();return;}
    else if('rlImport' in d){const f=t.files&&t.files[0];t.value='';if(f)await importSkmr(f,d.rlImport);}
    else return;
    render();
  }catch(err){toast(err.message||String(err),7000);}
}
async function onClick(e){
  const b=e.target.closest('button');if(!b||!cfg)return;const d=b.dataset;
  try{
    if('rlPublish' in d)await publish();
    else if('rlPrint' in d)printList();
    else if('rlEvdel' in d){const ev=cfg.events[+d.rlEvdel];if(ev&&confirm('„'+ev.label+'“ aus der Rangliste entfernen?')){cfg.events.splice(+d.rlEvdel,1);await saveConfig();render();}}
    else if('rlClose' in d){
      if(!result||!result.rows.length)return toast('Bitte zuerst die Rangliste berechnen.');
      if(!confirm('Saison '+cfg.season+' abschließen? Die Rangliste wird archiviert, eingelesene StockTV-Ergebnisse und die Auswahl werden für die neue Saison geleert.'))return;
      cfg.archive=[{season:cfg.season,closedAt:new Date().toISOString(),rows:result.rows.map(r=>({rank:r.rank,name:r.name,total:r.total}))},...cfg.archive].slice(0,15);
      const y=Number(String(cfg.season).slice(0,4))||new Date().getFullYear();
      cfg.season=(y+1)+'/'+String(y+2).slice(2);cfg.cups={};cfg.msArchive={};cfg.events=[];result=null;
      await saveConfig({season:cfg.season,rows:[],updatedAt:new Date().toISOString()});
      msg='Saison archiviert. Neue Saison '+cfg.season+'.';render();
    }
  }catch(err){toast(err.message||String(err),7000);}
}
async function open(){
  if(!isAdmin())return toast('Die Vereinsrangliste ist nur für Administratoren.');
  const a=document.getElementById('adminMain');if(!a)return;
  css();
  a.innerHTML='<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px"><h2 style="margin:0">Vereinsrangliste</h2><button type="button" onclick="adminSection(\'ic\')">← Zurück zu Interne Cups</button></div><div id="rlRoot"></div>';
  const root=a.querySelector('#rlRoot');root.addEventListener('change',onChange);root.addEventListener('click',onClick);
  cfg=null;msg='';render();
  try{await loadSources();}catch(e){msg='Laden fehlgeschlagen: '+(e.code||e.message);}
  render();
}
window.ECWRangliste={open,placePoints,playersIn,_test:{compute,setSources:(s,c)=>{src=s;cfg=Object.assign({season:'2026/27',cups:{},msCurrent:true,msArchive:{},pyramid:true,jm:true,events:[],archive:[]},c||{});}}};
})();
