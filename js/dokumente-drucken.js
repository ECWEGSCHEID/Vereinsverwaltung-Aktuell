/* EC Wegscheid Dokumentenverwaltung V2.5.3 – Firestore PDF in Einzelblöcken.
   Nur ausdrücklich freigegebene PDFs; Druckauflage ist ein Browserdialog-Standard,
   KEINE technisch erzwungene Begrenzung. */
(function(){'use strict';
const META='druckdokumente',COL='appSettings',SIZE=360000,MAX_BYTES=8*1024*1024;
const defaults=[{id:'verein',title:'Vereinsdokumente'},{id:'turnier',title:'Turnierunterlagen'},{id:'formulare',title:'Formulare'}];
let state={categories:defaults.map(x=>({...x})),files:[],printer:'HP Color Laser MFP 178nwg',paper:'A4',note:'',updatedAt:''};
let selected=null,loading=false,busy=false,urls=new Map();
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=s=>{if(typeof showToast==='function')showToast(s,4500);else alert(s)};
function db(){if(typeof firestoreDb==='undefined'||!firestoreDb)throw Error('Firebase ist noch nicht verbunden.');return firestoreDb}
function editor(){return typeof firebaseAuthUser!=='undefined'&&!!firebaseAuthUser&&typeof hasAppPermission==='function'&&hasAppPermission('sh')&&!isWhiteboardUser()}
function ref(){return db().collection(COL).doc(META)}
function normalized(x){const c=Array.isArray(x?.categories)?x.categories:defaults;return {categories:c.filter(y=>y&&typeof y.id==='string'&&typeof y.title==='string').slice(0,25),files:(Array.isArray(x?.files)?x.files:[]).filter(y=>y&&typeof y.id==='string'&&typeof y.title==='string').slice(0,200),printer:String(x?.printer||'HP Color Laser MFP 178nwg'),paper:String(x?.paper||'A4'),note:String(x?.note||''),updatedAt:String(x?.updatedAt||'')}}
async function load(force=false){if(loading)return;loading=true;try{const s=await ref().get();state=normalized(s.exists?s.data():{});if(force)toast('Dokumente aktualisiert ✓');return true}catch(e){console.error('Dokumente laden',e);toast('Dokumente konnten nicht geladen werden: '+e.message);return false}finally{loading=false}}
function menuSync(){
  if(typeof SH==='undefined')return;
  const b=SH.buttons.find(b=>String(b.t||'').replace(/\s/g,'').toLowerCase().includes('dokumentedrucken')||b.sub?.some(x=>String(x.u||'').startsWith('#druckdokumente-')));
  if(!b)return;
  b.sub=state.categories.map(c=>({t:c.title,u:'#druckdokumente-'+c.id}));
  if(typeof shSave==='function')shSave();
  if(typeof shRender==='function')shRender();
}
async function save(){if(!editor())throw Error('Keine Berechtigung zur Dokumentenverwaltung.');state.updatedAt=new Date().toISOString();await ref().set(JSON.parse(JSON.stringify(state)));toast('Dokumentenverwaltung zentral gespeichert ✓');menuSync()}
function htmlPublic(){const c=selected?state.categories.find(x=>x.id===selected):null;
 let html='<div class="ecw-doc-card"><p>Bereitgestellte PDF-Dokumente öffnen und über den Browser drucken. <b>Vorgabe: 1 Exemplar.</b> Die Anzahl kann im Browser-Druckdialog technisch verändert werden.</p>';
 if(!c){html+='<h2>Bereich auswählen</h2><div class="ecw-doc-tiles">'+state.categories.map(x=>'<button type="button" data-doc-cat="'+esc(x.id)+'">'+esc(x.title)+'</button>').join('')+'</div>';}
 else {html+='<h2>'+esc(c.title)+'</h2><button type="button" data-doc-cat="">← Alle Bereiche</button><div class="ecw-doc-list">';
 const files=state.files.filter(x=>x.category===selected);
 html+=files.length?files.map(f=>'<div class="ecw-doc-file"><span>📄 '+esc(f.title)+'</span><div><button type="button" data-doc-open="'+esc(f.id)+'">PDF öffnen</button> <button type="button" data-doc-print="'+esc(f.id)+'">Zum Drucken öffnen (1 Exemplar)</button></div></div>').join(''):'<p>Hier sind noch keine PDF-Dokumente hinterlegt.</p>';
 html+='</div>'}
 html+='</div>';return html;
}
async function open(category){selected=category||null;if(typeof showView==='function')showView('druckdokumente');const box=$('ecwDocPublic');if(box)box.innerHTML='<div class="ecw-doc-card">Dokumente werden geladen …</div>';await load();renderPublic()}
function renderPublic(){const box=$('ecwDocPublic');if(!box)return;box.innerHTML=htmlPublic();box.querySelectorAll('[data-doc-cat]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.docCat||null;renderPublic()}));box.querySelectorAll('[data-doc-open]').forEach(b=>b.addEventListener('click',()=>openPdf(b.dataset.docOpen,false)));box.querySelectorAll('[data-doc-print]').forEach(b=>b.addEventListener('click',()=>openPdf(b.dataset.docPrint,true)))}
function back(){selected=null;try{history.replaceState(null,'',location.pathname+location.search+'#startseite')}catch(e){}if(typeof showView==='function')showView('startseite')}
async function getUrl(id){if(urls.has(id))return urls.get(id);const f=state.files.find(x=>x.id===id);if(!f)throw Error('Dokument nicht gefunden.');const parts=[];for(let i=0;i<f.parts;i++){const snap=await db().collection(COL).doc('druckpdf_'+id+'_'+i).get();if(!snap.exists)throw Error('PDF-Daten fehlen (Block '+(i+1)+').');parts.push(snap.data().data||'')}
 const base64=parts.join('');const binary=atob(base64);const chunks=[];for(let i=0;i<binary.length;i+=32768){const sl=binary.slice(i,i+32768),arr=new Uint8Array(sl.length);for(let j=0;j<sl.length;j++)arr[j]=sl.charCodeAt(j);chunks.push(arr)}
 const url=URL.createObjectURL(new Blob(chunks,{type:'application/pdf'}));urls.set(id,url);return url}
async function openPdf(id,print){
 // Open synchronously on the user gesture to avoid iOS Safari popup blockers.
 const tab=window.open('about:blank','_blank');
 if(tab)try{tab.document.write('<!doctype html><html lang="de"><title>PDF wird geladen</title><body style="font:18px Arial;padding:30px">PDF wird geladen …</body></html>');tab.document.close()}catch(e){}
 try{const url=await getUrl(id);if(tab){tab.location.href=url;if(print)toast('PDF geöffnet. Bitte im PDF-Druckdialog 1 Exemplar auswählen.')}else{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click();if(print)toast('PDF öffnen und im Browser mit 1 Exemplar drucken.')}}catch(e){if(tab)tab.close();toast('PDF konnte nicht geöffnet werden: '+e.message)}
}
function htmlAdmin(){let h='<h2>Dokumente &amp; Drucken</h2><div class="card"><p class="small">Die drei Unterbuttons erscheinen auf der Startseite unter „Dokumente Drucken“. Bereiche und PDFs werden zentral in Firebase gespeichert. Nach dem Ändern von Bereichsnamen die Startseite ebenfalls zentral speichern.</p><h3>Unterbuttons / Bereiche</h3>';
 h+=state.categories.map((c,i)=>'<div class="ecw-doc-adminrow"><input aria-label="Bereichsname" data-cat-title="'+i+'" value="'+esc(c.title)+'"><button type="button" data-cat-remove="'+i+'">Entfernen</button></div>').join('');
 h+='<button type="button" id="ecwDocAddCat">+ Unterbutton hinzufügen</button></div><div class="card"><h3>PDF-Dokumente</h3><label>Bereich</label><select id="ecwDocCat">'+state.categories.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join('')+'</select><label>Titel (optional)</label><input id="ecwDocTitle" placeholder="Dokumentname"><label>PDF-Datei auswählen (max. 8 MB)</label><input id="ecwDocUpload" type="file" accept="application/pdf,.pdf"><button class="primary" id="ecwDocUploadBtn" type="button">PDF hinzufügen und speichern</button><div id="ecwDocStatus" class="small" aria-live="polite"></div><h3>Vorhandene Dokumente</h3>';
 h+=state.files.length?state.files.map(f=>'<div class="ecw-doc-adminrow"><span>'+esc(f.title)+' <small>('+esc(state.categories.find(c=>c.id===f.category)?.title||'Ohne Bereich')+')</small></span><button type="button" data-file-delete="'+esc(f.id)+'">Entfernen</button></div>').join(''):'<p>Noch keine PDFs gespeichert.</p>';
 h+='</div><div class="card"><h3>Druckereinstellungen / Hinweise</h3><label>Druckerbezeichnung (Information, keine automatische Druckerwahl)</label><input id="ecwDocPrinter" value="'+esc(state.printer)+'"><label>Papierformat (Information)</label><select id="ecwDocPaper"><option '+(state.paper==='A4'?'selected':'')+'>A4</option><option '+(state.paper==='A5'?'selected':'')+'>A5</option></select><p class="small">Der normale Browser-Druckdialog wird verwendet. Die Anzahl 1 ist die Vorgabe in der Oberfläche, kann im Browserdialog aber nicht gesperrt werden. Drucker, Papierformat und Kopien müssen im Browser kontrolliert werden.</p><button type="button" class="primary" id="ecwDocSave">Einstellungen und Unterbuttons speichern</button><div id="ecwDocAdminStatus" class="small" aria-live="polite"></div></div>';
 return h}
async function admin(){if(!editor()){toast('Keine Berechtigung.');return}const a=$('adminMain');a.innerHTML='<h2>Dokumente werden geladen …</h2>';await load();renderAdmin()}
function renderAdmin(){const a=$('adminMain');if(!a)return;a.innerHTML=htmlAdmin();
 a.querySelectorAll('[data-cat-title]').forEach(x=>x.addEventListener('input',()=>{state.categories[+x.dataset.catTitle].title=x.value}));
 a.querySelectorAll('[data-cat-remove]').forEach(x=>x.addEventListener('click',async()=>{const i=+x.dataset.catRemove,c=state.categories[i];if(state.files.some(f=>f.category===c.id)){toast('Zuerst die Dokumente dieses Bereichs entfernen.');return}if(!confirm('Unterbutton „'+c.title+'“ entfernen?'))return;state.categories.splice(i,1);try{await save();renderAdmin()}catch(e){toast('Speichern fehlgeschlagen: '+e.message)}}));
 $('ecwDocAddCat').onclick=async()=>{const title=prompt('Name des neuen Unterbuttons:');if(!title?.trim())return;state.categories.push({id:'c'+Date.now().toString(36),title:title.trim().slice(0,80)});try{await save();renderAdmin()}catch(e){toast('Speichern fehlgeschlagen: '+e.message)}};
 $('ecwDocUploadBtn').onclick=upload;
 a.querySelectorAll('[data-file-delete]').forEach(x=>x.addEventListener('click',()=>removeFile(x.dataset.fileDelete)));
 $('ecwDocSave').onclick=async()=>{state.printer=$('ecwDocPrinter').value.trim();state.paper=$('ecwDocPaper').value;try{await save();$('ecwDocAdminStatus').textContent='Zentral gespeichert ✓ · Bitte „Startseite bearbeiten“ → „Startseite speichern“ für die neuen Unterbuttons wählen.'}catch(e){toast('Speichern fehlgeschlagen: '+e.message)}};
}
function fileBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('Datei konnte nicht gelesen werden.'));r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.readAsDataURL(file)})}
async function upload(){if(!editor())return;const f=$('ecwDocUpload').files[0],cat=$('ecwDocCat').value,title=$('ecwDocTitle').value.trim()||f?.name;if(!f){toast('Bitte PDF-Datei auswählen.');return}if(f.size>MAX_BYTES){toast('PDF zu groß. Maximal 8 MB.');return}if(!/\.pdf$/i.test(f.name)||f.type&&f.type!=='application/pdf'){toast('Nur PDF-Dateien sind erlaubt.');return}
 if(busy)return;busy=true;const btn=$('ecwDocUploadBtn');btn.disabled=true;const status=$('ecwDocStatus');try{const base64=await fileBase64(f);if(!base64.startsWith('JVBERi0'))throw Error('Die Datei ist kein gültiges PDF.');const id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),parts=Math.ceil(base64.length/SIZE);for(let i=0;i<parts;i++){status.textContent='PDF wird gespeichert: Block '+(i+1)+' von '+parts;await db().collection(COL).doc('druckpdf_'+id+'_'+i).set({data:base64.slice(i*SIZE,(i+1)*SIZE),createdAt:new Date().toISOString()})}
 state.files.push({id,title:title.slice(0,130),category:cat,parts,size:f.size});await save();renderAdmin();toast('PDF zentral gespeichert ✓');
 }catch(e){status.textContent='Speichern fehlgeschlagen: '+e.message;toast('PDF konnte nicht gespeichert werden: '+e.message)}finally{busy=false;if(btn.isConnected)btn.disabled=false}}
async function removeFile(id){if(!editor())return;const f=state.files.find(x=>x.id===id);if(!f||!confirm('PDF „'+f.title+'“ endgültig entfernen?'))return;const previous=state.files;state.files=state.files.filter(x=>x.id!==id);try{await save();renderAdmin();for(let i=0;i<f.parts;i++)await db().collection(COL).doc('druckpdf_'+id+'_'+i).delete();if(urls.has(id)){URL.revokeObjectURL(urls.get(id));urls.delete(id)}toast('PDF entfernt ✓')}catch(e){state.files=previous;toast('Entfernen fehlgeschlagen: '+e.message)}}
window.ecwDocsOpen=open;window.ecwDocsBack=back;window.ecwDocsAdmin=admin;
})();
