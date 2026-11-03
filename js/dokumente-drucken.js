/* EC Wegscheid Dokumentenverwaltung V2.8.6 – Firestore PDF in Einzelblöcken.
   Nur ausdrücklich freigegebene PDFs; Druckauflage ist ein Browserdialog-Standard,
   KEINE technisch erzwungene Begrenzung. */
(function(){'use strict';
const META='druckdokumente',COL='appSettings',SIZE=360000,MAX_BYTES=8*1024*1024;
const defaults=[{id:'verein',title:'Vereinsdokumente'},{id:'turnier',title:'Turnierunterlagen'},{id:'formulare',title:'Formulare'}];
let state={categories:defaults.map(x=>({...x})),files:[],printer:'HP Color Laser MFP 178nwg',paper:'A4',note:'',updatedAt:''};
let selected=null,previewFromAdmin=false,loading=false,busy=false,urls=new Map(),localPreviewUrl=null;
let loadError='',loadSource='',lastLoaded='',loadPromise=null;
const VERSION='2.8.6';
function withDeadline(p,ms){return Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error('Zeitüberschreitung nach '+Math.round(ms/1000)+' Sekunden')),ms))])}
function explainError(e){const code=String(e?.code||'');const msg=String(e?.message||e||'Unbekannter Fehler');
 if(code.includes('permission-denied')||/permission.?denied|insufficient permissions/i.test(msg))return 'Firebase-Zugriff verweigert (permission-denied). Bitte veröffentlichte Firestore-Regeln für appSettings/druckdokumente und druckpdf_* prüfen.';
 if(code.includes('unavailable')||/network|offline|failed to fetch/i.test(msg))return 'Firebase nicht erreichbar. Netzwerk und Verbindung des Whiteboards prüfen. '+msg;
 return msg;
}
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=s=>{if(typeof showToast==='function')showToast(s,4500);else alert(s)};
function db(){if(typeof firestoreDb==='undefined'||!firestoreDb)throw Error('Firebase ist noch nicht verbunden.');return firestoreDb}
function editor(){return typeof firebaseAuthUser!=='undefined'&&!!firebaseAuthUser&&typeof hasAppPermission==='function'&&hasAppPermission('sh')&&!isWhiteboardUser()}
function ref(){return db().collection(COL).doc(META)}
function normalized(x){const c=Array.isArray(x?.categories)?x.categories:defaults;return {categories:c.filter(y=>y&&typeof y.id==='string'&&typeof y.title==='string').slice(0,25),files:(Array.isArray(x?.files)?x.files:[]).filter(y=>y&&typeof y.id==='string'&&typeof y.title==='string').slice(0,200),printer:String(x?.printer||'HP Color Laser MFP 178nwg'),paper:String(x?.paper||'A4'),note:String(x?.note||''),updatedAt:String(x?.updatedAt||'')}}
async function load(force=false){
 if(loadPromise)return loadPromise;
 loading=true;loadError='';loadSource='';
 loadPromise=(async()=>{
  try{
   // SERVER statt lokaler Browser-Cache: PC und Whiteboard müssen dieselben Daten sehen.
   const snap=await withDeadline(ref().get({source:'server'}),18000);
   if(!snap.exists){state=normalized({});loadSource='missing';}
   else{state=normalized(snap.data());loadSource='server';}
   lastLoaded=new Date().toLocaleString('de-DE');
   if(force)toast('Dokumente vom Firebase-Server aktualisiert ✓');
   return true;
  }catch(e){
   console.error('Dokumente laden (Server)',e);
   loadError=explainError(e);loadSource='error';
   return false;
  }finally{loading=false;loadPromise=null}
 })();
 return loadPromise;
}
function menuSync(){
  if(typeof SH==='undefined')return;
  const b=SH.buttons.find(b=>String(b.t||'').replace(/\s/g,'').toLowerCase().includes('dokumentedrucken')||b.sub?.some(x=>String(x.u||'').startsWith('#druckdokumente-')));
  if(!b)return;
  b.sub=state.categories.map(c=>({t:c.title,u:'#druckdokumente-'+c.id}));
  if(typeof shSave==='function')shSave();
  if(typeof shRender==='function')shRender();
}
async function save(){if(!editor())throw Error('Keine Berechtigung zur Dokumentenverwaltung.');if(loadSource==='error'||!loadSource)throw Error('Zentrale Dokumentenliste wurde nicht erfolgreich geladen.');state.updatedAt=new Date().toISOString();await withDeadline(ref().set(JSON.parse(JSON.stringify(state))),25000);const verified=await withDeadline(ref().get({source:'server'}),18000);if(!verified.exists||!Array.isArray(verified.data()?.files)||verified.data().files.length!==state.files.length)throw Error('Speicherung konnte nicht vom Firebase-Server bestätigt werden. Bitte vor erneutem Upload aktualisieren.');loadSource='server';toast('Dokumentenverwaltung zentral gespeichert und vom Server bestätigt ✓');menuSync()}
function htmlPublic(){const c=selected?state.categories.find(x=>x.id===selected):null;
 let html='<div class="ecw-doc-card"><p>PDF-Dokumente ansehen oder direkt den Druckdialog öffnen. Dort Drucker, Farbe und Papierformat einstellen. <b>Bitte nur 1 Exemplar drucken.</b> Die Kopienanzahl kann im Browser nicht technisch gesperrt werden.</p>';
 if(!c){html+='<h2>Bereich auswählen</h2><div class="ecw-doc-tiles">'+state.categories.map(x=>'<button type="button" data-doc-cat="'+esc(x.id)+'">'+esc(x.title)+'</button>').join('')+'</div>';}
 else {html+='<h2>'+esc(c.title)+'</h2><button type="button" data-doc-cat="">← Alle Bereiche</button><div class="ecw-doc-list">';
 const files=state.files.filter(x=>x.category===selected);
 html+=files.length?files.map(f=>'<div class="ecw-doc-file"><span>📄 '+esc(f.title)+'</span><div><button type="button" data-doc-open="'+esc(f.id)+'">PDF öffnen</button> <button type="button" data-doc-print="'+esc(f.id)+'">Drucken</button></div></div>').join(''):'<p>Hier sind noch keine PDF-Dokumente hinterlegt.</p>';
 html+='</div>'}
 html+='</div>';return html;
}
async function open(category,fromAdmin=false){
 // Admin-Vorschau zeigt die normale Benutzeransicht; Bearbeitungsrechte werden nicht erweitert.
 previewFromAdmin=!!(fromAdmin && typeof firebaseAuthUser!=='undefined' && firebaseAuthUser && typeof isWhiteboardUser==='function' && !isWhiteboardUser() && typeof canViewApp==='function' && canViewApp('sh'));
 selected=category||null;
 const backButton=$('ecwDocsBackButton');
 if(backButton)backButton.textContent=previewFromAdmin?'Zurück zur Verwaltung':'Zurück zur Startseite';
 if(typeof showView==='function')showView('druckdokumente');
 const box=$('ecwDocPublic');if(box)box.innerHTML='<div class="ecw-doc-card">Dokumente werden direkt vom Firebase-Server geladen …</div>';
 await load();
 if($('druckdokumente')?.classList.contains('active'))renderPublic();
}
function renderPublic(){
 const box=$('ecwDocPublic');if(!box)return;
 if(loadSource==='error'){
  box.innerHTML='<div class="ecw-doc-card" role="alert"><h2>⚠ Dokumente konnten nicht geladen werden</h2><p>'+esc(loadError)+'</p><p>Die Dokumente sind nicht automatisch gelöscht. Die Liste wird bei einem Ladefehler bewusst nicht als leer angezeigt.</p><button type="button" id="ecwDocRetry">Erneut vom Firebase-Server laden</button><p class="small">Diagnose: Dokumentenverwaltung '+VERSION+' · Firestore appSettings/druckdokumente</p></div>';
 }else{
  const info=loadSource==='missing'?'⚠ In Firebase existiert noch keine zentrale Dokumentenliste. Falls am PC Dokumente angezeigt werden, bitte dort die Speicherung überprüfen.':'✓ Vom Firebase-Server geladen: '+state.files.length+' Dokument(e) · '+state.categories.length+' Bereich(e) · '+esc(lastLoaded);
  box.innerHTML='<div class="ecw-doc-card"><div role="status" class="small">'+info+' · Version '+VERSION+' <button type="button" id="ecwDocRetry">Aktualisieren</button></div></div>'+htmlPublic();
 }
 const retry=$('ecwDocRetry');if(retry)retry.addEventListener('click',async()=>{box.innerHTML='<div class="ecw-doc-card">Firebase-Server wird abgefragt …</div>';await load();renderPublic()});
 box.querySelectorAll('[data-doc-cat]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.docCat||null;renderPublic()}));
 box.querySelectorAll('[data-doc-open]').forEach(b=>b.addEventListener('click',()=>openPdf(b.dataset.docOpen,false)));
 box.querySelectorAll('[data-doc-print]').forEach(b=>b.addEventListener('click',()=>openPdf(b.dataset.docPrint,true)));
}
function back(){
 selected=null;
 if(previewFromAdmin){
  previewFromAdmin=false;
  if(typeof returnToAdminManagementView==='function'){returnToAdminManagementView();return;}
 }
 if(typeof window!=='undefined')window.__adminPreviewMode=false;
 try{history.replaceState(null,'',location.pathname+location.search+'#startseite')}catch(e){}
 if(typeof showView==='function')showView('startseite');
}
async function getUrl(id){if(urls.has(id))return urls.get(id);const f=state.files.find(x=>x.id===id);if(!f)throw Error('Dokument nicht gefunden.');const parts=[];for(let i=0;i<f.parts;i++){const snap=await db().collection(COL).doc('druckpdf_'+id+'_'+i).get();if(!snap.exists)throw Error('PDF-Daten fehlen (Block '+(i+1)+').');parts.push(snap.data().data||'')}
 const base64=parts.join('');const binary=atob(base64);const chunks=[];for(let i=0;i<binary.length;i+=32768){const sl=binary.slice(i,i+32768),arr=new Uint8Array(sl.length);for(let j=0;j<sl.length;j++)arr[j]=sl.charCodeAt(j);chunks.push(arr)}
 const url=URL.createObjectURL(new Blob(chunks,{type:'application/pdf'}));urls.set(id,url);return url}
// Der Druckaufruf muss mit einem echten Klick beginnen: Druckfenster sofort öffnen,
// PDF-Daten danach asynchron laden und nach dem Laden den nativen Dialog versuchen.
// Browser/PDF-Viewer (insbesondere Samsung Internet) entscheiden selbst, ob
// programmgesteuertes Drucken unterstützt wird. Deshalb gibt es einen sichtbaren
// Wiederholen-Knopf und eine PDF-Fallback-Ansicht im Druckfenster.
async function openPdf(id,print){
 if(print){return printPdf(id)}
 const tab=window.open('about:blank','_blank');
 if(tab)try{tab.document.write('<!doctype html><html lang="de"><title>PDF wird geladen</title><body style="font:18px Arial;padding:30px">PDF wird geladen …</body></html>');tab.document.close()}catch(e){}
 try{const url=await getUrl(id);if(tab){if(!tab.closed)tab.location.href=url}else{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click()}}catch(e){if(tab&&!tab.closed)tab.close();toast('PDF konnte nicht geöffnet werden: '+e.message)}
}
async function printPdf(id){
 // Popup direkt innerhalb des Klick-Handlers anlegen, nicht erst nach Firebase-await.
 const tab=window.open('about:blank','_blank');
 if(!tab){toast('Druckfenster blockiert. Bitte Pop-ups für diese Vereinsseite erlauben und erneut auf „Drucken“ tippen.');return}
 try{
  tab.document.open();
  tab.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EC Wegscheid – Dokument drucken</title><style>
  *{box-sizing:border-box}body{margin:0;font:16px Arial,sans-serif;background:#f2f2f2;color:#181818}
  header{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 16px;background:#800000;color:white}
  header strong{margin-right:auto}button{font:inherit;min-height:42px;border:1px solid #bbb;border-radius:7px;padding:8px 13px;cursor:pointer}
  button.primary{background:#fff;color:#800000;font-weight:700}button:disabled{opacity:.5;cursor:default}
  #ecwPrintStatus{padding:10px 16px;background:#fff3cd;color:#382a0b;min-height:42px}
  iframe{display:block;width:100%;height:calc(100vh - 117px);border:0;background:white}
  @media print{header,#ecwPrintStatus{display:none}iframe{width:100%;height:100vh}}
  </style></head><body><header><strong>EC Wegscheid · PDF drucken</strong><button type="button" class="primary" id="ecwPrintAgain" disabled>Druckdialog öffnen</button><button type="button" id="ecwPrintView" disabled>PDF separat öffnen</button></header><div id="ecwPrintStatus" role="status">PDF wird geladen …</div><iframe id="ecwPrintFrame" title="Druckvorschau PDF"></iframe></body></html>`);
  tab.document.close();
 }catch(e){toast('Druckfenster konnte nicht vorbereitet werden: '+e.message);try{tab.close()}catch(_){}return}
 const status=tab.document.getElementById('ecwPrintStatus');
 const frame=tab.document.getElementById('ecwPrintFrame');
 const again=tab.document.getElementById('ecwPrintAgain');
 const view=tab.document.getElementById('ecwPrintView');
 let ready=false,requested=false,pdfUrl=null;
 const launch=()=>{
  if(!ready||tab.closed)return;
  status.textContent='Druckdialog wird geöffnet. Bitte Drucker und Einstellungen prüfen und 1 Exemplar auswählen. Falls kein Dialog erscheint, „Druckdialog öffnen“ erneut drücken oder „PDF separat öffnen“ wählen.';
  try{
   tab.focus();
   // Bei Browsern mit integriertem PDF-Viewer druckt dessen Fenster das PDF.
   // Ein Print des äußeren HTML-Fensters wäre nicht zuverlässig (leere Seiten).
   const pdfWindow=frame.contentWindow;
   if(!pdfWindow||typeof pdfWindow.print!=='function')throw Error('PDF-Druckfunktion nicht verfügbar');
   pdfWindow.focus();pdfWindow.print();
  }catch(e){
   console.warn('Direktdruck nicht verfügbar:',e);
   status.textContent='Automatischer Druckdialog wird von diesem Browser nicht unterstützt. Bitte „PDF separat öffnen“ und dort Drucken wählen.';
  }
 };
 again.addEventListener('click',launch);
 try{
  pdfUrl=await getUrl(id);
  if(tab.closed)return;
  view.disabled=false;
  view.addEventListener('click',()=>{const a=tab.document.createElement('a');a.href=pdfUrl;a.target='_blank';a.rel='noopener';tab.document.body.appendChild(a);a.click();a.remove()});
  frame.addEventListener('load',()=>{
   if(tab.closed||requested)return;
   requested=true;ready=true;again.disabled=false;
   // Kurze Wartezeit, bis der integrierte PDF-Viewer nach iframe-load bereit ist.
   tab.setTimeout(launch,650);
  });
  status.textContent='PDF wird für den Druck vorbereitet …';
  frame.src=pdfUrl;
  // Einige mobile PDF-Viewer melden kein load; manuelle PDF-Ansicht bleibt verfügbar.
  tab.setTimeout(()=>{if(!tab.closed&&!ready){again.disabled=false;ready=true;status.textContent='Falls der Druckdialog nicht automatisch erscheint, „Druckdialog öffnen“ oder „PDF separat öffnen“ wählen.'}},5000);
 }catch(e){if(!tab.closed){status.textContent='PDF konnte nicht geladen werden: '+e.message;again.disabled=true;view.disabled=true}toast('PDF konnte nicht geladen werden: '+e.message)}
}

function htmlAdmin(){
 let h='<h2>Dokumente und Drucken</h2>';
 h+='<div class="card"><p class="small">Die Bereiche erscheinen auf der Startseite unter „Dokumente Drucken“. Bereiche und PDFs werden zentral in Firebase gespeichert. Nach dem Ändern von Bereichsnamen die Startseite ebenfalls zentral speichern.</p><h3>Unterbuttons / Bereiche</h3>';
 h+=state.categories.map((c,i)=>'<div class="ecw-doc-adminrow"><input aria-label="Bereichsname" data-cat-title="'+i+'" value="'+esc(c.title)+'"><button type="button" data-cat-remove="'+i+'">Entfernen</button></div>').join('');
 h+='<button type="button" id="ecwDocAddCat">+ Unterbutton hinzufügen</button></div><div class="card"><h3>PDF-Dokumente</h3><label>Bereich</label><select id="ecwDocCat">'+state.categories.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join('')+'</select><label>Titel (optional)</label><input id="ecwDocTitle" placeholder="Dokumentname"><label>PDF-Datei auswählen (max. 8 MB)</label><input id="ecwDocUpload" type="file" accept="application/pdf,.pdf"><div id="ecwDocLocalPreviewWrap" class="ecw-doc-local-preview" hidden><strong>Vorschau vor dem Speichern</strong><div id="ecwDocLocalPreviewInfo" class="small"></div><iframe id="ecwDocLocalPreviewFrame" title="Vorschau der ausgewählten PDF-Datei"></iframe></div><button class="primary" id="ecwDocUploadBtn" type="button">PDF hinzufügen und speichern</button><div id="ecwDocStatus" class="small" aria-live="polite"></div><h3>Vorhandene Dokumente</h3>';
 h+=state.files.length?state.files.map(f=>'<div class="ecw-doc-adminrow"><span>'+esc(f.title)+' <small>('+esc(state.categories.find(c=>c.id===f.category)?.title||'Ohne Bereich')+')</small></span><div class="row" style="gap:6px;flex-wrap:wrap"><button type="button" data-file-open="'+esc(f.id)+'">Separat öffnen</button><button type="button" data-file-delete="'+esc(f.id)+'">Entfernen</button></div></div>').join(''):'<p>Noch keine PDFs gespeichert.</p>';
 h+='</div><div class="card"><h3>Druckereinstellungen / Hinweise</h3><label>Druckerbezeichnung (Information, keine automatische Druckerwahl)</label><input id="ecwDocPrinter" value="'+esc(state.printer)+'"><label>Papierformat (Information)</label><select id="ecwDocPaper"><option '+(state.paper==='A4'?'selected':'')+'>A4</option><option '+(state.paper==='A5'?'selected':'')+'>A5</option></select><p class="small">Der normale Browser-Druckdialog wird verwendet. Die Anzahl 1 ist die Vorgabe in der Oberfläche, kann im Browserdialog aber nicht gesperrt werden. Drucker, Papierformat und Kopien müssen im Browser kontrolliert werden.</p><button type="button" class="primary" id="ecwDocSave">Einstellungen und Unterbuttons speichern</button><div id="ecwDocAdminStatus" class="small" aria-live="polite"></div></div>';
 return h;
}
async function admin(){
 if(!editor()){toast('Keine Berechtigung.');return}
 const a=$('adminMain');a.innerHTML='<h2>Dokumente werden direkt vom Firebase-Server geladen …</h2>';
 const ok=await load();
 if(!ok){a.innerHTML='<div class="card" role="alert"><h2>⚠ Dokumentenverwaltung nicht geladen</h2><p>'+esc(loadError)+'</p><p>Zur Sicherheit ist das Bearbeiten gesperrt. So kann eine leere Liste nicht versehentlich die zentral gespeicherten Dokumente überschreiben.</p><button type="button" id="ecwDocAdminRetry">Erneut versuchen</button></div>';a.querySelector('#ecwDocAdminRetry').onclick=admin;return}
 renderAdmin();
}
function renderAdmin(){const a=$('adminMain');if(!a)return;
 if(localPreviewUrl){URL.revokeObjectURL(localPreviewUrl);localPreviewUrl=null;}
 a.innerHTML=htmlAdmin();
 const uploadInput=$('ecwDocUpload');
 uploadInput.addEventListener('change',()=>{
  if(localPreviewUrl){URL.revokeObjectURL(localPreviewUrl);localPreviewUrl=null;}
  const wrap=$('ecwDocLocalPreviewWrap'),frame=$('ecwDocLocalPreviewFrame'),info=$('ecwDocLocalPreviewInfo');
  frame.removeAttribute('src');wrap.hidden=true;
  const file=uploadInput.files?.[0];
  if(!file)return;
  if(!/\.pdf$/i.test(file.name)||(file.type&&file.type!=='application/pdf')||file.size>MAX_BYTES){info.textContent='Nur PDF-Dateien bis 8 MB können angezeigt werden.';wrap.hidden=false;return;}
  localPreviewUrl=URL.createObjectURL(file);
  info.textContent=file.name+' · '+(file.size/1024/1024).toFixed(2)+' MB · noch nicht gespeichert';
  frame.src=localPreviewUrl;wrap.hidden=false;
 });
 a.querySelectorAll('[data-cat-title]').forEach(x=>x.addEventListener('input',()=>{state.categories[+x.dataset.catTitle].title=x.value}));
 a.querySelectorAll('[data-cat-remove]').forEach(x=>x.addEventListener('click',async()=>{const i=+x.dataset.catRemove,c=state.categories[i];if(state.files.some(f=>f.category===c.id)){toast('Zuerst die Dokumente dieses Bereichs entfernen.');return}if(!confirm('Unterbutton „'+c.title+'“ entfernen?'))return;state.categories.splice(i,1);try{await save();renderAdmin()}catch(e){toast('Speichern fehlgeschlagen: '+e.message)}}));
 $('ecwDocAddCat').onclick=async()=>{const title=prompt('Name des neuen Unterbuttons:');if(!title?.trim())return;state.categories.push({id:'c'+Date.now().toString(36),title:title.trim().slice(0,80)});try{await save();renderAdmin()}catch(e){toast('Speichern fehlgeschlagen: '+e.message)}};
 $('ecwDocUploadBtn').onclick=upload;
 a.querySelectorAll('[data-file-open]').forEach(x=>x.addEventListener('click',()=>openPdf(x.dataset.fileOpen,false)));
 a.querySelectorAll('[data-file-delete]').forEach(x=>x.addEventListener('click',()=>removeFile(x.dataset.fileDelete)));
 $('ecwDocSave').onclick=async()=>{state.printer=$('ecwDocPrinter').value.trim();state.paper=$('ecwDocPaper').value;try{await save();$('ecwDocAdminStatus').textContent='Zentral gespeichert ✓ · Bitte „Startseite bearbeiten“ → „Startseite speichern“ für die neuen Unterbuttons wählen.'}catch(e){toast('Speichern fehlgeschlagen: '+e.message)}};
}

function fileBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('Datei konnte nicht gelesen werden.'));r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.readAsDataURL(file)})}
async function upload(){if(!editor())return;const f=$('ecwDocUpload').files[0],cat=$('ecwDocCat').value,title=$('ecwDocTitle').value.trim()||f?.name;if(!f){toast('Bitte PDF-Datei auswählen.');return}if(f.size>MAX_BYTES){toast('PDF zu groß. Maximal 8 MB.');return}if(!/\.pdf$/i.test(f.name)||f.type&&f.type!=='application/pdf'){toast('Nur PDF-Dateien sind erlaubt.');return}
 if(busy)return;busy=true;const btn=$('ecwDocUploadBtn');btn.disabled=true;const status=$('ecwDocStatus');try{if(loadSource==='error'||!loadSource)throw Error('Zentrale Liste ist nicht geladen.');const base64=await fileBase64(f);if(!base64.startsWith('JVBERi0'))throw Error('Die Datei ist kein gültiges PDF.');const id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),parts=Math.ceil(base64.length/SIZE);for(let i=0;i<parts;i++){status.textContent='PDF wird gespeichert: Block '+(i+1)+' von '+parts;await db().collection(COL).doc('druckpdf_'+id+'_'+i).set({data:base64.slice(i*SIZE,(i+1)*SIZE),createdAt:new Date().toISOString()})}
 state.files.push({id,title:title.slice(0,130),category:cat,parts,size:f.size});await save();renderAdmin();toast('PDF zentral gespeichert ✓');
 }catch(e){status.textContent='Speichern fehlgeschlagen: '+e.message;toast('PDF konnte nicht gespeichert werden: '+e.message)}finally{busy=false;if(btn.isConnected)btn.disabled=false}}
async function removeFile(id){if(!editor())return;const f=state.files.find(x=>x.id===id);if(!f||!confirm('PDF „'+f.title+'“ endgültig entfernen?'))return;const previous=state.files;state.files=state.files.filter(x=>x.id!==id);try{await save();renderAdmin();for(let i=0;i<f.parts;i++)await db().collection(COL).doc('druckpdf_'+id+'_'+i).delete();if(urls.has(id)){URL.revokeObjectURL(urls.get(id));urls.delete(id)}toast('PDF entfernt ✓')}catch(e){state.files=previous;toast('Entfernen fehlgeschlagen: '+e.message)}}
window.ecwDocsOpen=open;window.ecwDocsBack=back;window.ecwDocsAdmin=admin;
})();
