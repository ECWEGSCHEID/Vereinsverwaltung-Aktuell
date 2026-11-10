/* Public results catalogue, homepage presentation and permission-checked administration. */
(function(){'use strict';
const version='2026-11-09-ergebnisse-testhomepage-2',clone=x=>JSON.parse(JSON.stringify(x)),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mimeTypes=['application/pdf','image/png','image/jpeg','image/webp','image/gif','image/bmp'];
function safeUrl(value){try{const u=new URL(String(value||''));return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}}
function fileMeta(f){if(!f||!/^result-[a-z0-9-]+$/.test(String(f.id))||!Number.isInteger(f.parts)||f.parts<1||f.parts>33||!mimeTypes.includes(f.mime)||!Number.isInteger(f.size)||f.size<1||f.size>8*1024*1024)return null;return{id:f.id,parts:f.parts,mime:f.mime,size:f.size,name:String(f.name||'Ergebnis').slice(0,250),pending:f.pending===true}}
function normalize(value){
 const seed=window.ECW_RESULTS_SEED?.root||{id:'ergebnisse',t:'Ergebnisse',body:'',links:[],children:[]};let count=0;
 function node(n,depth){if(!n||typeof n!=='object'||depth>12||++count>2000)return null;return{id:String(n.id||'result-'+count).slice(0,160),t:String(n.t||'Ohne Bezeichnung').slice(0,250),u:safeUrl(n.u),body:String(n.body||'').slice(0,50000),links:(Array.isArray(n.links)?n.links:[]).slice(0,400).map(l=>{const f=fileMeta(l.file),x={t:String(l.t||'Ergebnis öffnen').slice(0,250),u:safeUrl(l.u),kind:l.kind==='image'?'image':'link'};if(f){x.file=f;x.kind=f.mime.startsWith('image/')?'image':'link'}return x}).filter(l=>l.u||l.file),children:(Array.isArray(n.children)?n.children:[]).map(c=>node(c,depth+1)).filter(Boolean)}}
 return node(value||seed,0)||clone(seed);
}
let path=[],adminMode=false,previewMode=false,viewed=null,previousFocus=null,uploadBusy=false;
let savingResults=false;
let resultSaveMessage='';
const testHomepage='https://ec-wegscheid-test-homepage.m-stadler1978.chatgpt.site/Ergebnisse/';
const fileCache=new Map(),manifestCache=new Map();let galleryPage=0,galleryToken=0,galleryEntries=[],zoomIndex=-1;
function galleryLayout(width,height,requested){const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1),gap=4;let count=Math.max(1,Math.min(30,Number(requested)||12));if(w<650)count=Math.min(count,4);const cols=Math.ceil(count/2),rowHeight=Math.max(1,Math.floor((h-gap)/2)),slotWidth=Math.max(1,Math.min(Math.floor(rowHeight*210/297),Math.floor((w-(cols-1)*gap)/cols)));const columnGap=cols>1?Math.max(gap,Math.floor((w-cols*slotWidth)/(cols-1))):gap;return{cols,rows:2,rowHeight,slotWidth,columnGap,perPage:count}}

function currentGalleryLayout(){const box=document.getElementById('erGallery'),w=box?.clientWidth||(typeof innerWidth!=='undefined'?innerWidth-48:1200),h=box?.clientHeight||(typeof innerHeight!=='undefined'?innerHeight-240:650);return galleryLayout(w,h,typeof data!=='undefined'?data.settings?.tournamentPerPage:12)}
function perPage(){return currentGalleryLayout().perPage}
function resizeGallery(){const d=document.getElementById('ecwResultsDialog');if(!d?.open||!d.classList.contains('er-gallery-mode')||!galleryEntries.length)return;galleryPage=Math.min(galleryPage,Math.max(0,Math.ceil(galleryEntries.length/perPage())-1));galleryToken++;renderGallery()}


function fitTiles(){if(typeof requestAnimationFrame!=='function')return;requestAnimationFrame(()=>{const d=document.getElementById('ecwResultsDialog');if(!d?.open)return;const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)return;d.querySelectorAll('.er-tile').forEach(b=>{b.style.fontSize='';const style=getComputedStyle(b),font=parseFloat(style.fontSize),available=b.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-4;if(available<=0)return;ctx.font=style.fontWeight+' '+font+'px '+style.fontFamily;const longest=Math.max(1,...b.textContent.split(/\s+/).map(w=>ctx.measureText(w).width));if(longest>available)b.style.fontSize=(font*available/longest)+'px'})})}
if(typeof ResizeObserver!=='undefined'){let observer;document.addEventListener('DOMContentLoaded',()=>{observer=new ResizeObserver(()=>{fitTiles();resizeGallery()});observer.observe(document.documentElement)})}

function root(){return SH.results||(SH.results=normalize())}
function active(){let n=root();const valid=[];for(const id of path){const c=n.children.find(x=>x.id===id);if(!c)break;valid.push(id);n=c}path=valid;return n}
function intermediate(){return !path.length||active().children.length>0}
function allowed(){return typeof hasAppPermission==='function'&&hasAppPermission('sh')&&(typeof isWhiteboardUser!=='function'||!isWhiteboardUser())}
function save(){
 if(!allowed())return false;
 shSave();
 status('Lokal vorgemerkt. Klicke auf „Für Test-Homepage speichern“, um die Änderung zu übernehmen.');
 return true;
}
function id(){return 'result-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
function status(message){
 resultSaveMessage=message;
 const el=document.getElementById('erSaveStatus');
 if(el)el.textContent=message;
}
function setSaveButtonState(){
 const button=document.getElementById('erSaveForHomepage');
 if(button)button.disabled=uploadBusy||savingResults;
 const upload=document.getElementById('erUpload');
 if(upload)upload.disabled=uploadBusy||savingResults;
}
function testHomepageLink(node){
 const original=new URL(node.u||testHomepage);
 if(original.hostname==='www.ec-wegscheid.de'&&original.pathname.startsWith('/Ergebnisse/')){
  return new URL(original.pathname,testHomepage).href;
 }
 return path.length?testHomepage+'?ordner='+encodeURIComponent(node.id):testHomepage;
}
function button(label,code,cls='',disabled=false){return '<button type="button" class="'+cls+'" '+(disabled?'disabled ':'')+'onclick="ecwResults.'+code+'">'+label+'</button>'}
function element(){let d=document.getElementById('ecwResultsDialog');if(d)return d;d=document.createElement('dialog');d.id='ecwResultsDialog';d.className='ecw-results-dialog';d.setAttribute('aria-label','Ergebnisse');document.body.append(d);d.addEventListener('cancel',e=>{if(document.getElementById('erZoom')){e.preventDefault();closeZoom()}else{document.body.classList.remove('ecw-results-open');viewed=null}});return d}
function close(){const d=element();if(d.close)d.close();else{d.open=false;d.removeAttribute('open')}document.body.classList.remove('ecw-results-open');viewed=null;previousFocus?.focus?.()}
function open(edit=false){if(edit)return admin();adminMode=false;previewMode=false;path=[];viewed=null;previousFocus=document.activeElement;showPublic()}
function showPublic(){renderPublic();const d=element();if(!d.open){if(d.showModal)d.showModal();else{d.open=true;d.setAttribute('open','')}}document.body.classList.add('ecw-results-open');fitTiles()}
function home(){close();previewMode=false;adminMode=false;path=[];if(typeof showView==='function')showView('startseite');if(typeof shRender==='function'){shOpen=-1;shRender()}}
function preview(){if(!allowed()){showToast('Keine Berechtigung zur Ergebnis-Vorschau.');return}previewMode=true;viewed=null;showPublic()}
function previewBack(){close();previewMode=false;adminMode=true;renderAdmin()}
function admin(){if(!allowed()){showToast('Ergebnisse bearbeiten ist nicht freigegeben.');return}close();path=[];viewed=null;adminMode=true;previewMode=false;renderAdmin()}
function publicTile(title,code){return button(esc(title),code,'shbtn er-tile')}
function renderPublic(){const n=active(),d=element();const bg=path.length?'assets/hintergrund-carbon-rot.png':(SH.bg||'assets/startseite-standard.jpg');d.style.backgroundImage='url('+JSON.stringify(bg)+')';const gallery=!intermediate()&&n.links.length>0;galleryToken++;d.classList.toggle('er-gallery-mode',!!gallery);d.classList.toggle('er-inner-level',path.length>0);
 const body=gallery?'<div id="erGalleryStatus" class="small" role="status">Ergebnisübersicht wird geladen …</div><div id="erGallery" class="er-gallery"></div><nav id="erGalleryNav" class="er-gallery-nav"></nav>':(n.body?'<div class="er-description">'+esc(n.body)+'</div>':'')+'<div class="er-public-grid" style="--er-cols:'+([2,3,4].includes(+SH.cols)?SH.cols:3)+'">'+n.children.map((c,i)=>publicTile(c.t,'enter('+i+')')).join('')+n.links.map((l,i)=>publicTile(l.t,'openFile('+i+')')).join('')+'</div>'+(!n.children.length&&!n.links.length&&!n.body?'<p>Noch keine Ergebnisse vorhanden.</p>':'');
 d.innerHTML='<div class="er-public-shell"><header class="er-public-heading"><h1>'+esc(n.t)+'</h1>'+(previewMode?button('Zurück zur Verwaltung','previewBack()','er-preview-back'):'')+'</header>'+body+'<nav class="er-bottom" aria-label="Zurück">'+button('Eine Ebene nach oben','back()','',!path.length)+button('Zurück zum Startmenü','home()')+'</nav></div>';
 fitTiles();if(gallery){galleryEntries=[];drawGallery(n,galleryToken)}
}
async function manifest(l){const key=(l.file?.id||l.u)+'|'+l.t;if(manifestCache.has(key))return manifestCache.get(key);const work=(async()=>{const url=await fileUrl(l);if(l.kind==='image')return[{title:l.t,load:async()=>url}];const pdf=l.file?.mime==='application/pdf'||/\.pdf(?:[?#]|$)/i.test(url)||/\.pdf$/i.test(l.t);if(!pdf)return[{title:l.t,url,external:true}];
 if(typeof loadPdfJs==='function')await loadPdfJs();if(!window.pdfjsLib)throw Error('PDF-Anzeige konnte nicht geladen werden. Internetverbindung prüfen.');const doc=await window.pdfjsLib.getDocument({url}).promise;const pages=[];
 for(let page=1;page<=doc.numPages;page++){let promise;pages.push({title:l.t+' · Seite '+page,load:()=>promise||(promise=(async()=>{const p=await doc.getPage(page),v=p.getViewport({scale:1}),view=p.getViewport({scale:Math.min(2,1300/v.width)}),canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);await p.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;return canvas.toDataURL('image/jpeg',.9)})())})}return pages;
 })();manifestCache.set(key,work);try{return await work}catch(e){manifestCache.delete(key);throw e}}
async function drawGallery(n,token){const all=[];for(const l of n.links){try{all.push(...await manifest(l))}catch(e){all.push({title:l.t,error:e.message,url:safeUrl(l.u)})}if(token!==galleryToken)return}galleryEntries=all;galleryPage=Math.max(0,Math.min(galleryPage,Math.max(0,Math.ceil(all.length/perPage())-1)));renderGallery(token)}
function renderGallery(token=galleryToken){const box=document.getElementById('erGallery'),nav=document.getElementById('erGalleryNav'),status=document.getElementById('erGalleryStatus');if(!box||!nav||!status)return;const layout=currentGalleryLayout();box.style.gridTemplateColumns='repeat('+layout.cols+','+layout.slotWidth+'px)';box.style.gridTemplateRows='repeat(2,'+layout.rowHeight+'px)';box.style.columnGap=layout.columnGap+'px';box.style.rowGap='4px';const per=layout.perPage,shown=galleryEntries.slice(galleryPage*per,(galleryPage+1)*per),total=Math.max(1,Math.ceil(galleryEntries.length/per));status.textContent=galleryEntries.length+' Ergebnis-Seite(n) · Übersicht '+(galleryPage+1)+' / '+total;box.innerHTML=shown.map((e,i)=>e.external||e.error?'<div class="er-gallery-slot er-file-fallback"><span>'+esc(e.title)+'</span><p>'+esc(e.error||'Ergebnis als Internetseite öffnen')+'</p>'+(e.url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(e.url)+'">Öffnen ↗</a>':'')+'</div>':'<button type="button" class="er-gallery-slot" aria-label="'+esc(e.title)+' vergrößern" onclick="ecwResults.zoom('+(galleryPage*per+i)+')"><span class="er-thumb-loading">Wird geladen …</span><img alt="'+esc(e.title)+'" hidden></button>').join('');nav.innerHTML=button('‹ Vorige Übersicht','galleryMove(-1)','',galleryPage===0)+button('Nächste Übersicht ›','galleryMove(1)','',galleryPage>=total-1);
 shown.forEach(async(e,i)=>{if(!e.load)return;try{const url=await e.load();if(token!==galleryToken||box!==document.getElementById('erGallery'))return;const tile=box.children[i];if(!tile)return;const img=tile.querySelector('img');if(img){img.src=url;img.hidden=false;tile.querySelector('.er-thumb-loading')?.remove()}}catch(error){if(token===galleryToken&&box.children[i])box.children[i].textContent=e.title+': '+error.message}})
}
function galleryMove(delta){const next=galleryPage+delta;if(next<0||next>=Math.ceil(galleryEntries.length/perPage()))return;galleryPage=next;galleryToken++;renderGallery()}
async function zoom(index){const entry=galleryEntries[index];if(!entry?.load)return;zoomIndex=index;let overlay=document.getElementById('erZoom');if(!overlay){overlay=document.createElement('div');overlay.id='erZoom';overlay.className='er-zoom';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Ergebnis vergrößert');element().append(overlay)}overlay.innerHTML='<p>Seite wird geladen …</p>';try{const url=await entry.load();if(zoomIndex!==index||!overlay.isConnected)return;overlay.innerHTML='<img src="'+esc(url)+'" alt="'+esc(entry.title)+'"><button type="button" class="er-zoom-close" onclick="ecwResults.closeZoom()" aria-label="Vergrößerung schließen">✕</button>';overlay.onclick=e=>{if(e.target===overlay||e.target.tagName==='IMG')closeZoom()}}catch(e){overlay.textContent=e.message}}
function closeZoom(){zoomIndex=-1;document.getElementById('erZoom')?.remove()}

function enter(i){const n=active().children[i];if(n){path.push(n.id);viewed=null;galleryPage=0;render();element().scrollTop=0}}
function go(i){path=i<0?[]:path.slice(0,i+1);viewed=null;render()}
function back(){if(document.getElementById('erZoom')){closeZoom();return}path.pop();galleryPage=0;render()}
function render(){if(adminMode&&!previewMode)renderAdmin();else renderPublic()}
function breadcrumbs(){let n=root();const b=[button('Ergebnisse','go(-1)')];for(let i=0;i<path.length;i++){n=n.children.find(c=>c.id===path[i]);if(n)b.push(button(esc(n.t),'go('+i+')'))}return b.join('<span aria-hidden="true">›</span>')}
function fileHtml(l,i){return '<article class="card er-admin-file"><div class="er-edit-fields"><label>Bezeichnung<input maxlength="250" value="'+esc(l.t)+'" oninput="ecwResults.setLink('+i+',\'t\',this.value)"></label>'+(l.file?'<p class="small">'+esc(l.file.name)+' · '+Math.round(l.file.size/1024)+' KB · '+(l.file.pending?'nur lokal – Firebase ausstehend':'in Firebase gespeichert')+'</p>':'<label>Datei- oder Internetadresse<input type="url" value="'+esc(l.u)+'" onchange="ecwResults.setLink('+i+',\'u\',this.value)"></label>')+'</div><div class="row">'+button('Vorschau','previewFile('+i+')')+button('↑','moveLink('+i+',-1)','',i===0)+button('↓','moveLink('+i+',1)','',i===active().links.length-1)+button('Löschen','removeLink('+i+')','danger')+'</div></article>'}
function renderAdmin(){if(!allowed())return;const box=document.getElementById('adminMain');if(!box)return;const n=active();
const saveButton='<button type="button" class="primary" id="erSaveForHomepage" onclick="ecwResults.saveFirebase()" '+(uploadBusy||savingResults?'disabled':'')+'>Für Test-Homepage speichern</button>';
const viewLink='<p class="small"><a href="'+esc(testHomepageLink(n))+'" target="_blank" rel="noopener noreferrer">Diesen Ordner auf der privaten Test-Homepage öffnen ↗</a></p>';
const importButton=path.length?'':button('Altes Homepage-Archiv importieren','importSeed()');
box.innerHTML='<div class="er-admin"><header class="row er-admin-header"><h2>Ergebnisse verwalten</h2>'+button('👁 Vorschau','preview()')+saveButton+'</header><nav class="er-breadcrumb">'+breadcrumbs()+'</nav><p class="small" id="erSaveStatus" role="status">'+esc(resultSaveMessage||'Hier bearbeitest du das Archiv. Gespeicherte Änderungen erscheinen auf der privaten Test-Homepage.')+'</p>'+viewLink+'<div class="row er-admin-tools">'+button('+ Unterordner','addFolder()','primary')+(!intermediate()?button('+ Ergebnis-Link','addLink()'):'')+importButton+'</div><section class="card"><label>Überschrift<input maxlength="250" value="'+esc(n.t)+'" oninput="ecwResults.setNode(\'t\',this.value)"></label>'+'<label>Text auf der Homepage<textarea rows="5" maxlength="50000" oninput="ecwResults.setNode(\'body\',this.value)">'+esc(n.body)+'</textarea></label>'+(!intermediate()?'<label>Ergebnislisten oder Fotos hinzufügen (PDF, PNG, JPG, WebP, GIF oder BMP)<input type="file" id="erUpload" multiple accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/bmp,.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp" onchange="ecwResults.upload(this.files)" '+(uploadBusy||savingResults?'disabled':'')+'></label><p class="small">Maximal 8 MB pro Datei. Dateien werden in Firebase hochgeladen; anschließend die Ergebnisstruktur speichern. Veröffentliche hier nur Ergebnisse für die Startseite.</p>':'<p class="small">Hier Kategorien und Unterordner verwalten. Ergebnislisten und Fotos innerhalb einer Kategorie hinzufügen.</p>')+'</section><h3>Buttonanordnung</h3><div class="er-admin-folders">'+n.children.map((c,i)=>'<article class="card er-admin-folder" draggable="true" data-er-drag="children" data-er-index="'+i+'"><button class="er-folder-open" type="button" onclick="ecwResults.enter('+i+')">'+esc(c.t)+'</button><div class="row">'+button('↑','moveFolder('+i+',-1)','',i===0)+button('↓','moveFolder('+i+',1)','',i===n.children.length-1)+button('Löschen','removeFolder('+i+')','danger')+'</div></article>').join('')+'</div><div class="er-admin-files">'+n.links.map((l,i)=>'<div draggable="true" data-er-drag="links" data-er-index="'+i+'">'+fileHtml(l,i)+'</div>').join('')+'</div></div>';bindDrag(box)}
function bindDrag(box){let source=null;box.querySelectorAll('[data-er-drag]').forEach(el=>{el.addEventListener('dragstart',e=>{source={kind:el.dataset.erDrag,index:+el.dataset.erIndex};e.dataTransfer?.setData('text/plain',JSON.stringify(source));if(e.dataTransfer)e.dataTransfer.effectAllowed='move'});el.addEventListener('dragover',e=>e.preventDefault());el.addEventListener('drop',e=>{e.preventDefault();if(source&&source.kind===el.dataset.erDrag)reorder(source.kind,source.index,+el.dataset.erIndex);source=null})})}
function setNode(k,v){if(!adminMode||!allowed()||savingResults||!['t','body'].includes(k))return;active()[k]=String(v).slice(0,k==='t'?250:50000);save()}
function setLink(i,k,v){if(!adminMode||!allowed()||savingResults||!['t','u'].includes(k))return;const l=active().links[i];if(!l)return;if(k==='u'&&!safeUrl(v)){showToast('Bitte eine gültige http(s)-Adresse eingeben.');renderAdmin();return}l[k]=k==='u'?safeUrl(v):String(v).slice(0,250);save()}
function addFolder(){if(!adminMode||!allowed()||savingResults)return;const name=prompt('Name des neuen Unterordners:');if(!name?.trim())return;active().children.push({id:id(),t:name.trim().slice(0,250),u:'',body:'',links:[],children:[]});save();renderAdmin()}
function addLink(){if(!adminMode||!allowed()||savingResults||intermediate())return;const name=prompt('Bezeichnung des Ergebnisses:');if(!name?.trim())return;const u=prompt('Adresse der Ergebnisdatei oder Ergebnisseite (https://…):');if(u===null)return;if(!safeUrl(u)){showToast('Bitte eine gültige http(s)-Adresse eingeben.');return}active().links.push({t:name.trim().slice(0,250),u:safeUrl(u),kind:/\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(u)?'image':'link'});save();renderAdmin()}
function reorder(kind,from,to){if(!adminMode||!allowed()||savingResults||!['children','links'].includes(kind))return;const a=active()[kind];if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=a.length||to>=a.length)return;const n=a.splice(from,1)[0];a.splice(to,0,n);save();renderAdmin()}
function move(kind,i,d){if(![-1,1].includes(d))return;reorder(kind,i,i+d)}
function remove(kind,i){if(!adminMode||!allowed()||savingResults)return;const a=active()[kind],n=a[i];if(!n||!confirm('„'+n.t+'“'+(kind==='children'?' samt Unterordnern und Einträgen':'')+' entfernen?'))return;a.splice(i,1);save();renderAdmin()}
function merge(target,source){let added=0;for(const l of source.links){if(!target.links.some(x=>x.u===l.u)){target.links.push(clone(l));added++}}for(const c of source.children){const found=target.children.find(x=>x.id===c.id||x.u&&x.u===c.u);if(found)added+=merge(found,c);else{target.children.push(clone(c));added++}}return added}
function importSeed(){if(!adminMode||!allowed()||savingResults||path.length)return;const seed=window.ECW_RESULTS_SEED;if(!seed?.root){showToast('Homepagebestand fehlt. Bitte alle Programmdateien hochladen.');return}if(!confirm('Alte Ergebnisse aus dem mitgelieferten Archiv in die Vereinsverwaltung importieren? Eigene Texte und Einträge bleiben erhalten. Entfernte Originaleinträge können wieder erscheinen.'))return;const n=merge(root(),normalize(seed.root));save();renderAdmin();status(n+' fehlende Ordner/Einträge importiert. Jetzt „Für Test-Homepage speichern“ klicken.')}
async function saveFirebase(){
 if(!adminMode||!allowed()||uploadBusy||savingResults)return false;
 savingResults=true;
 setSaveButtonState();
 status('Ergebnisse werden in Firebase gespeichert …');
 try{
  const ok=await shSaveToFirebase();
  if(ok){
   status('In Firebase gespeichert ✓ Die private Test-Homepage zeigt die Änderungen nach dem Neuladen.');
  }else if(resultSaveMessage==='Ergebnisse werden in Firebase gespeichert …'){
   status('Speichern nicht bestätigt. Prüfe Anmeldung, Berechtigung und Verbindung. Versuche es in diesem Fenster erneut.');
  }
  return ok;
 }finally{
  savingResults=false;
  setSaveButtonState();
 }
}
function database(){if(typeof firestoreDb==='undefined'||!firestoreDb)throw Error('Firebase ist nicht verbunden.');return firestoreDb}
function deadline(p){let t;return Promise.race([p,new Promise((_,reject)=>t=setTimeout(()=>reject(Error('Firebase-Zeitüberschreitung. Verbindung prüfen.')),30000))]).finally(()=>clearTimeout(t))}
function partRef(fileId,part){return database().collection('ergebnisdateien').doc(fileId).collection('blocks').doc(String(part))}
function readBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('Datei konnte nicht gelesen werden.'));r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.readAsDataURL(file)})}
function detectMime(base64){const bytes=atob(base64.slice(0,64)),b=[...bytes].map(x=>x.charCodeAt(0));if(bytes.startsWith('%PDF-'))return 'application/pdf';if(b.slice(0,8).join(',')==='137,80,78,71,13,10,26,10')return 'image/png';if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if(bytes.startsWith('GIF87a')||bytes.startsWith('GIF89a'))return 'image/gif';if(bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP')return 'image/webp';if(bytes.startsWith('BM'))return 'image/bmp';return ''}
function cloudError(e){return /permission.denied|insufficient permissions/i.test(String(e.code||'')+' '+String(e.message||''))?'Firebase-Berechtigung fehlt. Die Datei bleibt nur auf diesem Gerät gespeichert. Bitte die beiliegenden vollständigen Firestore-Regeln veröffentlichen und das Startseiten-Bearbeitungsrecht prüfen.':String(e.message||e)}
function localKey(f){return 'media_ergebnis_'+f.id}
function fromBase64(data,mime){const bytes=atob(data),a=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)a[i]=bytes.charCodeAt(i);return new Blob([a],{type:mime})}
async function storeRemote(f,data){for(let p=0;p<f.parts;p++){const part=data.slice(p*360000,(p+1)*360000),ref=partRef(f.id,p);try{await deadline(ref.set({data:part,createdAt:new Date().toISOString()}))}catch(e){
 // If a previous request was confirmed by the server but its reply was lost,
 // immutable, identical blocks can be reused without changing them.
 let same=false;try{const existing=await deadline(ref.get());same=existing.exists&&existing.data().data===part}catch{}if(!same)throw e;
 }}f.pending=false;save()}
async function upload(files){if(!adminMode||!allowed()||uploadBusy||savingResults||intermediate())return;const selected=Array.from(files||[]);if(!selected.length)return;uploadBusy=true;setSaveButtonState();const target=active(),input=document.getElementById('erUpload');if(input)input.disabled=true;let done=0,cloudProblem='';
 try{for(const file of selected){if(!allowed())throw Error('Keine Bearbeitungsberechtigung.');if(file.size<1||file.size>8*1024*1024)throw Error(file.name+': maximal 8 MB pro Datei.');const data=await readBase64(file),mime=detectMime(data);if(!mimeTypes.includes(mime))throw Error(file.name+': Dateiformat nicht unterstützt.');const f={id:id(),parts:Math.ceil(data.length/360000),mime,size:file.size,name:file.name,pending:true};
 if(typeof mediaPut!=='function')throw Error('Lokaler Dateispeicher ist nicht verfügbar. Bitte über Live Server öffnen.');await mediaPut(localKey(f),fromBase64(data,mime));target.links.push({t:file.name,u:'',kind:mime.startsWith('image/')?'image':'link',file:f});save();done++;
 if(!cloudProblem){try{if(typeof firebaseAuthUser==='undefined'||!firebaseAuthUser)throw Error('Bitte zum zentralen Speichern anmelden.');await storeRemote(f,data)}catch(e){cloudProblem=cloudError(e)}}
 }renderAdmin();status(cloudProblem?done+' Datei(en) lokal eingefügt. '+cloudProblem:done+' Datei(en) hochgeladen. Jetzt „Für Test-Homepage speichern“ klicken, um die Dateien dort anzuzeigen.');
 }catch(e){renderAdmin();status('Einfügen nicht vollständig: '+e.message+(done?' · '+done+' Datei(en) bereits lokal hinzugefügt.':''));showToast(e.message,6500)}finally{uploadBusy=false;setSaveButtonState();const e=document.getElementById('erUpload');if(e){e.disabled=false;e.value=''}}}
function pendingFiles(n=root(),out=[]){for(const l of n.links)if(l.file?.pending)out.push(l.file);for(const c of n.children)pendingFiles(c,out);return out}
async function prepareSave(){const pending=pendingFiles();if(!pending.length)return true;if(!allowed()||uploadBusy)return false;try{if(typeof firebaseAuthUser==='undefined'||!firebaseAuthUser)throw Error('Bitte anmelden.');for(const f of pending){const blob=await mediaGet(localKey(f));if(!blob)throw Error('Die lokale Datei '+f.name+' fehlt auf diesem Gerät.');status('Firebase-Übertragung: '+f.name);await storeRemote(f,await readBase64(blob))}return true}catch(e){const message=cloudError(e);status(message);showToast(message,9000);return false}}

async function fileUrl(l){if(!l.file)return safeUrl(l.u);const f=fileMeta(l.file);if(!f)throw Error('Ungültige Dateiangaben.');if(fileCache.has(f.id))return fileCache.get(f.id);if(typeof mediaGet==='function'){const local=await mediaGet(localKey(f));if(local){const url=URL.createObjectURL(local);fileCache.set(f.id,url);return url}}if(f.pending)throw Error('Diese Datei ist bisher nur auf dem ursprünglichen Gerät gespeichert.');let data='';for(let i=0;i<f.parts;i++){const snap=await deadline(partRef(f.id,i).get());if(!snap.exists)throw Error('Dateidaten fehlen.');data+=String(snap.data().data||'')}const bytes=atob(data),a=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)a[i]=bytes.charCodeAt(i);if(a.length!==f.size)throw Error('Dateigröße stimmt nicht mit dem gespeicherten Stand überein.');const url=URL.createObjectURL(new Blob([a],{type:f.mime}));fileCache.set(f.id,url);return url}

async function openFile(i){const n=active();previewMode=adminMode;showPublic();const token=galleryToken;await drawGallery(n,token);let offset=0;for(let j=0;j<i;j++){try{offset+=(await manifest(n.links[j])).length}catch{offset++}}if(token===galleryToken)return zoom(offset)}
function previewFile(i){if(!allowed())return;return openFile(i)}
window.ecwResults={version,normalize,safeUrl,merge,detectMime,fileMeta,prepareSave,galleryLayout,zoom,closeZoom,galleryMove,open,close,home,admin,preview,previewBack,enter,go,back,setNode,setLink,addFolder,addLink,reorder,moveFolder:(i,d)=>move('children',i,d),moveLink:(i,d)=>move('links',i,d),removeFolder:i=>remove('children',i),removeLink:i=>remove('links',i),importSeed,saveFirebase,upload,openFile,previewFile};
})();
