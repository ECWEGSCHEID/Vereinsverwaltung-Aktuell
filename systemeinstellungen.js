/* EC Wegscheid – Systemeinstellungen V3. Farbe, Hintergrund, Vereinsname, Überschriften und Texte. Änderungen erst nach ausdrücklichem Speichern. */
(function(){
'use strict';
const DOC='vereinsKonfiguration';
const THEMES={
  neutral:{label:'Neutral · Anthrazit/Blau',primary:'#476581',background:'#26313c',surface:'#1c2530',text:'#ffffff'},
  carbon:{label:'Carbon Rot · EC Wegscheid',primary:'#b30000',background:'#5b0000',surface:'#211317',text:'#ffffff'},
  blue:{label:'Blau/Silber',primary:'#245fa4',background:'#142b47',surface:'#172333',text:'#ffffff'},
  green:{label:'Grün/Dunkel',primary:'#32835c',background:'#142d24',surface:'#15251f',text:'#ffffff'},
  silver:{label:'Silber Hell',primary:'#606e7d',background:'#a7afb7',surface:'#e5e7eb',text:'#1c2630'},
  blacksilver:{label:'Schwarz/Silber Original',primary:'#7c858e',background:'#202125',surface:'#33343a',text:'#ffffff'}
};
const PRESETS={
  none:{label:'Kein Vorlagenbild · bisheriger Hintergrund',file:''},
  'carbon-rot-mit-logo':{label:'Carbon Rot – mit EC Wegscheid Logo',file:'designvorlagen/carbon-rot-mit-logo.jpg',theme:'carbon'},
  'carbon-rot-ohne-logo':{label:'Carbon Rot – ohne Logo',file:'designvorlagen/carbon-rot-ohne-logo.jpg',theme:'carbon'},
  'blau-silber-mit-logo':{label:'Blau Silber – mit EC Wegscheid Logo',file:'designvorlagen/blau-silber-mit-logo.jpg',theme:'blue'},
  'blau-silber-ohne-logo':{label:'Blau Silber – ohne Logo',file:'designvorlagen/blau-silber-ohne-logo.jpg',theme:'blue'},
  'silber-hell-mit-logo':{label:'Silber Hell – mit EC Wegscheid Logo',file:'designvorlagen/silber-hell-mit-logo.jpg',theme:'silver'},
  'silber-hell-ohne-logo':{label:'Silber Hell – ohne Logo',file:'designvorlagen/silber-hell-ohne-logo.jpg',theme:'silver'},
  'schwarz-silber-original-mit-logo':{label:'Schwarz Silber – bisherige verkleinerte Vorlage',file:'designvorlagen/schwarz-silber-original-mit-logo.jpg',theme:'blacksilver'},
  'schwarz-carbon-original-mit-logo':{label:'Schwarz Carbon – EC Wegscheid (dein Originalbild)',file:'designvorlagen/schwarz-carbon-ec-wegscheid-original.jpg',theme:'blacksilver'}
};
function presetUrl(key){
  const file=PRESETS[key]?.file||'';
  if(!file)return '';
  const stem=file.split('/').pop().replace(/\.(png|jpg|jpeg)$/i,'');
  return window.ECW_DESIGN_ASSETS?.[stem] || file;
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base=()=>({name:'EC Wegscheid',shortName:'ECW',email:'',address:'',contact:'',theme:'carbon',primary:'#b30000',background:'#5b0000',logo:'',backgroundImage:'',backgroundPreset:'none',texts:{}});
const CACHE_KEY='ecw-systemeinstellungen-cache-v1';
const ORIGINAL_NAME='EC Wegscheid';
// Überschriften der einzelnen Programme (ohne Vereinsname, der wird separat ersetzt).
const PROGRAM_TITLES=['Turnierverwaltung','Turnierauswertung','Termin- und Turnierplaner','Turniereinladungen','Eigene Turniereinladungen','Eigene Turniere','Live Startlisten','Live Startliste','Interne Cups','Cupauswertung','Ziel Jahresmeisterschaft','Stockdartauswertung','Turnierauslosung','DOPPEL KO SYSTEM','Solo Pyramide 2026','VERSAMMLUNGEN UND ARBEITSEINSÄTZE','Mitgliederverwaltung','Mannschaften','Vereinsnachrichten','Zeitungsberichte EC Wegscheid','Aktivität Halle','Reservierungssystem','Dokumente und Drucken','Ergebnisse','Homepage','Spielerliste','Verwaltung'];
let loaded=null, draft=null, docExists=false, busy=false, previewingStart=false, shDraft=null;
const admin=()=>typeof appPermissions!=='undefined'&&appPermissions.admin===true&&typeof firebaseAuthUser!=='undefined'&&!!firebaseAuthUser;
const loggedIn=()=>typeof firebaseAuthUser!=='undefined'&&!!firebaseAuthUser;
const db=()=>typeof firestoreDb!=='undefined'?firestoreDb:null;
const el=id=>document.getElementById(id);
const norm=t=>String(t??'').replace(/\s+/g,' ').trim();
function safeImage(v){return typeof v==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)&&v.length<450000?v:''}
function cleanTexts(x){
  const out={};let n=0;
  if(x&&typeof x==='object')for(const [k,v] of Object.entries(x)){
    const key=norm(k).slice(0,200),val=String(v??'').replace(/\s+/g,' ').trim().slice(0,200);
    if(key&&val&&val!==key&&n<400){out[key]=val;n++;}
  }
  return out;
}
function clean(v){
  const d=base(), x=v||{};
  for(const k of ['name','shortName','email','address','contact'])d[k]=String(x[k]??d[k]).slice(0,250);
  d.theme=Object.hasOwn(THEMES,x.theme)?x.theme:'carbon';
  for(const k of ['primary','background'])d[k]=/^#[0-9a-fA-F]{6}$/.test(x[k]||'')?x[k]:THEMES[d.theme][k];
  d.logo=safeImage(x.logo);d.backgroundImage=safeImage(x.backgroundImage);
  d.backgroundPreset=Object.hasOwn(PRESETS,x.backgroundPreset)?x.backgroundPreset:'none';
  d.texts=cleanTexts(x.texts);
  return d;
}

/* ---------- Texte ersetzen (auch in eingebetteten Programmen) ---------- */
let activeTexts={}, activeName='', textRules=null;
const origText=new WeakMap();
const HEADING='H1,H2,H3,H4,TITLE,LEGEND,SUMMARY';
function buildRules(){
  const pairs=Object.entries(activeTexts).sort((a,b)=>b[0].length-a[0].length);
  textRules={exact:new Map(pairs),partial:pairs.filter(([k])=>k.length>=4)};
}
function transform(orig,parent){
  const n=norm(orig);if(!n)return orig;
  if(textRules.exact.has(n)){const m=orig.match(/^(\s*)[\s\S]*?(\s*)$/);return m[1]+textRules.exact.get(n)+m[2];}
  let out=orig;
  const heading=parent&&(parent.closest?.(HEADING)||parent.closest?.('.title,.subtitle,.header,header'));
  if(heading){
    for(const [k,v] of textRules.partial)if(out.includes(k))out=out.split(k).join(v);
  }
  if(activeName&&activeName!==ORIGINAL_NAME&&out.includes(ORIGINAL_NAME))out=out.split(ORIGINAL_NAME).join(activeName);
  return out;
}
function skipNode(p){
  return !p||/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(p.tagName)||p.isContentEditable||!!p.closest?.('[data-ecw-notext]');
}
function applyTextsIn(doc){
  if(!doc||!doc.body||!textRules)return;
  const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    const p=node.parentElement;if(skipNode(p))continue;
    const known=origText.get(node);
    // Wurde der Text vom Programm neu gesetzt, gilt der neue Wert als Original.
    const orig=known&&node.nodeValue===known.out?known.orig:node.nodeValue;
    const out=transform(orig,p);
    if(out!==node.nodeValue)node.nodeValue=out;
    origText.set(node,{orig,out});
  }
  const t=doc.querySelector('title');
  if(t){const known=origText.get(t);const orig=known&&doc.title===known.out?known.orig:doc.title;const out=transform(orig,t);if(out!==doc.title)doc.title=out;origText.set(t,{orig,out});}
  doc.querySelectorAll('iframe').forEach(f=>{try{const d=f.contentDocument;if(d&&d.body)watch(d);}catch(e){}});
}
const watched=new WeakSet();
function watch(doc){
  if(!doc||!doc.body)return;
  applyTextsIn(doc);
  if(watched.has(doc))return;
  watched.add(doc);
  let pending=false;
  const run=()=>{pending=false;applyTextsIn(doc)};
  new (doc.defaultView?.MutationObserver||MutationObserver)(()=>{if(!pending){pending=true;setTimeout(run,60)}}).observe(doc.body,{childList:true,subtree:true,characterData:true});
  doc.addEventListener('load',e=>{if(e.target?.tagName==='IFRAME')setTimeout(()=>{try{watch(e.target.contentDocument)}catch(_){}} ,50)},true);
}
function applyTexts(d){
  activeTexts=d.texts||{};activeName=norm(d.name)||ORIGINAL_NAME;
  const restore=!Object.keys(activeTexts).length&&activeName===ORIGINAL_NAME;
  if(restore&&!textRules)return;
  buildRules();watch(document);
}

/* ---------- Farbe und Hintergrund ---------- */
function apply(v){
  if(!v)return;
  const d=clean(v),style=el('ecw-config-style')||document.createElement('style');
  style.id='ecw-config-style';
  const bg=d.backgroundImage||presetUrl(d.backgroundPreset);
  const startBackground=bg
    ? '#shArt{background-image:url("'+bg+'") !important;background-position:center !important;background-size:cover !important;}'
    : '';
  style.textContent='body{background-color:'+d.background+' !important;'
    +(bg?'background-image:url("'+bg+'") !important;':'')
    +'background-position:center !important;background-size:cover !important;}'
    +'#shStage{background-color:'+d.background+' !important;}'
    +startBackground
    +'button.primary{background:'+d.primary+' !important;}';
  if(!style.parentNode)document.head.appendChild(style);
  document.documentElement.dataset.ecwTheme=d.theme;
  applyTexts(d);
}
function cache(d){try{const c={...d};if(c.backgroundImage&&c.backgroundImage.length>300000)c.backgroundImage='';localStorage.setItem(CACHE_KEY,JSON.stringify(c));}catch(e){}}
// Zuletzt gespeicherter Stand sofort anwenden – auch vor der Anmeldung (z. B. Whiteboard).
try{const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(c){const run=()=>apply(c);document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run):run();}}catch(e){}
async function load(){
  if(!db()||!loggedIn())return;
  try{
    const snap=await db().collection('appSettings').doc(DOC).get();
    docExists=snap.exists;
    loaded=snap.exists?clean(snap.data()):null;
    if(loaded){apply(loaded);cache(loaded);}
  }catch(e){console.warn('Systemeinstellungen konnten nicht geladen werden:',e);}
}

/* ---------- Oberfläche ---------- */
function msg(text,isError=false){const e=el('ecwCfgStatus');if(e){e.textContent=text;e.style.color=isError?'#ff9999':'#a5f2c2';}}
function preview(){
  const p=el('ecwConfigPreview');if(!p||!draft)return;
  const bg=draft.backgroundImage||presetUrl(draft.backgroundPreset);
  p.style.background=bg?'url("'+bg+'") center/cover':draft.background;
  p.style.color='#fff';
  p.innerHTML='<div style="display:flex;align-items:center;gap:16px">'+(draft.logo?'<img alt="Vereinslogo" style="width:70px;height:70px;object-fit:contain" src="'+draft.logo+'">':'')+'<div><strong style="font-size:22px;text-shadow:0 1px 4px #000">'+esc(draft.name||'Vereinsname')+'</strong><div style="text-shadow:0 1px 4px #000">Vorschau</div></div></div><div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap"><span style="background:'+draft.primary+';padding:10px 14px;border-radius:9px">Turnierverwaltung</span><span style="background:'+draft.primary+';padding:10px 14px;border-radius:9px">Mitgliederverwaltung</span></div>';
  document.querySelectorAll('#ecwCfgTiles [data-tile]').forEach(b=>{
    const [kind,key]=b.dataset.tile.split(':');
    const on=kind==='preset'?(!draft.backgroundImage&&draft.backgroundPreset===key):(!draft.backgroundImage&&draft.backgroundPreset==='none'&&draft.theme===key);
    b.classList.toggle('on',on);
  });
}
function tilesHtml(){
  const pre=Object.entries(PRESETS).filter(([k])=>k!=='none').map(([k,t])=>'<button type="button" class="ecw-cfg-tile" data-tile="preset:'+k+'"><span class="img" style="background-image:url(&quot;'+esc(presetUrl(k))+'&quot;)"></span><span>'+esc(t.label)+'</span></button>');
  const col=Object.entries(THEMES).map(([k,t])=>'<button type="button" class="ecw-cfg-tile" data-tile="theme:'+k+'"><span class="img" style="background:linear-gradient(135deg,'+t.background+' 55%,'+t.primary+' 55%)"></span><span>Nur Farbe · '+esc(t.label)+'</span></button>');
  return pre.concat(col).join('');
}
function pickTile(id){
  const [kind,key]=id.split(':');
  if(kind==='preset'){draft.backgroundPreset=key;draft.backgroundImage='';const th=PRESETS[key]?.theme;if(th){draft.theme=th;draft.primary=THEMES[th].primary;draft.background=THEMES[th].background;}}
  else{draft.theme=key;draft.primary=THEMES[key].primary;draft.background=THEMES[key].background;draft.backgroundPreset='none';draft.backgroundImage='';}
  el('ecwCfgPrimary').value=draft.primary;el('ecwCfgBackground').value=draft.background;
  preview();msg('Vorlage ausgewählt – noch nicht gespeichert.');
}
async function upload(file,key){
  if(!file)return;
  if(!file.type.startsWith('image/')){msg('Bitte eine Bilddatei auswählen.',true);return;}
  try{
    const image=await createImageBitmap(file);
    const max=key==='logo'?700:1600,scale=Math.min(1,max/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close?.();
    let data=canvas.toDataURL('image/webp',0.68);
    if(!data.startsWith('data:image/webp'))data=canvas.toDataURL('image/jpeg',0.65);
    if(!safeImage(data)){msg('Bild zu groß. Bitte eine kleinere Datei wählen.',true);return;}
    draft[key]=data;if(key==='backgroundImage')draft.backgroundPreset='none';
    preview();msg('Bild übernommen – noch nicht gespeichert.');
  }catch(e){msg('Bild konnte nicht verarbeitet werden: '+e.message,true)}
}
function textRow(orig,value,extra=''){
  return '<div class="ecw-cfg-text"><span title="'+esc(orig)+'">'+esc(orig)+'</span><input type="text" maxlength="200" data-orig="'+esc(orig)+'" value="'+esc(value||'')+'" placeholder="unverändert"'+extra+'></div>';
}
function menuLabels(){
  const out=[];
  document.querySelectorAll('.admin-side button').forEach(b=>{
    const known=[...b.childNodes].filter(n=>n.nodeType===3).map(n=>origText.get(n)?.orig??n.nodeValue).join('');
    const t=norm(known||b.textContent);
    if(t&&!/^👁$/.test(t)&&!out.includes(t))out.push(t);
  });
  return out;
}
function startseiteHtml(){
  if(typeof SH==='undefined'||!SH)return '<p class="small">Startseite nicht geladen.</p>';
  shDraft=JSON.parse(JSON.stringify(SH));
  let h='<div class="ecw-cfg-text"><span>Titel der Startseite</span><input type="text" maxlength="120" data-sh="title" value="'+esc(shDraft.title||'')+'"></div>';
  (shDraft.buttons||[]).forEach((b,i)=>{
    h+='<div class="ecw-cfg-text"><span>Kachel '+(i+1)+'</span><input type="text" maxlength="80" data-sh="b'+i+'" value="'+esc(String(b.t||'').replace(/\n/g,' | '))+'"></div>';
    (b.sub||[]).forEach((x,j)=>{h+='<div class="ecw-cfg-text sub"><span>↳ '+esc(String(b.t||'').replace(/\n/g,' '))+' '+(j+1)+'</span><input type="text" maxlength="80" data-sh="b'+i+'s'+j+'" value="'+esc(String(x.t||'').replace(/\n/g,' | '))+'"></div>';});
  });
  return h+'<p class="small">„|“ erzeugt einen Zeilenumbruch in der Kachel.</p>';
}
function readTexts(){
  const texts={};
  document.querySelectorAll('#ecwCfgTexts input[data-orig]').forEach(i=>{const v=norm(i.value);if(v)texts[i.dataset.orig]=v;});
  document.querySelectorAll('#ecwCfgOwnTexts .ecw-cfg-own').forEach(r=>{const a=norm(r.querySelector('.from').value),b=norm(r.querySelector('.to').value);if(a&&b)texts[a]=b;});
  return cleanTexts(texts);
}
function readStartseite(){
  if(!shDraft)return false;
  const val=k=>{const i=document.querySelector('#ecwCfgTexts input[data-sh="'+k+'"]');return i?String(i.value).split('|').map(x=>x.trim()).filter(Boolean).join('\n'):null;};
  let changed=false;
  const t=val('title');if(t!==null&&t&&t!==shDraft.title){shDraft.title=t;changed=true;}
  (shDraft.buttons||[]).forEach((b,i)=>{const v=val('b'+i);if(v&&v!==b.t){b.t=v;changed=true;}(b.sub||[]).forEach((x,j)=>{const w=val('b'+i+'s'+j);if(w&&w!==x.t){x.t=w;changed=true;}});});
  return changed;
}
function ownRow(a='',b=''){return '<div class="ecw-cfg-own"><input class="from" type="text" maxlength="200" placeholder="Text bisher" value="'+esc(a)+'"><span>→</span><input class="to" type="text" maxlength="200" placeholder="Neuer Text" value="'+esc(b)+'"><button type="button" class="ecw-cfg-del" title="Zeile entfernen">✕</button></div>';}
function change(){
  for(const [key,id] of [['name','ecwCfgName'],['shortName','ecwCfgShort'],['email','ecwCfgEmail'],['address','ecwCfgAddress'],['contact','ecwCfgContact'],['primary','ecwCfgPrimary'],['background','ecwCfgBackground']])draft[key]=el(id).value;
  preview();
}
async function save(){
  if(!admin()||busy){msg('Nur Administratoren dürfen diese Einstellungen speichern.',true);return;}
  change();draft.texts=readTexts();draft=clean(draft);
  if(!draft.name.trim()){msg('Bitte einen Vereinsnamen eingeben.',true);return;}
  if(!db()){msg('Firebase ist nicht verbunden.',true);return;}
  busy=true;msg('Speichere in Firebase …');
  const saveButton=el('ecwCfgSave');if(saveButton)saveButton.disabled=true;
  try{
    await db().collection('appSettings').doc(DOC).set({...draft,updatedAt:new Date().toISOString(),updatedBy:firebaseAuthUser.uid});
    const check=await db().collection('appSettings').doc(DOC).get({source:'server'});
    if(!check.exists)throw new Error('Nach dem Speichern kein Konfigurationsdokument gefunden.');
    loaded=clean(check.data());docExists=true;draft=clean(loaded);apply(loaded);cache(loaded);
    let note='';
    if(readStartseite()){
      SH=shDraft;shSave(true);if(typeof shRender==='function')shRender();
      const ok=typeof shSaveToFirebase==='function'?await shSaveToFirebase():false;
      note=ok?' Startseite ebenfalls gespeichert.':' Startseite nur lokal geändert – bitte unter „Startseite verwalten“ speichern.';
      shDraft=JSON.parse(JSON.stringify(SH));
    }
    msg('Gespeichert ✓'+note);
  }catch(e){console.error('Systemeinstellungen speichern:',e);msg('NICHT gespeichert – '+(e.code||'Fehler')+': '+(e.message||e),true)}finally{busy=false;if(saveButton)saveButton.disabled=false;}
}
function startseiteVorschau(){
  if(!admin()||!draft)return;
  previewingStart=true;
  change();draft.texts=readTexts();
  apply(draft);
  if(typeof showView==='function')showView('startseite');
  let b=el('ecwBackFromPreview');
  if(!b){
    b=document.createElement('button');b.id='ecwBackFromPreview';b.type='button';b.setAttribute('data-ecw-notext','');
    b.textContent='← Zurück zu den Systemeinstellungen (Vorschau)';
    b.style.cssText='position:fixed;top:12px;right:12px;z-index:2147483647;background:#20242c;color:white;padding:13px 20px;border:2px solid #fff;border-radius:10px;cursor:pointer;box-shadow:0 2px 12px #000';
    document.body.appendChild(b);
  }
  b.hidden=false;
  b.onclick=()=>{
    b.hidden=true;previewingStart=false;
    apply(loaded||base());
    if(!loaded){el('ecw-config-style')?.remove();delete document.documentElement.dataset.ecwTheme;}
    if(typeof showView==='function')showView('admin');
    if(typeof adminSection==='function')adminSection('sysconfig');
  };
}
function css(){
  if(el('ecwCfgCss'))return;
  const s=document.createElement('style');s.id='ecwCfgCss';
  s.textContent='#ecwCfgTiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:8px 0 14px}'
  +'.ecw-cfg-tile{color:#fff!important;display:flex!important;flex-direction:column;gap:6px;padding:6px!important;text-align:center;font-size:.82rem!important;line-height:1.2;border:2px solid rgba(255,255,255,.18)!important;border-radius:10px!important;background:rgba(0,0,0,.25)!important;min-height:0!important}'
  +'.ecw-cfg-tile .img{display:block;height:78px;border-radius:7px;background-size:cover;background-position:center}'
  +'.ecw-cfg-tile.on{border-color:#fff!important;box-shadow:0 0 0 2px #e23b47}'
  +'.ecw-cfg-text{display:grid;grid-template-columns:minmax(140px,1fr) 2fr;gap:10px;align-items:center;margin:4px 0}'
  +'.ecw-cfg-text span{font-size:.88rem;opacity:.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +'.ecw-cfg-text.sub span{padding-left:16px;opacity:.75}'
  +'.ecw-cfg-text input,.ecw-cfg-own input{margin:0!important}'
  +'.ecw-cfg-own{display:grid;grid-template-columns:1fr auto 1fr auto;gap:8px;align-items:center;margin:4px 0}'
  +'#ecwCfgTexts details{border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:8px 12px;margin:8px 0}'
  +'#ecwCfgTexts summary{cursor:pointer;font-weight:700}';
  document.head.appendChild(s);
}
async function open(){
  if(!admin())return;
  const a=el('adminMain');if(!a)return;
  css();
  a.innerHTML='<div data-ecw-notext><h2>⚙ Systemeinstellungen</h2>'
   +'<div class="card" style="margin-bottom:12px"><h3 style="margin-top:0">1 · Farbe und Hintergrund</h3>'
   +'<p class="small">Vorlage anklicken. Mit den Farbfeldern kannst du danach feinjustieren oder ein eigenes Hintergrundbild hochladen.</p>'
   +'<div id="ecwCfgTiles">'+tilesHtml()+'</div>'
   +'<div class="row"><div><label>Akzentfarbe (Buttons)</label><input id="ecwCfgPrimary" type="color" style="height:44px;width:100%"></div><div><label>Hintergrundfarbe</label><input id="ecwCfgBackground" type="color" style="height:44px;width:100%"></div></div>'
   +'<div class="row"><div><label>Eigenes Hintergrundbild (PNG/JPG/WebP)</label><input id="ecwCfgBg" type="file" accept="image/png,image/jpeg,image/webp"><button type="button" id="ecwCfgRemoveBg">Eigenes Bild entfernen</button></div></div>'
   +'<div id="ecwConfigPreview" style="padding:20px;min-height:150px;border-radius:12px;margin-top:12px"></div></div>'
   +'<div class="card" style="margin-bottom:12px"><h3 style="margin-top:0">2 · Verein</h3>'
   +'<div class="row"><div><label>Vereinsname</label><input id="ecwCfgName" type="text" maxlength="120"></div><div><label>Vereinskürzel</label><input id="ecwCfgShort" type="text" maxlength="25"></div></div>'
   +'<p class="small">Der Vereinsname ersetzt „EC Wegscheid“ in allen Überschriften und Fenstertiteln.</p>'
   +'<div class="row"><div><label>E-Mail</label><input id="ecwCfgEmail" type="text"></div><div><label>Kontakt</label><input id="ecwCfgContact" type="text"></div></div>'
   +'<label>Anschrift</label><input id="ecwCfgAddress" type="text">'
   +'<div class="row"><div><label>Vereinslogo (PNG/JPG/WebP)</label><input id="ecwCfgLogo" type="file" accept="image/png,image/jpeg,image/webp"><button type="button" id="ecwCfgRemoveLogo">Logo entfernen</button></div></div></div>'
   +'<div class="card" style="margin-bottom:12px"><h3 style="margin-top:0">3 · Überschriften und Texte</h3>'
   +'<p class="small">Nur ausfüllen, was anders heißen soll. Leere Felder bleiben unverändert.</p>'
   +'<div id="ecwCfgTexts">'
   +'<details open><summary>Startseite</summary><div id="ecwCfgSh"></div></details>'
   +'<details><summary>Menüpunkte im Verwaltungsmenü</summary><div id="ecwCfgMenu"></div></details>'
   +'<details><summary>Seitentitel der Programme</summary><div id="ecwCfgTitles"></div></details>'
   +'<details><summary>Weitere Texte</summary><p class="small">Für jeden anderen Text: links genau den bisherigen Text, rechts den neuen.</p><div id="ecwCfgOwnTexts"></div><button type="button" id="ecwCfgAddOwn">+ Zeile</button></details>'
   +'</div></div>'
   +'<div class="card"><div class="row"><button class="primary" id="ecwCfgSave">Einstellungen speichern</button><button id="ecwCfgStartPreview" type="button">Auf der Startseite ansehen</button><button id="ecwCfgCancel" type="button">Änderungen verwerfen</button></div><div id="ecwCfgStatus" role="status" style="margin-top:12px"></div></div></div>';
  msg('Lade aktuelle Einstellungen …');
  try{const snap=await db().collection('appSettings').doc(DOC).get();docExists=snap.exists;loaded=snap.exists?clean(snap.data()):null;}catch(e){msg('Firebase-Laden fehlgeschlagen: '+e.message,true);return;}
  draft=clean(loaded||base());
  for(const [key,id] of [['name','ecwCfgName'],['shortName','ecwCfgShort'],['email','ecwCfgEmail'],['address','ecwCfgAddress'],['contact','ecwCfgContact'],['primary','ecwCfgPrimary'],['background','ecwCfgBackground']])el(id).value=draft[key];
  const texts=draft.texts||{};
  el('ecwCfgSh').innerHTML=startseiteHtml();
  const menu=menuLabels();
  el('ecwCfgMenu').innerHTML=menu.map(t=>textRow(t,texts[t])).join('');
  const titles=PROGRAM_TITLES.filter(t=>!menu.includes(t));
  el('ecwCfgTitles').innerHTML='<p class="small">Gleichlautende Menüpunkte (z. B. Turnierverwaltung) werden oben unter „Menüpunkte“ geändert und gelten dann auch für den Seitentitel.</p>'+titles.map(t=>textRow(t,texts[t])).join('');
  const listed=new Set([...menu,...titles]);
  const own=Object.entries(texts).filter(([k])=>!listed.has(k));
  el('ecwCfgOwnTexts').innerHTML=(own.length?own:[['','']]).map(([k,v])=>ownRow(k,v)).join('');
  el('ecwCfgAddOwn').onclick=()=>el('ecwCfgOwnTexts').insertAdjacentHTML('beforeend',ownRow());
  el('ecwCfgOwnTexts').addEventListener('click',e=>{if(e.target.classList.contains('ecw-cfg-del'))e.target.closest('.ecw-cfg-own').remove();});
  ['ecwCfgName','ecwCfgShort','ecwCfgEmail','ecwCfgAddress','ecwCfgContact','ecwCfgPrimary','ecwCfgBackground'].forEach(id=>el(id).addEventListener('input',change));
  el('ecwCfgTiles').addEventListener('click',e=>{const b=e.target.closest('[data-tile]');if(b)pickTile(b.dataset.tile);});
  el('ecwCfgLogo').addEventListener('change',e=>upload(e.target.files[0],'logo'));
  el('ecwCfgBg').addEventListener('change',e=>upload(e.target.files[0],'backgroundImage'));
  el('ecwCfgRemoveLogo').onclick=()=>{draft.logo='';preview()};
  el('ecwCfgRemoveBg').onclick=()=>{draft.backgroundImage='';preview()};
  el('ecwCfgSave').onclick=save;
  el('ecwCfgStartPreview').onclick=startseiteVorschau;
  el('ecwCfgCancel').onclick=()=>open();
  preview();msg(docExists?'Aktuelle Einstellungen geladen.':'Noch keine Einstellungen gespeichert – bestehendes Design bleibt unverändert.');
}
window.ECWConfig={open,load};
})();
