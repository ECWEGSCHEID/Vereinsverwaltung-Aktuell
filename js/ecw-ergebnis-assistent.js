/* EC Wegscheid – Ergebnis-Assistent.
   Ein Ablauf für alle Wettkämpfe (intern und extern):
   1. Wettkampf wählen (aus dem Terminplaner oder frei)  2. Ergebnisliste einfügen (.skmr, PDF, Bild)
   3. Erkannte Platzierungen prüfen/korrigieren          4. Speichern:
      – Homepage-Ergebnisse: Original (PDF/Bild) + PNG-Ansicht im passenden Ordner, gesamte Liste als Text
      – Terminplaner: Platz X von Y der EC-Wegscheid-Mannschaft(en)
      – Vereinsrangliste (nur interne Wettbewerbe)
   Gespeichert wird wie bei den Homepage-Ergebnissen in Firebase (ergebnisdateien/…). */
(function(){
'use strict';
const BLOCK=360000,MAX_BYTES=8*1024*1024,OWN=/wegscheid/i;
let st=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const toast=(m,t)=>{if(typeof showToast==='function')showToast(m,t||5000);};
const $=id=>document.getElementById(id);
const isAdmin=()=>typeof appPermissions!=='undefined'&&appPermissions.admin===true;
const deDate=iso=>{const p=String(iso||'').slice(0,10).split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0]:''};
// Saison läuft von Dezember bis November (Vereinsmeisterschaft im November ist das letzte Event).
function seasonOf(iso){const d=new Date((iso||'')+'T12:00:00');if(isNaN(d))return '';const y=d.getFullYear();return d.getMonth()>=11?y+'/'+String(y+1).slice(2):(y-1)+'/'+String(y).slice(2);}
function guessCategory(name){const n=String(name||'').toLowerCase();
  if(/montag/.test(n))return 'Montags Solo';if(/solo\s*cup/.test(n))return 'Solo Cup';if(/pyramide/.test(n))return /frauen|damen/.test(n)?'Frauen Solo Pyramide':'Solo Pyramide';
  if(/duo/.test(n))return 'Duo Cup';if(/frauen|damen/.test(n))return 'Frauencup';if(/vereinsmeister/.test(n))return 'Vereinsmeisterschaft';if(/ziel/.test(n))return 'Ziel-JM';return '';}
function guessType(cat,name){const n=String(name||'').toLowerCase();const fin=/finale|endrunde|endergebnis|abschluss/.test(n);
  if(cat==='Montags Solo'||cat==='Solo Cup')return fin?'soloFinal':'round';if(cat==='Duo Cup'||cat==='Frauencup')return fin?'final':'group';
  return {'Solo Pyramide':'pyramid','Frauen Solo Pyramide':'pyramid','Ziel-JM':'jm','Vereinsmeisterschaft':'vm'}[cat]||'group';}

/* ---------- Dateien lesen ---------- */
function readBase64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=()=>rej(Error('Datei konnte nicht gelesen werden.'));r.onload=()=>res(String(r.result).split(',')[1]||'');r.readAsDataURL(blob);});}
async function pdfDoc(file){
  if(typeof loadPdfJs==='function')await loadPdfJs();
  if(!window.pdfjsLib)throw Error('PDF-Programm konnte nicht geladen werden (Internetverbindung prüfen).');
  return window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
}
// Text eines PDFs zeilenweise (Textstücke nach Höhe gruppiert)
async function pdfLines(doc){
  const lines=[];
  for(let p=1;p<=doc.numPages;p++){
    const page=await doc.getPage(p),tc=await page.getTextContent(),rows=new Map();
    for(const it of tc.items){if(!clean(it.str))continue;const y=Math.round(it.transform[5]/3)*3;if(!rows.has(y))rows.set(y,[]);rows.get(y).push({x:it.transform[4],s:it.str});}
    [...rows.entries()].sort((a,b)=>b[0]-a[0]).forEach(([,items])=>{items.sort((a,b)=>a.x-b.x);let out='',lastX=null;
      for(const i of items){out+=(lastX!==null&&i.x-lastX>12?'   ':' ')+i.s;lastX=i.x+i.s.length*4;}lines.push(out.replace(/^\s+/,''));});
  }
  return lines;
}
async function pdfToPngs(doc,maxPages=4){
  const out=[];
  for(let p=1;p<=Math.min(doc.numPages,maxPages);p++){
    const page=await doc.getPage(p),vp=page.getViewport({scale:2});
    const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
    const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
    await page.render({canvasContext:ctx,viewport:vp}).promise;
    out.push(await new Promise(r=>c.toBlob(r,'image/png')));
  }
  return out;
}
// Platzierungen aus Textzeilen (StockApp-Ergebnis, Duo-Cup-Listen, „1. Name“ …)
function parseLines(lines){
  const rows=[];let last=null;const skip=/^(platz|rang|gruppe|spiele|punkte|ergebnis|datum|austragungsort|veranstalter|created|wir bedanken|der ec)/i;
  for(const raw of lines){
    const line=String(raw).replace(/ /g,' ').trim();if(!line)continue;
    const m=line.match(/^(\d{1,3})\s*\.?\s*(?:Platz\s+)?([A-Za-zÄÖÜäöüß].*?)(?=\s{2,}|\s+[+-]?\d+\s*[:,+-]|\s+[+-]\s*\d|\s+\d+\s+[+-]|\s*$)/);
    if(m&&!skip.test(m[2])&&Number(m[1])<=200){
      const name=clean(m[2]).replace(/\s+(Gruppe|Punkte)$/i,'');
      if(name.length>=2){last={rank:Number(m[1]),team:name,players:[]};rows.push(last);continue;}
    }
    // Spielerzeile unter einer Mannschaft (z. B. Vereinsmeisterschaft: „Name, Name, Name, Name“)
    if(last&&!last.players.length&&/^[A-Za-zÄÖÜäöüß .'-]+(,\s*[A-Za-zÄÖÜäöüß .'-]+){1,5}$/.test(line))last.players=line.split(',').map(clean).filter(Boolean);
  }
  // doppelte Ränge aus Kopf-/Fußzeilen entfernen: nur die erste zusammenhängende Liste ab Platz 1
  const start=rows.findIndex(r=>r.rank===1);if(start<0)return rows;
  const out=[rows[start]];
  for(let i=start+1;i<rows.length;i++){const r=rows[i];if(r.rank<out[out.length-1].rank||r.rank===1)break;out.push(r);}
  return out;
}
// Spieler einer StockTV-Mannschaft: nur die innersten <Spieler>-Einträge, Vor- und Nachname zusammen
function skmrPlayers(m){
  const all=[...m.getElementsByTagName('Spieler')].filter(s=>!s.getElementsByTagName('Spieler').length);
  const names=[];
  for(const sp of all){
    const kids=[...sp.children];if(!kids.length){const t=clean(sp.textContent);if(t)names.push(t);continue;}
    const get=re=>clean(kids.find(c=>re.test(c.tagName))?.textContent);
    const vn=get(/^(vor|first|given)/i),nn=get(/^(nach|zu|last|sur|family)/i);
    const n=nn||vn?clean(nn+' '+vn):clean(kids.map(c=>c.textContent).join(' '));
    if(n&&!names.includes(n))names.push(n);
  }
  return names;
}
function parseSkmrFile(text){
  if(!window.ECWMontagsSolo?.parseSkmr)throw Error('StockTV-Leser nicht geladen.');
  const res=ECWMontagsSolo.parseSkmr(text);
  const xml=new DOMParser().parseFromString(text,'application/xml');
  const players=new Map([...xml.getElementsByTagName('Mannschaft')].map(m=>[clean(m.getElementsByTagName('TeamName')[0]?.textContent),
    skmrPlayers(m)]));
  const date=(text.match(/<DateOfTournament>(\d{4}-\d{2}-\d{2})/)||[])[1]||'';
  return {title:res.title,date,played:res.played,total:res.total,rows:res.rows.map(r=>({rank:r.rank,team:r.name,players:players.get(clean(r.name))||[],info:r.points+':'+r.minus+' · '+(r.diff>0?'+':'')+r.diff}))};
}
// Ergebnisliste als Bild (für StockTV-Dateien und eingetippte Listen)
async function tablePng(title,sub,rows){
  const W=1240,rowH=46,top=230,H=top+rows.length*rowH+120;
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#8b0000';x.fillRect(0,0,W,12);
  x.fillStyle='#111';x.font='bold 46px Arial';x.textAlign='center';x.fillText(title,W/2,100);x.font='28px Arial';x.fillStyle='#444';x.fillText(sub,W/2,150);
  x.textAlign='left';x.font='bold 24px Arial';x.fillStyle='#8b0000';x.fillText('Platz',80,205);x.fillText('Mannschaft / Spieler',200,205);
  rows.forEach((r,i)=>{const y=top+i*rowH+32;if(i%2){x.fillStyle='#f3f3f3';x.fillRect(60,y-32,W-120,rowH);}x.fillStyle='#111';x.font='bold 26px Arial';x.fillText(r.rank+'.',80,y);
    x.font='26px Arial';let t=r.team+(r.players?.length&&r.players.join(', ')!==r.team?' – '+r.players.join(', '):'');while(x.measureText(t).width>W-280&&t.length>10)t=t.slice(0,-2);x.fillText(t,200,y);});
  x.font='20px Arial';x.fillStyle='#666';x.fillText('EC Wegscheid · erstellt '+new Date().toLocaleDateString('de-DE'),80,H-40);
  return new Promise(r=>c.toBlob(r,'image/png'));
}

async function imageToPdf(blob){
  const url=URL.createObjectURL(blob);const img=new Image();img.src=url;await img.decode();URL.revokeObjectURL(url);
  const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0);
  const bin=atob(c.toDataURL('image/jpeg',0.92).split(',')[1]);const jpg=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)jpg[i]=bin.charCodeAt(i);
  const pw=595.32,ph=841.92,sc=Math.min(pw/c.width,ph/c.height),w=c.width*sc,h=c.height*sc,ox=(pw-w)/2,oy=ph-h-(ph-h)/2;
  const enc=new TextEncoder(),chunks=[],off=[0];let len=0;const put=v=>{const b=typeof v==='string'?enc.encode(v):v;chunks.push(b);len+=b.length;};const obj=(id,b)=>{off[id]=len;put(id+' 0 obj\n'+b+'\nendobj\n');};
  put('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pw+' '+ph+'] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  off[4]=len;put('4 0 obj\n<< /Type /XObject /Subtype /Image /Width '+c.width+' /Height '+c.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n');put(jpg);put('\nendstream\nendobj\n');
  const content='q '+w.toFixed(2)+' 0 0 '+h.toFixed(2)+' '+ox.toFixed(2)+' '+oy.toFixed(2)+' cm /Im0 Do Q\n';obj(5,'<< /Length '+enc.encode(content).length+' >>\nstream\n'+content+'endstream');
  const xref=len;put('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)put(String(off[i]).padStart(10,'0')+' 00000 n \n');put('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
  return new Blob(chunks,{type:'application/pdf'});
}
async function toPng(blob){const url=URL.createObjectURL(blob);const img=new Image();img.src=url;await img.decode();URL.revokeObjectURL(url);const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);return new Promise(r=>c.toBlob(r,'image/png'));}
/* ---------- Homepage-Ergebnisse (gleicher Speicher wie das Ergebnis-Archiv) ---------- */
function resultsRoot(){return (typeof SH!=='undefined'&&SH.results)||(window.ecwResults?.normalize?(SH.results=ecwResults.normalize()):null);}
function folders(){
  const out=[];const walk=(n,trail,ids)=>{for(const c of n.children||[]){const t=[...trail,c.t],i=[...ids,c.id];out.push({path:i,label:t.join(' / '),node:c});walk(c,t,i);}};
  const r=resultsRoot();if(r)walk(r,[],[]);return out;
}
function guessFolder(name,date){
  const list=folders(),year=String(date||'').slice(0,4),words=String(name||'').toLowerCase().split(/[^a-zäöüß0-9]+/).filter(w=>w.length>2&&!/^\d+$/.test(w));
  let best=null,score=0;
  for(const f of list){const l=f.label.toLowerCase();let s=words.filter(w=>l.includes(w)).length*2;if(year&&l.endsWith(year))s+=3;if(s>score){score=s;best=f;}}
  return best;
}
async function storeResultFile(blob,name){
  const data=await readBase64(blob);const mime=window.ecwResults?.detectMime?ecwResults.detectMime(data):blob.type;
  if(blob.size>MAX_BYTES)throw Error(name+': größer als 8 MB.');
  const f={id:'result-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),parts:Math.ceil(data.length/BLOCK),mime,size:blob.size,name};
  for(let p=0;p<f.parts;p++)await firestoreDb.collection('ergebnisdateien').doc(f.id).collection('blocks').doc(String(p)).set({data:data.slice(p*BLOCK,(p+1)*BLOCK),createdAt:new Date().toISOString()});
  return f;
}
function folderNode(pathIds,newChild){
  let n=resultsRoot();for(const id of pathIds){n=(n.children||[]).find(c=>c.id===id);if(!n)throw Error('Ergebnis-Ordner nicht gefunden.');}
  if(newChild){let c=(n.children||[]).find(x=>x.t===newChild);if(!c){c={id:'result-'+Date.now().toString(36),t:newChild,u:'',body:'',links:[],children:[]};(n.children=n.children||[]).push(c);}n=c;}
  n.links=n.links||[];return n;
}
function odReady(){return !!(st.od&&(st.od.local||st.od.configured));}
function odRootName(){return st.od?.local?(st.od.folder||'ECWegscheid'):(window.ECWOneDrive?.config?.root||'ECWegscheid');}
function odPath(){const parts=folderLabel().split(' / ').filter(x=>x&&x!=='…');return [(st.kind2==='intern'||st.kind2==='veranstalter')?'Turniere':'Ergebnisse',...parts].join('/');}
function folderLabel(){const f=folders().find(x=>x.path.join('>')===st?.folder);return [f?f.label:'',st?.subfolder||''].filter(Boolean).join(' / ')||'…';}
// Spielernamen mit der Spielerliste abgleichen (nur für die Vereinsrangliste nötig)
function rowPlayers(r){return (r.players&&r.players.length)?r.players:(window.ECWRangliste?.resolvePlayers?.(r.team)||[r.team]);}
function nameIssues(){
  if(!(st.internal&&st.toRanking)||!window.ECWRangliste?.matchName)return [];
  const seen=new Set(),out=[];
  st.rows.filter(r=>clean(r.team)).forEach(r=>rowPlayers(r).map(clean).filter(Boolean).forEach(n=>{
    if(seen.has(n))return;seen.add(n);const m=ECWRangliste.matchName(n);if(!m.ok)out.push({raw:n,suggest:m.suggest});}));
  return out;
}
function namesHtml(){
  const list=nameIssues();if(!list.length)return '';
  st.nameMap=st.nameMap||{};
  const all=ECWRangliste.rosterNames?.()||[];
  return '<div class="card"><h3 style="margin-top:0">Namen prüfen (Spielerliste)</h3><div class="small" style="margin-bottom:6px">Diese Namen stehen nicht genau so in der Spielerliste. Vorschläge sind schon ausgewählt – bitte prüfen. Ohne Zuordnung kann nicht gespeichert werden.</div>'
    +list.map(x=>{if(st.nameMap[x.raw]===undefined&&x.suggest[0])st.nameMap[x.raw]=x.suggest[0];const cur=st.nameMap[x.raw]||'';
      return '<div class="ea-row" style="align-items:center;margin:4px 0"><span style="min-width:170px;color:'+(cur?'#ffd27f':'#ff9b9b')+'"><b>'+esc(x.raw)+'</b>'+(cur?'':' – unbekannt')+'</span><select data-ea-namefix="'+esc(x.raw)+'"><option value="">– Spieler wählen –</option>'
        +(x.suggest.length?'<optgroup label="Vorschläge">'+x.suggest.map(n=>'<option'+(n===cur?' selected':'')+'>'+esc(n)+'</option>').join('')+'</optgroup>':'')
        +'<optgroup label="Spielerliste">'+all.map(n=>'<option'+(n===cur&&!x.suggest.includes(n)?' selected':'')+'>'+esc(n)+'</option>').join('')+'</optgroup></select></div>';}).join('')+'</div>';
}
function listText(rows){return rows.map(r=>r.rank+'. '+r.team+(r.players?.length&&r.players.join(', ')!==r.team?' ('+r.players.join(', ')+')':'')).join('\n');}

/* ---------- Ablauf ---------- */
function plannerEvents(){
  const all=(typeof data!=='undefined'&&data.tournamentPlanner||[]).filter(x=>x&&x.date&&x.name);
  const today=new Date().toISOString().slice(0,10);
  return all.filter(x=>x.date<=today).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,80);
}
const KINDS={intern:'Interner Wettbewerb',veranstalter:'Turnier als Veranstalter',meisterschaft:'Meisterschaft',extern:'Externes Turnier'};
function kindOf(x){const t=String(x?.type||'').toLowerCase();
  if(x?.internal===true||/intern/.test(t))return 'intern';if(/ausrichter|veranstalter/.test(t))return 'veranstalter';
  if(/meisterschaft/.test(t)||(typeof tpIsChampionshipEvent==='function'&&tpIsChampionshipEvent(x)))return 'meisterschaft';return 'extern';}
const manualAllowed=()=>st.kind2==='extern'||st.kind2==='veranstalter';
function applyKind(){if(!manualAllowed())st.manual=false;st.internal=st.kind2==='intern';st.toRanking=st.internal;st.toPlanner=!!st.eventId&&st.kind2!=='intern';}
function filesHtml(){
  const fl=st.files.map((f,i)=>'<div class="ea-filerow">'+(f.previewUrl?'<img src="'+f.previewUrl+'" alt="">':'<span class="ea-fileicon">'+(f.kind==='skmr'?'SKMR':'PDF')+'</span>')
    +'<div style="flex:1;min-width:0"><b>'+esc(f.name)+'</b>'+(i===st.rowsFrom?' <span class="small" style="color:#7fd17f">· Platzierungen daraus übernommen</span>':'')+'<div class="small">'+esc(f.note||'')+'</div></div><button type="button" data-ea-fdel="'+i+'" title="Entfernen">✕</button></div>').join('');
  const ph=st.photos.map((f,i)=>'<div class="ea-thumb"><img src="'+f.previewUrl+'" alt=""><button type="button" data-ea-pdel="'+i+'" title="Entfernen">✕</button></div>').join('');
  return '<div class="ea-row"><label class="ea-file">'+(st.files.length?'+ Weitere Ergebnisliste':'Ergebnisliste wählen (StockTV .skmr, PDF oder Bild)')+'<input id="eaFile" type="file" multiple accept=".skmr,.xml,application/pdf,image/*"></label>'
    +'<label class="ea-file">📷 Fotos hinzufügen<input id="eaPhotos" type="file" multiple accept="image/*"></label></div>'
    +(fl?'<div style="margin-top:8px">'+fl+'</div>':'')+(ph?'<div class="small" style="margin-top:8px">Fotos ('+st.photos.length+')</div><div class="ea-thumbs">'+ph+'</div>':'')
    +(st.files.length>1?'<div class="small" style="margin-top:6px">Die Platzierungen (Schritt 3) kommen aus einer Liste. Andere Liste verwenden: <select id="eaRowsFrom">'+st.files.map((f,i)=>'<option value="'+i+'"'+(i===st.rowsFrom?' selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></div>':'');
}
function manualHtml(){
  return '<div class="ea-grid"><label>Platz<input id="eaMPlatz" type="number" min="1" inputmode="numeric" value="'+esc(st.mPlatz||'')+'"></label><label>von (Teilnehmer)<input id="eaMVon" type="number" min="1" inputmode="numeric" value="'+esc(st.mVon||'')+'"></label><label>Notiz (optional)<input id="eaMNotiz" type="text" maxlength="200" value="'+esc(st.mNotiz||'')+'"></label></div>'
    +(st.eventId?'':'<div class="small" style="margin-top:6px;color:#ffb3b3">Für die manuelle Eingabe bitte oben den Termin aus dem Terminplaner wählen.</div>')
    +'<div class="ea-row" style="margin-top:10px"><button type="button" class="primary" data-ea-msave'+(st.busy||!st.eventId?' disabled':'')+'>Im Terminplaner speichern</button></div>'
    +(st.msg?'<div class="small" style="margin-top:8px;white-space:pre-line">'+esc(st.msg)+'</div>':'');
}
function render(){
  const root=$('eaRoot');if(!root||!st)return;
  const evs=plannerEvents();
  const step=(n,title,done,hint)=>'<section class="ea-step'+(done?' done':'')+'"><div class="ea-step-head"><span class="ea-num">'+(done?'✓':n)+'</span><div><h3>'+title+'</h3>'+(hint?'<div class="ea-hint">'+hint+'</div>':'')+'</div></div><div class="ea-step-body">';
  const done1=!!(st.name&&st.date),done2=st.manual?!!(st.mPlatz&&st.mVon):st.files.length>0;
  const head=step(1,'Wettkampf',done1,'Aus dem Terminplaner wählen oder frei eingeben')+'<div class="ea-grid">'
    +'<label>Aus dem Terminplaner<select id="eaEvent"><option value="">– frei eingeben –</option>'+evs.map(x=>'<option value="'+esc(x.id)+'"'+(st.eventId===x.id?' selected':'')+'>'+esc(deDate(x.date)+' · '+x.name+' ('+KINDS[kindOf(x)]+')')+'</option>').join('')+'</select></label>'
    +'<label>Bezeichnung<input id="eaName" type="text" value="'+esc(st.name)+'" placeholder="z. B. Duo Cup · Gruppe A"></label>'
    +'<label>Datum<input id="eaDate" type="date" value="'+esc(st.date)+'"></label>'
    +'<label>Art<select id="eaKind">'+Object.entries(KINDS).map(([k,v])=>'<option value="'+k+'"'+(st.kind2===k?' selected':'')+'>'+esc(v)+(k==='intern'?' (zählt für die Vereinsrangliste)':'')+'</option>').join('')+'</select></label></div></div></section>'
    +step(2,st.manual?'Ergebnis manuell eingeben':'Ergebnisliste und Fotos',done2,st.manual?'Nur der eigene Platz – wird im Terminplaner eingetragen':'StockTV-Datei (.skmr), PDF oder Bild – mehrere möglich')+(manualAllowed()?'<div class="ea-row" style="margin-bottom:8px"><label class="ea-check" style="margin:0!important"><input type="radio" name="eaMode" value="list"'+(st.manual?'':' checked')+'> Ergebnisliste (SKMR, PDF, Bild)</label><label class="ea-check" style="margin:0!important"><input type="radio" name="eaMode" value="manual"'+(st.manual?' checked':'')+'> Manuell eingeben (Platz von Teilnehmer)</label></div>':'')+(st.manual?manualHtml():filesHtml())+'</div></section>';
  if(st.manual||!st.files.length){root.innerHTML=head;return;}
  const rowsHtml=st.rows.map((r,i)=>'<tr><td><input type="number" min="1" data-ea-rank="'+i+'" value="'+r.rank+'" style="width:64px"></td><td><input type="text" data-ea-team="'+i+'" value="'+esc(r.team)+'"></td>'
    +(st.internal?'<td><input type="text" data-ea-players="'+i+'" value="'+esc((r.players||[]).join(' / '))+'" placeholder="Spieler mit / trennen"></td>':'')
    +'<td class="small">'+esc(r.info||'')+(OWN.test(r.team)?' <b style="color:#7fd17f">EC Wegscheid</b>':'')+'</td><td><button type="button" data-ea-del="'+i+'">✕</button></td></tr>').join('');
  const fl=folders();
  const cats=['Duo Cup','Montags Solo','Solo Cup','Solo Pyramide','Ziel-JM','Vereinsmeisterschaft','Frauencup','Frauen Solo Pyramide'];
  const types={group:'Gruppe / Vorrunde (Mannschaft)',final:'Abschlussturnier / Endergebnis (Mannschaft)',round:'Vorrunde Einzel',soloFinal:'Finale / Endrunde Einzel',pyramid:'Solo Pyramide Endstand',jm:'Ziel-Jahresmeisterschaft',vm:'Vereinsmeisterschaft'};
  const own=st.rows.filter(r=>OWN.test(r.team));
  root.innerHTML=head
    +step(3,'Platzierungen prüfen',st.rows.some(r=>clean(r.team))&&!nameIssues().some(x=>!st.nameMap?.[x.raw]),st.rows.length?st.rows.length+(st.rows.length===1?' Platz':' Plätze')+' erkannt – bitte prüfen, korrigieren oder ergänzen':'Kein Text erkannt (z. B. eingescanntes Bild) – bitte die Plätze eintragen')
    +'<div style="overflow:auto"><table class="ea-table"><thead><tr><th>Platz</th><th>Mannschaft / Name</th>'+(st.internal?'<th>Spieler (Spielerliste)</th>':'')+'<th></th><th></th></tr></thead><tbody>'+rowsHtml+'</tbody></table></div>'
    +'<div class="ea-row" style="margin-top:6px"><button type="button" data-ea-addrow>+ Zeile</button></div>'
    +'<div id="eaNamesBox">'+namesHtml()+'</div></div></section>'
    +step(4,'Wohin speichern?',false,'Ziele anhaken – die Einstellungen klappen dann auf')
    +'<div class="ea-target'+(st.toHomepage?' on':'')+'"><label class="ea-check"><input type="checkbox" id="eaToHomepage"'+(st.toHomepage?' checked':'')+'> <b>🌐 Ergebnisse / Homepage</b><span class="ea-hint">Listen als PDF + PNG, Fotos und die Liste als Text</span></label>'
    +'<div class="ea-grid ea-target-body"><label>Ordner<select id="eaFolder"><option value="">– bitte wählen –</option><option value="/"'+(st.folder==='/'?' selected':'')+'>Ergebnisse (Hauptebene – neuen Ordner rechts eintragen)</option>'+fl.map(f=>'<option value="'+esc(f.path.join('>'))+'"'+(st.folder===f.path.join('>')?' selected':'')+'>'+esc(f.label)+'</option>').join('')+'</select></label>'
    +'<label>Neuer Unterordner (optional)<input id="eaSubfolder" type="text" value="'+esc(st.subfolder)+'" placeholder="z. B. '+esc(String(st.date||'').slice(0,4)||'2027')+'"></label></div></div>'
    +'<div class="ea-target'+(st.toOneDrive?' on':'')+'"><label class="ea-check"><input type="checkbox" id="eaToOneDrive"'+(st.toOneDrive?' checked':'')+(odReady()?'':' disabled')+'> <b>☁ OneDrive</b><span class="ea-hint">„'+esc(odRootName()+'/'+odPath())+'“ · '+(st.od?.local?(st.od.folder?'OneDrive-Ordner am PC':'beim ersten Speichern den Ordner „OneDrive\\ECWegscheid“ auswählen'):(st.od?.configured?'öffnet einen eigenen Tab mit Microsoft-Anmeldung':'nur am Computer mit Chrome oder Edge'))+'</span></label></div>'
    +(st.eventId?'<div class="ea-target'+(st.toPlanner?' on':'')+'"><label class="ea-check"><input type="checkbox" id="eaToPlanner"'+(st.toPlanner?' checked':'')+'> <b>📅 Terminplaner</b><span class="ea-hint">Ergebnis beim Termin: Platz <input id="eaOwnPlace" type="number" min="1" value="'+esc(st.ownPlace)+'" style="width:64px;display:inline-block;margin:0 4px"> von '+st.rows.length+(own.length>1?' <span class="small">(mehrere EC-Wegscheid-Mannschaften: '+esc(own.map(r=>r.rank+'. '+r.team).join(', '))+')</span>':'')+'</span></label></div>':'')
    +(st.internal?'<div class="ea-target'+(st.toRanking?' on':'')+'"><label class="ea-check"><input type="checkbox" id="eaToRanking"'+(st.toRanking?' checked':'')+'> <b>🏆 Vereinsrangliste</b><span class="ea-hint">Punkte für die Rangliste Herren / Damen</span></label><div class="ea-grid ea-target-body"><label>Kategorie<select id="eaCat">'+cats.map(c=>'<option'+(st.category===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label>'
      +'<label>Wertung<select id="eaType">'+Object.entries(types).map(([k,v])=>'<option value="'+k+'"'+(st.type===k?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label><label>Saison<input id="eaSeason" type="text" value="'+esc(st.season)+'"></label></div></div>':'')
    +'</div></section>'
    +'<section class="ea-final"><button type="button" class="primary ea-big" data-ea-save'+(st.busy?' disabled':'')+'>💾 Alles speichern und veröffentlichen</button>'
    +(st.msg?'<div class="ea-result">'+esc(st.msg)+'</div>':'')+'</section>'
    +'<details class="ea-od"><summary class="small">OneDrive-Einstellungen</summary>'
      +(st.od?.local?'<div class="small" style="margin:6px 0">OneDrive-Ordner auf diesem PC: <b>'+esc(st.od.folder||'noch nicht gewählt')+'</b> <button type="button" data-ea-odpick>Ordner wählen</button><br>Bitte den Ordner <b>ECWegscheid</b> in deinem OneDrive auswählen (z. B. C:\\Benutzer\\…\\OneDrive\\ECWegscheid). Die OneDrive-App lädt die Dateien automatisch hoch. Auf jedem PC einmal auswählen.</div>':'<div class="small" style="margin:6px 0">Speichern in den OneDrive-Ordner geht nur am Computer mit Chrome oder Edge.</div>')
      +'<details><summary class="small">Alternativ: Microsoft-Anmeldung (nur mit eigener Microsoft-App)</summary><div class="ea-grid" style="margin-top:6px"><label>Anwendungs-ID (Client-ID) aus der Microsoft-App-Registrierung<input id="eaOdClient" type="text" value="'+esc(window.ECWOneDrive?.config?.clientId||'')+'" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></label><label>Hauptordner in OneDrive<input id="eaOdFolder" type="text" value="'+esc(window.ECWOneDrive?.config?.root||'ECWegscheid')+'"></label></div><div class="small">Umleitungs-URI: <b>'+esc(window.ECWOneDrive?.redirectUri?.()||'')+'</b> · Berechtigung: Files.ReadWrite</div><div class="ea-row" style="margin-top:6px"><button type="button" data-ea-odsave>Speichern</button></div></details>'
      +'<div class="small" style="margin-top:6px">Ablage: Interne Wettbewerbe und Turniere als Veranstalter → Turniere/…, Meisterschaften und externe Turniere → Ergebnisse/…, Auslosungen → 02.Auslosungen</div></details>';
}
function readForm(){
  const v=id=>$(id)?.value??'';const c=id=>!!$(id)?.checked;
  if($('eaMPlatz')){st.mPlatz=v('eaMPlatz');st.mVon=v('eaMVon');st.mNotiz=clean(v('eaMNotiz'));}
  if($('eaName'))st.name=clean(v('eaName'));if($('eaDate'))st.date=v('eaDate');if($('eaKind')){const k=v('eaKind');if(k!==st.kind2){st.kind2=k;applyKind();}}
  if($('eaToHomepage'))st.toHomepage=c('eaToHomepage');if($('eaFolder'))st.folder=v('eaFolder');if($('eaSubfolder'))st.subfolder=clean(v('eaSubfolder'));
  if($('eaToPlanner'))st.toPlanner=c('eaToPlanner');if($('eaToOneDrive'))st.toOneDrive=c('eaToOneDrive');if($('eaOwnPlace'))st.ownPlace=v('eaOwnPlace');
  if($('eaToRanking'))st.toRanking=c('eaToRanking');if($('eaCat'))st.category=v('eaCat');if($('eaType'))st.type=v('eaType');if($('eaSeason'))st.season=clean(v('eaSeason'));
}
function applyGuesses(){
  st.category=st.category||guessCategory(st.name);st.type=guessType(st.category,st.name);st.season=st.season||seasonOf(st.date);
  const f=guessFolder(st.name,st.date);if(f&&!st.folder)st.folder=f.path.join('>');
  const own=st.rows.find(r=>OWN.test(r.team));if(own&&!st.ownPlace)st.ownPlace=String(own.rank);
}
async function readOne(file){
  const f={name:file.name,file,kind:'',pngs:[],previewUrl:'',note:'',rows:[]};
  if(/\.(skmr|xml)$/i.test(file.name)){
    const r=parseSkmrFile(await file.text());f.kind='skmr';f.rows=r.rows;f.date=r.date;f.title=r.title;
    f.note='StockTV-Datei: '+r.played+' von '+r.total+' Spielen eingetragen';
  }else if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
    f.kind='pdf';const doc=await pdfDoc(file);f.rows=parseLines(await pdfLines(doc));f.pngs=await pdfToPngs(doc);
    if(f.pngs[0])f.previewUrl=URL.createObjectURL(f.pngs[0]);f.note='PDF mit '+doc.numPages+' Seite(n)'+(f.rows.length?' · '+f.rows.length+' Plätze erkannt':'');
  }else if(/^image\//.test(file.type)){
    f.kind='image';f.previewUrl=URL.createObjectURL(file);f.note='Bild – Plätze bitte in Schritt 3 eintragen';
  }else throw Error(file.name+': Dateiformat nicht unterstützt (.skmr, PDF oder Bild).');
  return f;
}
function useRowsFrom(i){
  const f=st.files[i];if(!f)return;st.rowsFrom=i;
  st.rows=f.rows.map(r=>({...r,players:[...(r.players||[])]}));if(!st.rows.length)st.rows=[{rank:1,team:'',players:[]}];
  if(f.date&&!st.eventId)st.date=st.date||f.date;if(f.title&&!st.name)st.name=f.title;
  if(st.internal&&window.ECWRangliste?.resolvePlayers)st.rows.forEach(r=>{if(!r.players.length)r.players=ECWRangliste.resolvePlayers(r.team);});
  st.ownPlace='';applyGuesses();
}
async function addFiles(list){
  st.msg='Datei(en) werden gelesen …';render();const errs=[];
  for(const file of list){try{st.files.push(await readOne(file));}catch(e){errs.push(e.message);}}
  if(window.ECWRangliste?.ensureLoaded)await ECWRangliste.ensureLoaded().catch(()=>{});
  if(st.rowsFrom<0||!st.files[st.rowsFrom]){const i=st.files.findIndex(f=>f.rows.length);if(st.files.length)useRowsFrom(i<0?0:i);}
  else if(!st.rows.some(r=>clean(r.team))){const i=st.files.findIndex(f=>f.rows.length);if(i>=0)useRowsFrom(i);}
  st._out=null;st.msg=errs.join('\n');render();
}
// Fotos verkleinern (max. 2000 px, JPEG) – schont Speicher und Homepage.
async function shrinkPhoto(file){
  const url=URL.createObjectURL(file);const img=new Image();img.src=url;await img.decode();URL.revokeObjectURL(url);
  const sc=Math.min(1,2000/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*sc);c.height=Math.round(img.naturalHeight*sc);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);return new Promise(res=>c.toBlob(res,'image/jpeg',0.85));
}
async function addPhotos(list){
  st.msg='Fotos werden vorbereitet …';render();
  for(const file of list){try{const blob=await shrinkPhoto(file);st.photos.push({name:file.name,blob,previewUrl:URL.createObjectURL(blob)});}catch(e){toast(file.name+': kein lesbares Bild.');}}
  st._out=null;st.msg='';render();
}
// PDF + PNG für alle Eingaben (PDF: Original + Seitenbilder; Bild/StockTV: Bild + PDF daraus)
async function outputFiles(rows,title){
  if(st._out&&st._outKey===title)return st._out;
  const out=[],multi=st.files.length>1;
  for(const [i,f] of st.files.entries()){
    const t=multi?title+' – '+clean(f.name.replace(/\.[^.]+$/,'')):title;let pdf,pngs;
    if(f.kind==='pdf'){pdf=f.file;pngs=f.pngs;}
    else if(f.kind==='image'){pngs=[await toPng(f.file)];pdf=await imageToPdf(pngs[0]);}
    else{const rr=i===st.rowsFrom?rows:f.rows;pngs=[await tablePng(st.name,(st.date?deDate(st.date)+' · ':'')+rr.length+' Platzierungen',rr)];pdf=await imageToPdf(pngs[0]);}
    out.push([pdf,t+'.pdf'],...pngs.map((b,k)=>[b,t+(pngs.length>1?' · Seite '+(k+1):'')+'.png']));
  }
  st.photos.forEach((p,k)=>out.push([p.blob,title+' · Foto '+(k+1)+'.jpg']));
  st._out=out;st._outKey=title;return out;
}
async function saveManual(){
  readForm();const platz=parseInt(st.mPlatz,10),von=parseInt(st.mVon,10);
  if(!st.eventId)return toast('Bitte den Termin aus dem Terminplaner wählen.');
  if(!(platz>0))return toast('Bitte den Platz eintragen.');if(!(von>0))return toast('Bitte die Anzahl der Teilnehmer eintragen.');
  if(platz>von)return toast('Der Platz kann nicht größer sein als die Teilnehmerzahl.');
  const x=typeof tpFindEvent==='function'?tpFindEvent(st.eventId):null;if(!x)return toast('Termin nicht gefunden.');
  st.busy=true;render();
  try{
    x.ergebnis={...(x.ergebnis||{}),platz,von,notiz:st.mNotiz||x.ergebnis?.notiz||'',foto:!!x.ergebnis?.foto,eingetragenAm:new Date().toISOString(),eingetragenVon:(typeof firebaseAuthUser!=='undefined'&&firebaseAuthUser?.email)||''};
    x.updatedAt=new Date().toISOString();if(typeof save==='function')save();
    const ok=typeof tpSyncEventToFirebase==='function'?await tpSyncEventToFirebase(x):true;
    if(ok===false)throw Error('Termin konnte nicht in Firebase gespeichert werden.');
    st.msg='Fertig ✓ Terminplaner: '+platz+'. von '+von+' eingetragen';toast('Ergebnis gespeichert ✓');
  }catch(e){st.msg='Abgebrochen: '+e.message;toast(e.message,8000);}
  finally{st.busy=false;render();}
}
async function saveAll(od){
  let tab=od?.tab||null;
  readForm();
  const rows=st.rows.filter(r=>clean(r.team)).map(r=>({rank:Number(r.rank)||0,team:clean(r.team),players:(r.players||[]).map(clean).filter(Boolean),info:r.info||''})).sort((a,b)=>a.rank-b.rank);
  const stop=m=>{if(tab&&!tab.closed)tab.close();toast(m);};
  if(!rows.length)return stop('Keine Platzierungen eingetragen.');
  if(!st.name)return stop('Bitte eine Bezeichnung eingeben.');
  if(st.toHomepage&&!st.folder)return stop('Bitte einen Ergebnis-Ordner der Homepage wählen.');
  if(st.toOneDrive&&!st.folder)return stop('Bitte einen Ordner wählen (wird auch für OneDrive verwendet).');
  const missing=nameIssues().filter(x=>!st.nameMap?.[x.raw]);
  if(missing.length)return stop('Bitte bei „Namen prüfen“ zuordnen: '+missing.map(x=>x.raw).join(', '));
  st.busy=true;st.msg='Wird gespeichert …';render();const done=[];
  try{
    // 1. Homepage-Ergebnisse
    if(st.toHomepage){
      if(st.folder==='/'&&!st.subfolder)throw Error('Für die Hauptebene bitte einen Namen für den neuen Ordner eingeben.');
      const node=folderNode(st.folder.split('>').filter(Boolean),st.subfolder);
      const title=st.name+(st.date?' · '+deDate(st.date):'');
      const files=await outputFiles(rows,title);
      for(const [blob,name] of files){st.msg='Homepage: '+name+' wird hochgeladen …';render();const f=await storeResultFile(blob,name);
        node.links.push({t:name.replace(/\.(png|pdf|jpg)$/,''),u:'',kind:f.mime.startsWith('image/')?'image':'link',file:f});}
      node.body=(node.body?node.body.trim()+'\n\n':'')+title+'\n'+listText(rows);
      if(typeof shSave==='function')shSave();
      const ok=typeof shSaveToFirebase==='function'?await shSaveToFirebase():false;
      if(!ok)throw Error('Homepage-Ergebnisse konnten nicht in Firebase gespeichert werden.');
      done.push('Homepage-Ergebnisse: '+files.length+' Datei(en) + Liste im Ordner gespeichert');
    }
    // OneDrive
    if(st.toOneDrive&&od?.dir){
      const title=st.name+(st.date?' '+st.date:'');const files=await outputFiles(rows,title),path=odPath();
      for(const [blob,name] of files){st.msg='OneDrive: '+name+' …';render();await ecwOneDriveOrdner.write(od.dir,path,name,blob);}
      done.push('OneDrive: '+files.length+' Datei(en) in „'+od.dir.name+'/'+path+'“ gespeichert – die OneDrive-App lädt sie hoch');
    }
    if(st.toOneDrive&&tab){
      const title=st.name+(st.date?' '+st.date:'');const files=await outputFiles(rows,title),path=odPath();
      await ECWOneDrive.send(tab,files.map(([blob,name])=>({blob,name,path})),title);tab=null;
      done.push('OneDrive: '+files.length+' Datei(en) an den OneDrive-Tab übergeben („'+ECWOneDrive.config.root+'/'+path+'“)');
    }
    // 2. Terminplaner
    if(st.eventId&&st.toPlanner){
      const x=typeof tpFindEvent==='function'?tpFindEvent(st.eventId):null,platz=Number(st.ownPlace);
      if(x&&platz>0){x.ergebnis={...(x.ergebnis||{}),platz,von:rows.length,notiz:x.ergebnis?.notiz||'',foto:!!x.ergebnis?.foto,eingetragenAm:new Date().toISOString(),eingetragenVon:(typeof firebaseAuthUser!=='undefined'&&firebaseAuthUser?.email)||''};
        x.updatedAt=new Date().toISOString();if(typeof save==='function')save();if(typeof tpSyncEventToFirebase==='function')await tpSyncEventToFirebase(x);
        done.push('Terminplaner: '+platz+'. von '+rows.length+' eingetragen');}
    }
    // 3. Vereinsrangliste
    if(st.internal&&st.toRanking){
      if(!window.ECWRangliste?.addEvent)throw Error('Vereinsrangliste nicht geladen.');
      const res=await ECWRangliste.addEvent({category:st.category,type:st.type,season:st.season,label:st.name,date:st.date,rows:rows.map(r=>({rank:r.rank,team:r.team,players:rowPlayers(r).map(clean).filter(Boolean).map(n=>st.nameMap?.[n]||ECWRangliste.matchName?.(n)?.name||n)}))});
      done.push('Vereinsrangliste: eingetragen und neu berechnet'+(res?.replaced?' (Saison '+res.replaced+' dieser Kategorie zählt nicht mehr)':''));
    }
    st.msg='Fertig ✓\n'+done.join('\n');toast('Ergebnis gespeichert ✓');
  }catch(e){st.msg='Abgebrochen: '+(e.message||e)+(done.length?'\nBereits erledigt:\n'+done.join('\n'):'');toast(e.message||String(e),8000);}
  finally{if(tab&&!tab.closed)tab.close();st.busy=false;render();}
}
function css(){
  if($('eaCss'))return;const s=document.createElement('style');s.id='eaCss';
  s.textContent='#eaRoot{max-width:900px}'
   +'.ea-step{background:rgba(10,10,10,.55);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:12px 14px;margin:0 0 12px}'
   +'.ea-step.done{border-color:rgba(127,209,127,.55)}'
   +'.ea-step-head{display:flex;gap:12px;align-items:center;margin-bottom:10px}.ea-step-head h3{margin:0;font-size:1.1rem}'
   +'.ea-num{flex:none;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;background:#a31c28;color:#fff}'
   +'.ea-step.done .ea-num{background:#2e9e5a}'
   +'.ea-hint{display:block;font-size:.8rem;opacity:.75;font-weight:400}'
   +'.ea-target{border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px 12px;margin:0 0 8px;background:rgba(255,255,255,.03)}.ea-target.on{border-color:rgba(255,255,255,.35);background:rgba(255,255,255,.07)}'
   +'.ea-target .ea-check{margin:0!important}.ea-target .ea-check b{min-width:200px}.ea-target-body{margin:8px 0 2px 28px}.ea-target:not(.on) .ea-target-body{display:none}'
   +'.ea-final{margin:4px 0 12px}.ea-big{width:100%;padding:14px;font-size:1.1rem;border-radius:12px}'
   +'.ea-result{white-space:pre-line;margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(46,158,90,.18);border:1px solid rgba(46,158,90,.5)}'
   +'.ea-od{margin:0 0 20px;opacity:.85}'
   +'.ea-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 12px}.ea-grid label{display:flex;flex-direction:column;gap:3px;margin:0;font-size:.85rem}'
   +'.ea-file{display:inline-flex!important;align-items:center;padding:10px 14px;border:1px dashed rgba(255,255,255,.5);border-radius:8px;cursor:pointer;margin:0}.ea-file input{display:none}'
   +'.ea-table{width:100%;border-collapse:collapse}.ea-table td,.ea-table th{padding:3px 6px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}.ea-table input{margin:0!important;width:100%}'
   +'.ea-filerow{display:flex;gap:10px;align-items:center;padding:6px;border:1px solid rgba(255,255,255,.15);border-radius:8px;margin-top:6px}.ea-filerow img,.ea-fileicon{width:64px;height:64px;object-fit:contain;background:#fff;border-radius:4px;flex:none}.ea-fileicon{display:flex;align-items:center;justify-content:center;color:#333;font-weight:700;font-size:12px}.ea-filerow button{flex:none;width:auto}'
   +'.ea-thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.ea-thumb{position:relative}.ea-thumb img{width:96px;height:72px;object-fit:cover;border-radius:4px;display:block}.ea-thumb button{position:absolute;top:2px;right:2px;padding:0 6px;min-height:0;width:auto;line-height:1.4}'
   +'.ea-check{display:flex!important;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0!important}.ea-check>input[type=checkbox]{width:auto!important;margin:0!important}.ea-row{display:flex;gap:8px;flex-wrap:wrap}';
  document.head.appendChild(s);
}
function onInput(e){
  const t=e.target,d=t.dataset;if(!st)return;
  if('eaRank' in d)st.rows[+d.eaRank].rank=Number(t.value)||0;
  else if('eaTeam' in d)st.rows[+d.eaTeam].team=t.value;
  else if('eaPlayers' in d)st.rows[+d.eaPlayers].players=t.value.split('/').map(clean).filter(Boolean);
}
function onChange(e){
  const t=e.target;if(!st)return;
  if(t.name==='eaMode'){readForm();st.manual=t.value==='manual';st.msg='';render();return;}
  if(t.id==='eaFile'){readForm();const l=[...(t.files||[])];t.value='';if(l.length)addFiles(l);return;}
  if(t.id==='eaPhotos'){readForm();const l=[...(t.files||[])];t.value='';if(l.length)addPhotos(l);return;}
  if(t.id==='eaRowsFrom'){readForm();useRowsFrom(+t.value);render();return;}
  if(t.id==='eaEvent'){readForm();st.eventId=t.value;const x=plannerEvents().find(v=>v.id===t.value);
    if(x){st.name=x.name;st.date=x.date;st.kind2=kindOf(x);applyKind();st.category='';st.season='';st.folder='';applyGuesses();}else{applyKind();}render();return;}
  // nur die Namensprüfung neu aufbauen – die Tabelle bleibt (Eingabefokus geht nicht verloren)
  if(t.dataset&&('eaPlayers' in t.dataset||'eaTeam' in t.dataset)){const box=$('eaNamesBox');if(box)box.innerHTML=namesHtml();return;}
  if(t.dataset&&'eaNamefix' in t.dataset){st.nameMap=st.nameMap||{};st.nameMap[t.dataset.eaNamefix]=t.value;const box=$('eaNamesBox');if(box)box.innerHTML=namesHtml();return;}
  if(['eaFolder','eaSubfolder','eaToOneDrive','eaToRanking','eaToHomepage','eaToPlanner'].includes(t.id)){readForm();render();return;}
  if(['eaKind','eaName','eaDate','eaCat'].includes(t.id)){readForm();if(t.id!=='eaCat'){st.category='';}else st.type=guessType(st.category,st.name);if(t.id==='eaName'||t.id==='eaDate'){st.season=seasonOf(st.date);}applyGuesses();render();return;}
  readForm();
}
function onClick(e){
  const b=e.target.closest('button');if(!b||!st)return;const d=b.dataset;
  if('eaFdel' in d){readForm();const i=+d.eaFdel,f=st.files[i];if(f?.previewUrl)URL.revokeObjectURL(f.previewUrl);st.files.splice(i,1);st._out=null;
    if(i===st.rowsFrom){st.rowsFrom=-1;st.rows=[];const j=st.files.findIndex(x=>x.rows.length);if(st.files.length)useRowsFrom(j<0?0:j);}else if(i<st.rowsFrom)st.rowsFrom--;render();return;}
  if('eaPdel' in d){readForm();const i=+d.eaPdel;URL.revokeObjectURL(st.photos[i].previewUrl);st.photos.splice(i,1);st._out=null;render();return;}
  if('eaDel' in d){readForm();st.rows.splice(+d.eaDel,1);render();}
  else if('eaAddrow' in d){readForm();st.rows.push({rank:(st.rows[st.rows.length-1]?.rank||0)+1,team:'',players:[]});render();}
  else if('eaMsave' in d){saveManual();}
  else if('eaSave' in d){st._out=null;readForm();
    if(!st.toOneDrive)return saveAll(null);
    if(st.od?.local)return ecwOneDriveOrdner.ensure().then(dir=>{st.od.folder=dir.name;saveAll({dir});}).catch(err=>toast(err.message,8000));
    if(window.ECWOneDrive){try{return saveAll({tab:ECWOneDrive.openTab()});}catch(err){return toast(err.message,8000);}}
    saveAll(null);}
  else if('eaOdpick' in d){readForm();ecwOneDriveOrdner.choose().then(dir=>{st.od.folder=dir.name;render();toast('OneDrive-Ordner gewählt: '+dir.name);}).catch(err=>toast(err.message,8000));}
  else if('eaOdsave' in d){readForm();ECWOneDrive.saveConfig({clientId:$('eaOdClient').value,root:$('eaOdFolder').value}).then(refreshOd).then(()=>toast('OneDrive-Einstellungen gespeichert.')).catch(e=>toast(e.message,7000));}
}
async function refreshOd(){if(!st)return;const c=window.ECWOneDrive?await ECWOneDrive.loadConfig():{};const i=window.ecwOneDriveOrdner?await ecwOneDriveOrdner.info():{supported:false,folder:''};
  st.od={configured:!!c.clientId,local:i.supported,folder:i.folder};if(st.toOneDrive===undefined)st.toOneDrive=!!(i.supported&&i.folder);render();}
function open(){
  if(!isAdmin())return toast('Der Ergebnis-Assistent ist nur für Administratoren.');
  const a=$('adminMain');if(!a)return;css();
  st={files:[],photos:[],rowsFrom:-1,kind2:'intern',manual:false,mPlatz:'',mVon:'',mNotiz:'',toOneDrive:undefined,od:null,eventId:'',name:'',date:new Date().toISOString().slice(0,10),internal:true,fileName:'',rows:[],toHomepage:true,toPlanner:false,toRanking:true,folder:'',subfolder:'',ownPlace:'',category:'',type:'group',season:'',msg:''};
  a.innerHTML='<h2 style="margin:0 0 10px">Ergebnisse eingeben</h2>'
    +'<div class="small" style="margin-bottom:10px">Wettkampf wählen, Ergebnisliste einfügen, prüfen – dann wird alles in einem Schritt gespeichert: Ergebnisse (Homepage), OneDrive, Terminplaner und Vereinsrangliste.</div><div id="eaRoot"></div>';
  const root=$('eaRoot');root.addEventListener('input',onInput);root.addEventListener('change',onChange);root.addEventListener('click',onClick);
  render();refreshOd();
}
window.ECWErgebnisAssistent={open,_test:{parseLines,parseSkmrFile,guessCategory,guessType,seasonOf,imageToPdf}};
})();
