
const APP_VERSION='2.9.57';
const APP_VERSION_URL='version.json';
(function ecwVersionCheck(){
  if(!/^https?:$/.test(location.protocol))return;
  fetch(APP_VERSION_URL+'?t='+Date.now(),{cache:'no-store'})
    .then(r=>r.ok?r.json():null)
    .then(v=>{
      const latest=String(v?.version||'').trim();
      if(!latest||latest===APP_VERSION)return;
      const u=new URL(location.href);
      if(u.searchParams.get('v')===latest)return;
      u.searchParams.set('v',latest);
      location.replace(u.toString());
    }).catch(()=>{});
})();

const DBKEY='verein_info_test_v2';
const OLD_DBKEY='verein_info_test_v1';
const DEFAULT_DB={tournaments:{},ownTournaments:{},pressReports:{},news:[],photos:[],photoAlbums:{},settings:{tournamentPerPage:12},users:[{id:'admin',name:'Administrator',protected:true}]};
let wbLiveStartlisten=[];let wbLiveStartlistenUnsub=null;
let data=JSON.parse(localStorage.getItem(DBKEY)||'null');
if(!data){try{data=JSON.parse(localStorage.getItem(OLD_DBKEY)||'null')}catch(e){data=null}}
data=data||JSON.parse(JSON.stringify(DEFAULT_DB));
data.tournaments=data.tournaments||{};data.ownTournaments=data.ownTournaments||{};data.pressReports=data.pressReports||{};data.news=data.news||[];data.photos=data.photos||[];data.photoAlbums=data.photoAlbums||{};data.sponsorPhotos=data.sponsorPhotos||[];data.sponsorPhotoAlbums=data.sponsorPhotoAlbums||{};data.settings=data.settings||{};data.settings.tournamentPerPage=Number(data.settings.tournamentPerPage)||12;data.users=Array.isArray(data.users)&&data.users.length?data.users:[{id:'admin',name:'Administrator',protected:true}];if(!data.users.some(u=>u.id==='admin'))data.users.unshift({id:'admin',name:'Administrator',protected:true});{let hadPw=false;data.users.forEach(u=>{if(u&&'password' in u){delete u.password;hadPw=true}});if(hadPw){try{localStorage.setItem(DBKEY,JSON.stringify(data))}catch(e){}}}
const TP_PLAYER_NAMES=[];
const TP_SEED_EVENTS=[];
data.tournamentPlanner=Array.isArray(data.tournamentPlanner)?data.tournamentPlanner:[];
if(!data.settings.tpSeeded){data.settings.tpSeeded=true;}
data.tournamentPlannerTypes=(Array.isArray(data.tournamentPlannerTypes)&&data.tournamentPlannerTypes.length)?data.tournamentPlannerTypes:['Turnier','Meisterschaft','Feier','Gremlins'];

const T_COLLECTIONS={
  tournaments:{store:'tournaments',prefix:'t',fb:'tournamentInvitations',label:'Turniereinladungen',singular:'Einladung'},
  ownTournaments:{store:'ownTournaments',prefix:'o',fb:'ownTournamentInvitations',label:'Eigene Turniereinladungen',singular:'Einladung'},
  pressReports:{store:'pressReports',prefix:'zr',fb:'pressReports',label:'Zeitungsberichte EC Wegscheid',singular:'Bericht'}
};
let tCollection='tournaments';
function tCfg(){return T_COLLECTIONS[tCollection]||T_COLLECTIONS.tournaments}
const P_COLLECTIONS={
  photos:{items:'photos',albums:'photoAlbums',prefix:'p',fb:'photos',label:'Fotos für Diashow',view:'photos',contentEl:'photoContent',monthEl:'photoMonth',prevBtn:'photoPrev',nextBtn:'photoNext'},
  sponsorPhotos:{items:'sponsorPhotos',albums:'sponsorPhotoAlbums',prefix:'sp',fb:'sponsorPhotos',label:'Fotos Sponsoren für Diashow',view:'sponsorPhotos',contentEl:'sponsorPhotoContent',monthEl:'sponsorPhotoMonth',prevBtn:'sponsorPhotoPrev',nextBtn:'sponsorPhotoNext'}
};
let pCollection='photos';
function pCfg(){return P_COLLECTIONS[pCollection]||P_COLLECTIONS.photos}
function pItems(){const k=pCfg().items;return data[k]||(data[k]=[])}
function pAlbums(){const k=pCfg().albums;return data[k]||(data[k]={})}
function tInfoElId(){return tCollection==='ownTournaments'?'firebaseOwnTournamentInfo':(tCollection==='pressReports'?'firebasePressReportInfo':'firebaseTournamentInfo')}
function tFileInputId(){return tCollection==='pressReports'?'zrfiles':'tfiles'}
const PRESS_REPORTS_GROUP='__alle__';
function normalizePressReportsFlat(){
  data.pressReports=data.pressReports||{};
  const flat=[],seen=new Set();
  for(const key of Object.keys(data.pressReports)){
    for(const item of (data.pressReports[key]||[])){
      if(!item)continue;
      const marker=String(item.mediaId||item.id||item.data||'')+'|'+String(item.mediaId2||item.data2||'');
      if(marker&&seen.has(marker))continue;
      if(marker)seen.add(marker);
      flat.push(item);
    }
  }
  data.pressReports={[PRESS_REPORTS_GROUP]:flat};
  data.settings=data.settings||{};
  delete data.settings.pressReportFolders;
  return flat;
}
function tStore(){
  const k=tCfg().store;
  if(k==='pressReports')normalizePressReportsFlat();
  return data[k]||(data[k]={});
}
function pressFolderList(){normalizePressReportsFlat();return [PRESS_REPORTS_GROUP]}
function pressEnsureFolder(){normalizePressReportsFlat();if(!Array.isArray(data.pressReports[PRESS_REPORTS_GROUP]))data.pressReports[PRESS_REPORTS_GROUP]=[];return PRESS_REPORTS_GROUP}
function pressFolderLabel(){return 'Zeitungsberichte'}
function tGroupLabel(k){return tCollection==='pressReports'?'Zeitungsberichte':monthLabel(k)}
function updateTournamentTitles(){
 const l=(tCollection==='ownTournaments')?'Nächste eigene Turniere':tCfg().label;
 const a=document.getElementById('tMonthsTitle');if(a)a.textContent=l;
 const b=document.getElementById('tTitle');if(b)b.textContent=l;
 const sub=document.getElementById('tMonthsSubtitle');if(sub)sub.textContent=tCollection==='pressReports'?'Alle Berichte':'Monatsübersicht';
}
function openOwnTournamentsReleased(){
  if(!canViewApp('o')){showToast('Eigene Turniere sind nicht freigegeben.',4000);return;}
  window.__adminPreviewMode=false;
  openTournamentSection('ownTournaments');
}
function openTournamentSection(kind){
 const perm=kind==='ownTournaments'?'o':'t';
 if(!canViewApp(perm)){showToast('Dieser Bereich ist für diesen Benutzer nicht freigegeben.',4000);return;}
 if(kind!=='pressReports')window.__adminPreviewMode=false;
 tCollection=(kind==='ownTournaments'||kind==='pressReports')?kind:'tournaments';
 currentPage=0;adminTournamentPage=0;
 if(tCollection==='pressReports'){
   normalizePressReportsFlat();
   currentMonth=PRESS_REPORTS_GROUP;
   showView('tournaments');
   return;
 }
 currentMonth=null;
 showView(tCollection==='ownTournaments'?'tournaments':'tournamentMonths');
}
function openTournamentMonthsOverview(){window.__adminPreviewMode=false;tCollection='tournaments';currentMonth=null;currentPage=0;adminTournamentPage=0;showView('tournamentMonths');}
function tpOpenTournamentPlannerView(scrollToCurrent=true){
  // Navigation bewusst vom Rendern trennen.
  showView('tournamentPlanner');

  if(scrollToCurrent){
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        try{tpScrollToCurrentEntry();if(window.matchMedia('(max-width:800px)').matches)setTimeout(tpScrollToCurrentEntry,180)}catch(e){console.error('Aktueller Termin:',e)}
      });
    });
  }
}

function openTournamentListDirect(){
  // Direkt in die Turnierlisten-Anzeige. Nur wenn eine Anmeldung möglich ist
  // (Firebase-Auth vorhanden), wird sie auch verlangt; sonst bleibt die Liste
  // im Nur-Ansicht-Modus erreichbar.
  window.__adminPreviewMode=false;
  try{ if(window.firebaseAuth){ loginPurpose='planner'; } }catch(e){}
  tpOpenTournamentPlannerView(true);
}
let currentMonth=null,currentPage=0,adminTournamentPage=0,newsTimer=null,newsIndex=0,photoAlbumMonth=null,photoTimer=null,photoScrollTimer=null,currentUser=null;
let pdfPendingFiles=[],pdfPendingIndex=0,pdfSelectedPages=new Set(),editingNewsId=null;

// Version 2.5.2: Medien liegen in IndexedDB, nicht im begrenzten localStorage.
const MEDIA_DB='verein_info_media_v123',MEDIA_STORE='files';
let mediaObjectUrls=[];
function openMediaDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window))return reject(new Error('IndexedDB nicht verfügbar'));const r=indexedDB.open(MEDIA_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(MEDIA_STORE))r.result.createObjectStore(MEDIA_STORE,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function mediaPut(id,blob){return openMediaDB().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA_STORE,'readwrite');tx.objectStore(MEDIA_STORE).put({id,blob});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}}))}
function mediaGet(id){return openMediaDB().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA_STORE,'readonly');const r=tx.objectStore(MEDIA_STORE).get(id);r.onsuccess=()=>{db.close();resolve(r.result?.blob||null)};r.onerror=()=>{db.close();reject(r.error)}}))}
function mediaDelete(id){if(!id)return Promise.resolve();return openMediaDB().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA_STORE,'readwrite');tx.objectStore(MEDIA_STORE).delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}}))}
function mediaAll(){return openMediaDB().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA_STORE,'readonly');const r=tx.objectStore(MEDIA_STORE).getAll();r.onsuccess=()=>{db.close();resolve(r.result||[])};r.onerror=()=>{db.close();reject(r.error)}}))}
function mediaClear(){return openMediaDB().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA_STORE,'readwrite');tx.objectStore(MEDIA_STORE).clear();tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}}))}
function dataUrlToBlob(u){const a=u.split(',');const h=a[0]||'',b=a[1]||'';const m=(h.match(/data:([^;]+)/)||[])[1]||'application/octet-stream';const bin=atob(b),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:m})}
function mediaId(prefix,id){return 'media_'+prefix+'_'+String(id)}
async function storeMedia(prefix,id,dataUrl){const id2=mediaId(prefix,id);await mediaPut(id2,dataUrlToBlob(dataUrl));const url=URL.createObjectURL(dataUrlToBlob(dataUrl));mediaObjectUrls.push(url);return {id:id2,url}}
function allMediaItems(){const a=[];['tournaments','ownTournaments','pressReports'].forEach(key=>{const kind=key==='ownTournaments'?'o':(key==='pressReports'?'zr':'t');Object.keys(data[key]||{}).forEach(m=>(data[key][m]||[]).forEach(x=>{if(x)a.push({kind,item:x})}))});(data.photos||[]).forEach(x=>{if(x)a.push({kind:'p',item:x})});(data.sponsorPhotos||[]).forEach(x=>{if(x)a.push({kind:'sp',item:x})});return a}
async function migrateLegacyMedia(){let migrated=0;for(const {kind,item} of allMediaItems()){if(item.data&&String(item.data).startsWith('data:')){try{const id=mediaId(kind,item.id||Date.now()+Math.random());await mediaPut(id,dataUrlToBlob(item.data));item.mediaId=id;migrated++;}catch(e){console.error(e)}}}if(migrated){save();showToast(migrated+' große Datei(en) in den neuen Speicher übernommen')}}
async function hydrateMedia(){
 for(const {item} of allMediaItems()){
  if(item.mediaId && !(item.data&&String(item.data).startsWith('data:'))){
   try{const blob=await mediaGet(item.mediaId);if(blob){const previous=item.data;item.data=URL.createObjectURL(blob);mediaObjectUrls.push(item.data);if(previous&&String(previous).startsWith('blob:'))URL.revokeObjectURL(previous);}}catch(e){console.error('Medien laden:',e);}
  }
  if(item.mediaId2 && !(item.data2&&String(item.data2).startsWith('data:'))){
   try{const blob2=await mediaGet(item.mediaId2);if(blob2){const previous2=item.data2;item.data2=URL.createObjectURL(blob2);mediaObjectUrls.push(item.data2);if(previous2&&String(previous2).startsWith('blob:'))URL.revokeObjectURL(previous2);}}catch(e){console.error('Zweite Medienseite laden:',e);}
  }
 }
}
function stripMediaData(x){if(!x||typeof x!=='object')return x;const c={};for(const k in x){if(k!=='data'&&k!=='data2')c[k]=x[k]}return c}
function save(){
  try{
    // Nur Metadaten in localStorage: Bilddaten (data) bleiben draußen. Es wird nichts geklont,
    // und leere Plätze (null/Lücken in den Listen) führen nicht mehr zum Abbruch.
    const meta={};
    for(const k in data){if(k!=='tournaments'&&k!=='ownTournaments'&&k!=='pressReports'&&k!=='photos'&&k!=='sponsorPhotos')meta[k]=data[k]}
    meta.tournaments={};meta.ownTournaments={};meta.pressReports={};
    ['tournaments','ownTournaments','pressReports'].forEach(key=>{Object.keys(data[key]||{}).forEach(m=>{meta[key][m]=Array.from(data[key][m]||[],x=>x?stripMediaData(x):null)})});
    meta.photos=Array.from(data.photos||[],x=>x?stripMediaData(x):null);
    meta.sponsorPhotos=Array.from(data.sponsorPhotos||[],x=>x?stripMediaData(x):null);
    localStorage.setItem(DBKEY,JSON.stringify(meta));
    return true;
  }catch(e){
    console.error(e);
    const full=e&&(e.name==='QuotaExceededError'||/quota/i.test(e.message||''));
    showToast('Speichern fehlgeschlagen: '+(full?'Browser-Speicher (localStorage) ist voll':(e?.message||e)),6000);
    return false;
  }
}
async function showStorageInfo(){const el=document.getElementById('storageInfo');if(!el)return;try{const all=await mediaAll(),bytes=all.reduce((n,x)=>n+(x.blob?.size||0),0);el.innerHTML='Gespeicherte Dateien: <b>'+all.length+'</b><br>Belegter Dateispeicher: <b>'+((bytes/1024/1024).toFixed(1))+' MB</b>'; }catch(e){el.textContent='IndexedDB ist in diesem Browser nicht verfügbar.'}}
async function clearLocalMedia(){if(!confirm('Wirklich alle lokal gespeicherten Bilder und PDF-Seiten löschen?'))return;await mediaClear();['tournaments','ownTournaments','pressReports'].forEach(key=>Object.keys(data[key]||{}).forEach(m=>(data[key][m]||[]).forEach(x=>{if(x){delete x.mediaId;delete x.data;delete x.mediaId2;delete x.data2}})));(data.photos||[]).forEach(x=>{if(x){delete x.mediaId;delete x.data}});(data.sponsorPhotos||[]).forEach(x=>{if(x){delete x.mediaId;delete x.data}});save();renderTournamentAdminList();renderPhotoAdminList();showStorageInfo();showToast('Lokale Bilder und PDF-Seiten wurden gelöscht')}
try{cleanupOldTournaments()}catch(e){console.error('Automatische Bereinigung:',e)}
(async()=>{try{await migrateLegacyMedia();await hydrateMedia()}catch(e){console.error('Medien-Speicher:',e)}})();
// Verhindert, dass der Browser die lokal gespeicherten Bilder bei Platzmangel selbstständig löscht.
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}

function setFirebaseStatus(text,ok=true){
  const el=document.getElementById('firebaseStatus');
  if(el){el.textContent=text;el.style.color=ok?'#b7f7c0':'#ffb0b0';}
}
function dataUrlFromBlob(blob){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);
  });
}
async function getLocalTournamentDataUrl(item){
  if(item?.data && String(item.data).startsWith('data:')) return item.data;
  if(item?.mediaId){
    const b=await mediaGet(item.mediaId);
    if(b)return await dataUrlFromBlob(b);
  }
  return '';
}
async function getLocalTournamentDataUrl2(item){
  if(item?.data2 && String(item.data2).startsWith('data:')) return item.data2;
  if(item?.mediaId2){
    const b=await mediaGet(item.mediaId2);
    if(b)return await dataUrlFromBlob(b);
  }
  return '';
}
function firebaseDocId(month,index,item){
  return String(month).replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+String(index)+'_'+String(item?.id||'x').replace(/[^a-zA-Z0-9_-]/g,'_');
}
const FIREBASE_MAX_CHARS=900000; // Firestore-Dokumente dürfen max. ~1 MiB groß sein
let pendingMediaDeletes=[];
function fbTimeout(promise,ms,what){
  let t;
  return Promise.race([promise,new Promise((_,reject)=>{t=setTimeout(()=>{const e=new Error('Zeitüberschreitung bei '+(what||'Firebase')+' – bitte Internetverbindung prüfen');e.code='timeout';reject(e)},ms)})]).finally(()=>clearTimeout(t));
}
function firebaseErrorText(e){
  const c=e?.code||'',m=e?.message||'';
  if(c==='permission-denied'||/permission|insufficient/i.test(m))return 'Keine Berechtigung – die Firestore-Regeln erlauben das Schreiben nicht';
  if(c==='timeout'||c==='aborted'||c==='unavailable')return m||'Firebase nicht erreichbar';
  if(c==='resource-exhausted')return 'Firebase-Kontingent erschöpft';
  if(c==='invalid-argument'||/too large|size/i.test(m))return 'Eine Datei ist für Firebase zu groß';
  return m||String(e||'Unbekannter Fehler');
}
function fileToImage(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Bild konnte nicht gelesen werden'));i.src=src})}
async function shrinkDataUrlForFirebase(dataUrl){
  try{const img=await fileToImage(dataUrl);return await compressInvitationImage(img)}
  catch(e){console.warn('Bild konnte vor Firebase nicht verkleinert werden',e);return dataUrl}
}
function comparePhotos(a,b){return String(a.month).localeCompare(String(b.month))||((a.order||0)-(b.order||0))}
async function removeFirebaseDocsNotInSet(collectionName, desiredIds){
 const snap=await fbTimeout(firestoreDb.collection(collectionName).get(),60000,'Firebase (Lesen)');
 const stale=[];snap.forEach(doc=>{if(!desiredIds.has(doc.id))stale.push(doc.ref)});
 if(!stale.length)return;
 // Schutz vor Datenverlust: Ist lokal gar nichts mehr vorhanden, wird vor dem Leeren von Firebase nachgefragt.
 if(!desiredIds.size&&!confirm('Lokal sind keine Einträge vorhanden. Wirklich alle '+stale.length+' Einträge in Firebase ('+collectionName+') löschen?')){
   const e=new Error('Löschen in Firebase abgebrochen');e.code='aborted';throw e;
 }
 await fbTimeout(Promise.all(stale.map(r=>r.delete())),60000,'Firebase (Löschen)');
}
let pdfJsPromise=null;
function loadPdfJs(){
  if(window.pdfjsLib)return Promise.resolve(true);
  if(pdfJsPromise)return pdfJsPromise;
  const sources=[
    ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'],
    ['https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js']
  ];
  pdfJsPromise=(async()=>{
    for(const [lib,worker] of sources){
      try{
        await new Promise((res,rej)=>{const sc=document.createElement('script');sc.src=lib;sc.onload=res;sc.onerror=()=>{sc.remove();rej(new Error('nicht ladbar'))};document.head.appendChild(sc)});
        if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc=worker;return true}
      }catch(e){console.warn('PDF.js-Quelle nicht erreichbar:',lib)}
    }
    return false;
  })();
  pdfJsPromise.then(ok=>{if(!ok)pdfJsPromise=null});
  return pdfJsPromise;
}

async function shrinkDataUrlToMax(dataUrl,maxChars){
 if(!dataUrl||dataUrl.length<=maxChars)return dataUrl;
 try{
   const img=await fileToImage(dataUrl);
   let scale=1,quality=.68,last=dataUrl;
   for(let attempt=0;attempt<18;attempt++){
     const w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));
     const h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
     const c=document.createElement('canvas');c.width=w;c.height=h;
     c.getContext('2d').drawImage(img,0,0,w,h);
     last=c.toDataURL('image/jpeg',quality);
     if(last.length<=maxChars)return last;
     if(quality>.4)quality=Math.max(.4,quality-.06);else scale*=.82;
   }
   return last;
 }catch(e){return dataUrl}
}
async function syncTournamentsToFirebase(){
  const isPressSync=tCollection==='pressReports';
  if(isPressSync)pressReportsSaveInProgress=true;
  try{
  if(!ecwRequireCentralSave(tCfg().label+' speichern'))return {ok:false,error:'Firebase ist nicht verfügbar'};
  const store=tStore();
  const desiredCount=Object.keys(store).reduce((sum,group)=>sum+(store[group]||[]).filter(Boolean).length,0);
  try{await ecwSafetyPreflight(tCfg().fb,desiredCount,tCfg().label);}
  catch(e){const msg=e?.message||String(e);showToast(msg,8000);return {ok:false,error:msg}}
  const info=document.getElementById(tInfoElId());
  if(info)info.textContent='Übertragung wird vorbereitet …';
  try{
    let count=0,failed=0;const desiredIds=new Set();
    for(const group of Object.keys(store).sort()){
      const arr=store[group]||[];
      for(let i=0;i<arr.length;i++){
        const item=arr[i];if(!item)continue;
        let dataUrl=await getLocalTournamentDataUrl(item),dataUrl2=await getLocalTournamentDataUrl2(item);
        if(!dataUrl){failed++;continue;}
        if(dataUrl2){
          dataUrl=await shrinkDataUrlToMax(dataUrl,390000);
          dataUrl2=await shrinkDataUrlToMax(dataUrl2,390000);
        }else if(dataUrl.length>FIREBASE_MAX_CHARS)dataUrl=await shrinkDataUrlForFirebase(dataUrl);
        if(!dataUrl||dataUrl.length>FIREBASE_MAX_CHARS||(dataUrl2&&(dataUrl.length+dataUrl2.length)>850000)){failed++;continue;}
        const id=firebaseDocId(group,i,item);desiredIds.add(id);
        if(info)info.textContent='Übertrage '+(tCollection==='pressReports'?'Bericht ':'Einladung ')+(count+1)+' …';
        const payload={month:group,folder:'',index:i,id:String(item.id||id),name:String(item.name||''),name2:String(item.name2||''),endDate:String(item.endDate||''),data:dataUrl,updatedAt:new Date().toISOString()};
        if(dataUrl2)payload.data2=dataUrl2;
        await fbTimeout(firestoreDb.collection(tCfg().fb).doc(id).set(payload),90000,'Firebase');
        count++;
      }
    }
    await removeFirebaseDocsNotInSet(tCfg().fb,desiredIds);
    const message=count+' '+(tCollection==='pressReports'?'Bericht(e)':'Einladung(en)')+' zu Firebase übertragen'+(failed?' · '+failed+' ohne Datei/zu groß übersprungen':'')+'.';
    if(info)info.textContent=message;
    return {ok:failed===0,count,failed,message};
  }catch(e){
    console.error(e);const error=firebaseErrorText(e);
    if(info)info.textContent='Fehler: '+error;return {ok:false,error};
  }
  }finally{
    if(isPressSync)pressReportsSaveInProgress=false;
  }
}
async function loadTournamentsFromFirebase(){
  if(!firebaseReady||!firestoreDb)return showToast('Firebase ist nicht verbunden');
  const info=document.getElementById(tInfoElId());
  if(info)info.textContent='Firebase-Daten werden geladen …';
  try{
    const snap=await firestoreDb.collection(tCfg().fb).get(),tournaments={};
    if(tCollection==='pressReports'){
      const rows=[];
      snap.forEach(doc=>{
        const x=doc.data()||{};
        if(!x.data)return;
        rows.push({sortGroup:String(x.folder||x.month||''),sortIndex:Number.isFinite(x.index)?x.index:0,sortId:doc.id,item:{id:x.id||doc.id,name:x.name||'',name2:x.name2||'',endDate:x.endDate||'',data:x.data,data2:x.data2||''}});
      });
      rows.sort((a,b)=>a.sortGroup.localeCompare(b.sortGroup,'de')||a.sortIndex-b.sortIndex||a.sortId.localeCompare(b.sortId,'de'));
      tournaments[PRESS_REPORTS_GROUP]=rows.map(r=>r.item);
    }else{
      snap.forEach(doc=>{
        const x=doc.data()||{};
        if(!x.month||!x.data)return;
        (tournaments[x.month]||(tournaments[x.month]=[]))[Number.isFinite(x.index)?x.index:0]={id:x.id||doc.id,name:x.name||'',name2:x.name2||'',endDate:x.endDate||'',data:x.data,data2:x.data2||''};
      });
    }
    data[tCfg().store]=tournaments;
    if(tCollection==='pressReports')normalizePressReportsFlat();
    save();await hydrateMedia();currentMonth=null;currentPage=0;
    renderTournamentAdminList();renderTournamentAdminPreview();
    if(document.getElementById('tournaments')?.classList.contains('active'))renderTournaments();
    const count=Object.values(tournaments).reduce((n,a)=>n+(a||[]).filter(Boolean).length,0);
    if(info)info.textContent=count+' '+(tCollection==='pressReports'?'Bericht(e)':'Einladung(en)')+' aus Firebase geladen.';
    showToast(count+' '+(tCollection==='pressReports'?'Bericht(e)':'Einladung(en)')+' aus Firebase geladen');
  }catch(e){
    console.error(e);if(info)info.textContent='Fehler: '+(e?.message||e);
    showToast('Firebase-Laden fehlgeschlagen: '+(e?.code||'Regeln prüfen'));
  }
}
async function initFirebaseInfo(){
  if(!firebaseReady){setFirebaseStatus('Firebase nicht verfügbar',false);return;}
  try{
    await firestoreDb.collection('tournamentInvitations').limit(1).get();
    setFirebaseStatus('Firebase verbunden · Turniereinladungen können gelesen werden');
  }catch(e){setFirebaseStatus('Firebase verbunden · Zugriff auf Turniereinladungen prüfen',false);}
}
initFirebaseInfo();
if(firebaseReady&&window.firebaseAuth){
 window.firebaseAuth.onAuthStateChanged(async user=>{
   firebaseAuthUser=user||null; window.firebaseAuthUser=firebaseAuthUser;
   if(window.__ecwVerifiedResultUid!==firebaseAuthUser?.uid){
     window.__ecwVerifiedResultUid=null;
     window.__ecwVerifiedWhiteboardUid=null;
   }
   window.__ecwAuthInitialResolved=true;
   window.__ecwAuthInitialUser=firebaseAuthUser;
   if(!user&&!isPublicWhiteboardMode()){
     setTimeout(()=>{
       try{
         if(!window.firebaseAuth?.currentUser){
           loginPurpose='admin';
           showView('login');
         }
       }catch(e){}
     },400);
   }
   if(!user&&currentUser==='admin')currentUser=null;
   const label=document.getElementById('currentUserLabel');
   if(label)label.textContent=user?(user.email||user.uid):'';
   if(!isPublicWhiteboardMode()) await loadAppPermissions(user);
   if(user && (isWhiteboardUser() || isWhiteboardKioskAccount())){
     try{
       localStorage.setItem('ecw_whiteboard_trusted_device','1');
       localStorage.setItem('ecw_whiteboard_last_uid',String(user.uid||''));
       localStorage.setItem('ecw_whiteboard_last_email',String(user.email||''));
     }catch(e){}
   }
   if(!isPublicWhiteboardMode()){
     centralStopListeners();
     if(user){
       await centralFirebaseBootstrap();
       centralStartListeners();
     }
     if(user && !userSwitchPending && prefersPresentationStart()){window.__adminPreviewMode=false;currentUser=null;showView('startseite');}
     if(user) centralSetStatus('Firebase Live · '+(user.email||user.uid)+' · Daueranmeldung aktiv',true);
     else centralSetStatus('Nicht angemeldet',false);
   }
 });
}else{
 updateHomeAdminButton();
}



/* ===== V2.5.2 SICHERHEITSSCHICHT =====
   - Kein "nur lokal gespeichert" bei zentralen Verwaltungsdaten.
   - Vor destruktiven Synchronisationen wird der aktuelle Firebase-Stand geprüft.
   - Vor Turnier-/Nachrichten-Synchronisationen wird automatisch ein lokaler
     Sicherheits-Snapshot in IndexedDB abgelegt.
   - Leere lokale Daten dürfen keine gefüllte Firebase-Collection löschen.
   - Größere Löschdifferenzen müssen bestätigt werden.
*/
const ECW_SAFETY_DB='ecw_safety_snapshots_v1';
const ECW_SAFETY_STORE='snapshots';
let ecwSafetyBusy=false;

function ecwSafetyOpenDB(){
 return new Promise((resolve,reject)=>{
   if(!('indexedDB' in window))return reject(new Error('IndexedDB nicht verfügbar'));
   const r=indexedDB.open(ECW_SAFETY_DB,1);
   r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(ECW_SAFETY_STORE))r.result.createObjectStore(ECW_SAFETY_STORE,{keyPath:'id'})};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Sicherheitsdatenbank konnte nicht geöffnet werden'));
 });
}
async function ecwSafetyStoreSnapshot(collection,docs,reason){
 try{
   const db=await ecwSafetyOpenDB();
   const id=new Date().toISOString()+'_'+collection;
   const row={id,createdAt:new Date().toISOString(),collection,reason:String(reason||''),appVersion:APP_VERSION,docs};
   await new Promise((resolve,reject)=>{
     const tx=db.transaction(ECW_SAFETY_STORE,'readwrite');
     tx.objectStore(ECW_SAFETY_STORE).put(row);
     tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });
   // Maximal 12 Snapshots je Collection behalten.
   const all=await new Promise((resolve,reject)=>{
     const tx=db.transaction(ECW_SAFETY_STORE,'readonly'),rq=tx.objectStore(ECW_SAFETY_STORE).getAll();
     rq.onsuccess=()=>resolve(rq.result||[]);rq.onerror=()=>reject(rq.error);
   });
   const same=all.filter(x=>x.collection===collection).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
   for(const old of same.slice(12)){
     await new Promise((resolve,reject)=>{
       const tx=db.transaction(ECW_SAFETY_STORE,'readwrite');
       tx.objectStore(ECW_SAFETY_STORE).delete(old.id);
       tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
     });
   }
   try{db.close()}catch(e){}
   return true;
 }catch(e){
   console.warn('Sicherheits-Snapshot:',e);
   return false;
 }
}
function ecwSafetyFirebaseAvailable(){
 return !!(firebaseReady&&firestoreDb&&firebaseAuthUser);
}
async function ecwSafetyServerSnapshot(collection,reason){
 if(!ecwSafetyFirebaseAvailable())throw new Error('Firebase ist nicht verbunden oder kein Benutzer ist angemeldet.');
 const snap=await fbTimeout(firestoreDb.collection(collection).get({source:'server'}),45000,'Firebase Sicherheitsprüfung');
 const docs=[];snap.forEach(doc=>docs.push({id:doc.id,data:doc.data()}));
 await ecwSafetyStoreSnapshot(collection,docs,reason);
 return {snap,docs};
}
async function ecwSafetyPreflight(collection,desiredCount,label){
 if(ecwSafetyBusy)throw new Error('Eine Sicherheitsprüfung läuft bereits.');
 if(!ecwSafetyFirebaseAvailable())throw new Error('Nicht gespeichert: Firebase ist nicht verfügbar.');
 if(centralFirebaseOffline)throw new Error('Nicht gespeichert: Die Firebase-Live-Verbindung ist unterbrochen.');
 ecwSafetyBusy=true;
 try{
   const {snap}=await ecwSafetyServerSnapshot(collection,label);
   const remoteCount=snap.size;
   if(remoteCount>0&&desiredCount===0){
     throw new Error('Sicherheitsstopp: Firebase enthält '+remoteCount+' Einträge, lokal wären es 0. Es wurde nichts gelöscht.');
   }
   const removeCount=Math.max(0,remoteCount-desiredCount);
   if(remoteCount>=4 && removeCount>=2 && removeCount/remoteCount>=0.25){
     const ok=confirm(
       'Sicherheitsprüfung '+label+':\n\n'+
       'Firebase aktuell: '+remoteCount+' Einträge\n'+
       'Lokaler Zielstand: '+desiredCount+' Einträge\n\n'+
       'Dadurch könnten bis zu '+removeCount+' Firebase-Einträge entfernt werden.\n\n'+
       'Nur fortfahren, wenn diese Änderung beabsichtigt ist.'
     );
     if(!ok)throw new Error('Vorgang vom Benutzer abgebrochen. Firebase wurde nicht verändert.');
   }
   return {remoteCount};
 }finally{ecwSafetyBusy=false}
}
function ecwRequireCentralSave(action){
 if(!ecwSafetyFirebaseAvailable()){
   showToast((action||'Speichern')+' nicht möglich: Firebase/Anmeldung fehlt.',6000);
   return false;
 }
 if(centralFirebaseOffline){
   showToast((action||'Speichern')+' nicht möglich: Firebase-Verbindung ist unterbrochen.',6000);
   return false;
 }
 return true;
}
window.addEventListener('offline',()=>{try{centralSetStatus('Offline · Änderungen werden nicht zentral gespeichert',false)}catch(e){}});
window.addEventListener('online',()=>{try{centralSetStatus('Internet wieder verfügbar · Firebase wird geprüft …',true)}catch(e){}});

/* ===== V2.5.2: Firebase ist die zentrale Datenquelle =====
   localStorage/IndexedDB dienen nur noch als Cache bzw. Offline-Fallback. */
let centralFirebaseUnsubs=[];
let centralFirebaseReady=false;
let centralFirebaseOffline=false;

function centralStopListeners(){
  for(const u of centralFirebaseUnsubs){try{u()}catch(e){}}
  centralFirebaseUnsubs=[];
}

function centralSetStatus(text,ok=true){
  centralFirebaseOffline=!ok;
  setFirebaseStatus(text,ok);
}

function centralServerGet(collection){
  const ref=firestoreDb.collection(collection);
  return ref.get({source:'server'}).catch(()=>ref.get());
}

function centralApplyTournamentInvitations(snap,own=false){
  const obj={};
  snap.forEach(doc=>{
    const x=doc.data()||{};
    if(!x.month||!x.data)return;
    const i=Number.isFinite(x.index)?x.index:0;
    (obj[x.month]||(obj[x.month]=[]))[i]={
      id:x.id||doc.id,name:x.name||'',endDate:x.endDate||'',data:x.data
    };
  });
  data[own?'ownTournaments':'tournaments']=obj;
  save();
  if((own&&tCollection==='ownTournaments')||(!own&&tCollection==='tournaments')){
    currentPage=0;
    if(document.getElementById('tournamentMonths')?.classList.contains('active'))renderTournamentMonthOverview();
    if(document.getElementById('tournaments')?.classList.contains('active')){
      hydrateMedia().then(()=>initTournaments()).catch(()=>initTournaments());
    }
  }
}

function centralApplyNews(snap){
  const arr=[];
  snap.forEach(doc=>{
    const x=doc.data()||{};
    arr.push({
      id:String(x.id||doc.id),title:String(x.title||''),text:String(x.text||''),
      mode:String(x.mode||'static'),active:x.active!==false,duration:Number(x.duration)||18,
      gap:Number(x.gap??2),showTitle:!!x.showTitle,startDate:String(x.startDate||''),endDate:String(x.endDate||'')
    });
  });
  data.news=arr;save();
  if(document.getElementById('news')?.classList.contains('active'))renderNews();
  if(document.getElementById('newsAdminList'))renderNewsAdminList();
}

function centralApplyPhotos(snap,kind){
  const cfg=P_COLLECTIONS[kind],photos=[],albums={};
  snap.forEach(doc=>{
    const x=doc.data()||{};
    if(x.type==='album'&&x.month)albums[x.month]={name:x.name||'',mode:x.mode||'slideshow',duration:Number(x.duration)||5};
    else if(x.type==='photo'&&x.data)photos.push({
      id:x.id||doc.id,month:String(x.month||'all'),name:x.name||'',data:x.data,
      order:Number.isFinite(x.index)?x.index:0
    });
  });
  photos.sort(comparePhotos);
  data[cfg.items]=photos;data[cfg.albums]=albums;save();
  if(document.getElementById(cfg.view)?.classList.contains('active')){
    pCollection=kind;photoAlbumMonth=null;initPhotos();
  }
  if(pCollection===kind&&document.getElementById('photoAdminList'))renderPhotoAdminList();
}


function tpPlannerStructureSignature(list){
  return JSON.stringify(
    (Array.isArray(list)?list:[])
      .map(x=>({
        id:String(x?.id||''),
        name:String(x?.name||''),
        date:String(x?.date||''),
        time:String(x?.time||''),
        location:String(x?.location||''),
        type:String(x?.type||''),
        internal:!!x?.internal,
        calendarExported:!!x?.calendarExported
      }))
      .sort((a,b)=>a.id.localeCompare(b.id))
  );
}

function tpPatchVisiblePlannerValues(){
  const root=document.getElementById('tpContent');
  if(!root)return false;

  let patched=0;

  root.querySelectorAll('.tp-card[data-tp-id]').forEach(card=>{
    const id=String(card.dataset.tpId||'');
    const item=tpFindEvent(id);
    if(!item)return;

    // Admin/normaler Browser: native Selects
    const reportedSelect=card.querySelector('select[data-tp-field="reportedBy"]');
    if(reportedSelect){
      const wanted=String(item.reportedBy||'');
      if(reportedSelect.value!==wanted)reportedSelect.value=wanted;
      patched++;
    }

    card.querySelectorAll('select[data-tp-field="players"]').forEach(sel=>{
      const idx=Number(sel.dataset.tpPlayerIndex);
      if(!Number.isInteger(idx)||idx<0||idx>3)return;
      const wanted=String((item.players||[])[idx]||'');
      if(sel.value!==wanted)sel.value=wanted;
      patched++;
    });

    // Whiteboard: eigene Buttons, kein natives Select
    const reportedBtn=card.querySelector('button[data-tp-field="reportedBy"]');
    if(reportedBtn){
      const wanted=String(item.reportedBy||'');
      reportedBtn.dataset.tpValue=wanted;
      reportedBtn.textContent=wanted||'– auswählen –';
      patched++;
    }

    card.querySelectorAll('button[data-tp-field="players"]').forEach(btn=>{
      const idx=Number(btn.dataset.tpPlayerIndex);
      if(!Number.isInteger(idx)||idx<0||idx>3)return;
      const wanted=String((item.players||[])[idx]||'');
      btn.dataset.tpValue=wanted;
      btn.textContent=wanted||'– auswählen –';
      patched++;
    });
  });

  return patched>0;
}

function centralApplyTournamentPlanner(snap){
  const previousList=Array.isArray(data.tournamentPlanner)?data.tournamentPlanner:[];
  const previousStructure=tpPlannerStructureSignature(previousList);

  const list=[];
  snap.forEach(doc=>{
    const x=doc.data()||{};
    list.push({
      id:String(x.id||doc.id),name:String(x.name||''),date:String(x.date||''),time:String(x.time||''),
      reportedBy:String(x.reportedBy||''),players:[0,1,2,3].map(i=>String((x.players||[])[i]||'')),
      location:String(x.location||''),type:String(x.type||''),internal:!!x.internal,
      calendarExported:!!x.calendarExported,googleEventId:String(x.googleEventId||''),googleEventCalendarId:String(x.googleEventCalendarId||''),calendarExportedBeforeChange:!!x.calendarExportedBeforeChange,googleEventUpdated:String(x.googleEventUpdated||''),googleSyncedFields:tpGoogleStoredFields(x.googleSyncedFields),updatedAt:String(x.updatedAt||'')
    });
  });

  const nextStructure=tpPlannerStructureSignature(list);
  const structureChanged=previousStructure!==nextStructure;

  data.tournamentPlanner=list;
  save();

  if(!document.getElementById('tournamentPlanner')?.classList.contains('active'))return;

  // WICHTIG:
  // Spieler und "Gemeldet von" werden bei jedem Firebase-Snapshot nur direkt
  // in die bestehenden Select-Felder geschrieben. Dadurch bleibt das DOM der
  // Terminliste unangetastet und der Browser kann nicht auf einen anderen
  // Termin zurückspringen.
  if(isWhiteboardUser() && !structureChanged){
    tpPatchVisiblePlannerValues();

    if(tpWhiteboardEditHoldActive()){
      tpKeepWhiteboardEditPosition();
    }
    return;
  }

  // Nur wenn sich wirklich Termin/Datum/Ort/Art o.ä. geändert haben, muss die
  // komplette Liste neu aufgebaut werden. Dabei wird die aktuelle Position
  // wie bisher erhalten.
  renderTournamentPlanner();
}

function centralTeamsFromSnapshot(snap){
  const teams=[],photos=[];
  snap.forEach(doc=>{
    const x=doc.data()||{};
    if(x.type==='team'&&x.id)teams.push({
      id:x.id,name:x.name||x.id,league:x.league||'',players:Array.isArray(x.players)?x.players:[],
      photos:[],order:Number.isFinite(x.order)?x.order:0
    });
    else if(x.type==='photo'&&x.teamId&&x.data)photos.push(x);
  });
  teams.sort((a,b)=>a.order-b.order);
  photos.sort((a,b)=>(a.index||0)-(b.index||0));
  photos.forEach(p=>{const t=teams.find(t=>t.id===p.teamId);if(t)t.photos.push({id:p.id||('fb_'+p.index),name:p.name||'',data:p.data})});
  teams.forEach(t=>delete t.order);
  return teams;
}
function centralApplyTeams(snap){
  if(teamsSaveInProgress)return;
  const t=centralTeamsFromSnapshot(snap);
  if(!t.length)return;
  teamsData=t;teamsFbTried=true;
  teamsPersist().catch(()=>{});
  if(document.getElementById('teams')?.classList.contains('active'))renderTeamsOverview();
  if(document.getElementById('teamDetail')?.classList.contains('active'))renderTeamDetail();
  if(document.getElementById('teamsAdminList'))renderTeamsAdmin();
}

async function centralLoadNavigation(){
  try{
    const snap=await firestoreDb.collection('appSettings').doc('navigation').get({source:'server'}).catch(()=>firestoreDb.collection('appSettings').doc('navigation').get());
    if(snap.exists){
      const x=snap.data()||{};
      centralNavigationSettings={baseUrl:String(x.baseUrl||''),startseiteUrl:String(x.startseiteUrl||'')};
      try{
        if(centralNavigationSettings.baseUrl)localStorage.setItem('verein_base_url',centralNavigationSettings.baseUrl);
        if(centralNavigationSettings.startseiteUrl)localStorage.setItem('verein_startseite_url',centralNavigationSettings.startseiteUrl);
      }catch(e){}
    }
  }catch(e){console.warn('Navigation Firebase:',e)}
}


let pressReportsSaveInProgress=false;

function pressReportsLocalCount(){
  return Object.values(data.pressReports||{}).reduce((n,a)=>n+(Array.isArray(a)?a.filter(Boolean).length:0),0);
}
function pressReportsSnapshotData(snap){
  const rows=[];
  snap.forEach(doc=>{
    const x=doc.data()||{};
    if(!x.data)return;
    rows.push({
      group:String(x.folder||x.month||''),
      index:Number.isFinite(x.index)?x.index:0,
      docId:doc.id,
      item:{id:x.id||doc.id,name:x.name||'',name2:x.name2||'',data:x.data,data2:x.data2||''}
    });
  });
  rows.sort((a,b)=>a.group.localeCompare(b.group,'de')||a.index-b.index||a.docId.localeCompare(b.docId,'de'));
  const list=rows.map(r=>r.item);
  return {reports:{[PRESS_REPORTS_GROUP]:list},folders:[],count:list.length};
}
function centralApplyPressReports(snap,{source='live'}={}){
  if(pressReportsSaveInProgress && source==='live')return false;

  const remote=pressReportsSnapshotData(snap);
  const localCount=pressReportsLocalCount();

  // WICHTIGER DATENSCHUTZ:
  // Ein leerer Firebase-Stand darf niemals lokale, noch nicht zentral gespeicherte
  // Zeitungsberichte überschreiben.
  if(remote.count===0 && localCount>0){
    console.warn('Zeitungsberichte: Leerer Firebase-Stand ignoriert; lokale Berichte bleiben erhalten.');
    const info=document.getElementById('firebasePressReportInfo');
    if(info)info.textContent='Lokale Zeitungsberichte vorhanden · leerer Firebase-Stand wurde zum Schutz nicht übernommen.';
    return false;
  }

  data.pressReports=remote.reports;
  data.settings=data.settings||{};
  delete data.settings.pressReportFolders;
  normalizePressReportsFlat();
  save();

  if(tCollection==='pressReports'){
    currentPage=0;
    if(document.getElementById('tournamentMonths')?.classList.contains('active'))renderTournamentMonthOverview();
    if(document.getElementById('tournaments')?.classList.contains('active'))renderTournaments();
    if(document.getElementById('tAdminList'))renderTournamentAdminList();
    if(document.getElementById('tAdminPreview'))renderTournamentAdminPreview();
  }
  return true;
}
async function centralFirebaseBootstrap(){
  if(!firebaseReady||!firestoreDb||!firebaseAuthUser)return false;
  centralSetStatus('Firebase · zentrale Daten werden geladen …',true);
  try{
    const jobs=[];
    if(canViewApp('t')){
      jobs.push(centralServerGet('tournamentInvitations').then(s=>centralApplyTournamentInvitations(s,false)));
      jobs.push(centralServerGet('pressReports').then(snap=>centralApplyPressReports(snap,{source:'bootstrap'})));
    }
    if(canViewApp('o')) jobs.push(centralServerGet('ownTournamentInvitations').then(s=>centralApplyTournamentInvitations(s,true)));
    if(canViewApp('n')) jobs.push(centralServerGet('news').then(centralApplyNews));
    if(canViewApp('p')) jobs.push(centralServerGet('photos').then(s=>centralApplyPhotos(s,'photos')));
    if(canViewApp('sp')) jobs.push(centralServerGet('sponsorPhotos').then(s=>centralApplyPhotos(s,'sponsorPhotos')));
    if(canViewApp('tp')) jobs.push(centralServerGet('tournamentPlanner').then(centralApplyTournamentPlanner));
    if(canViewApp('m')) jobs.push(centralServerGet('teams').then(centralApplyTeams));
    if(canViewApp('sh')) jobs.push(shLoadFromFirebase(false));
    jobs.push(loadExternalLinkPreferences());
    jobs.push(centralLoadNavigation());
    jobs.push(loadWhiteboardResultPermissions());
    await Promise.allSettled(jobs);
    centralFirebaseReady=true;
    centralFirebaseOffline=false;
    centralSetStatus('Firebase zentral · '+(firebaseAuthUser.email||firebaseAuthUser.uid),true);
    return true;
  }catch(e){
    console.error('Zentrale Firebase-Initialisierung:',e);
    centralSetStatus('Offline · letzter zwischengespeicherter Stand',false);
    return false;
  }
}

function centralStartListeners(){
  centralStopListeners();
  if(!firebaseReady||!firestoreDb||!firebaseAuthUser)return;
  const watch=(collection,apply)=>{
    try{
      const unsub=firestoreDb.collection(collection).onSnapshot(
        snap=>{try{apply(snap);centralSetStatus('Firebase Live · '+(firebaseAuthUser.email||firebaseAuthUser.uid),true)}catch(e){console.error('Live-Auswertung '+collection,e)}},
        err=>{console.warn('Live '+collection,err);centralSetStatus('Offline/Live-Verbindung unterbrochen · Cache wird angezeigt',false)}
      );
      centralFirebaseUnsubs.push(unsub);
    }catch(e){console.warn('Listener '+collection,e)}
  };
  if(canViewApp('t')){
    watch('tournamentInvitations',s=>centralApplyTournamentInvitations(s,false));
    watch('pressReports',snap=>centralApplyPressReports(snap,{source:'live'}));;
  }
  if(canViewApp('o'))watch('ownTournamentInvitations',s=>centralApplyTournamentInvitations(s,true));
  if(canViewApp('n'))watch('news',centralApplyNews);
  if(canViewApp('p'))watch('photos',s=>centralApplyPhotos(s,'photos'));
  if(canViewApp('sp'))watch('sponsorPhotos',s=>centralApplyPhotos(s,'sponsorPhotos'));
  if(canViewApp('tp'))watch('tournamentPlanner',centralApplyTournamentPlanner);
  if(canViewApp('m'))watch('teams',centralApplyTeams);

  try{
    centralFirebaseUnsubs.push(firestoreDb.collection('appSettings').doc('startseite').onSnapshot(snap=>{
      if(!snap.exists)return;
      const x=snap.data()||{},cfg=x.config||x.startseite||x;
      SH=shSane(cfg);shFirebaseUpdatedAt=x.updatedAt||'';shFirebaseUpdatedBy=x.updatedBy||'';
      shFirebaseDirty=false;shSave(false);shRender();
    }));
  }catch(e){}
  try{
    centralFirebaseUnsubs.push(firestoreDb.collection('appSettings').doc('navigation').onSnapshot(snap=>{
      if(!snap.exists)return;
      const x=snap.data()||{};
      centralNavigationSettings={baseUrl:String(x.baseUrl||''),startseiteUrl:String(x.startseiteUrl||'')};
    }));
  }catch(e){}
  try{
    centralFirebaseUnsubs.push(firestoreDb.collection('linkPreferences').doc('config').onSnapshot(snap=>{
      externalLinkPreferences=snap.exists?(snap.data()?.entries||{}):{};
      try{shRender()}catch(e){}
    }));
  }catch(e){}
  try{
    centralFirebaseUnsubs.push(firestoreDb.collection('appSettings').doc('whiteboardFreigaben').onSnapshot(snap=>{
      if(!snap.exists)whiteboardResultPermissions={...WHITEBOARD_RESULT_DEFAULTS};
      else{
        const x=snap.data()||{};
        whiteboardResultPermissions={
          cup:x.cup!==false,
          jahresmeisterschaft:x.jahresmeisterschaft!==false,
          auslosung:x.auslosung!==false,
          stockdart:x.stockdart===true,
          soloPyramide:x.soloPyramide!==false
        };
      }
      try{shRender()}catch(e){}
      if(document.getElementById('wbPermCup'))renderWhiteboardPermissionsAdmin();
    }));
  }catch(e){}
}
let permissionsFlight=null,permissionsFlightUid=null;
function loadAppPermissions(user){
 const uid=user?.uid||null;
 if(permissionsFlight&&permissionsFlightUid===uid)return permissionsFlight;
 permissionsFlightUid=uid;
 const task=readAppPermissions(user);
 permissionsFlight=task;
 task.finally(()=>{if(permissionsFlight===task){permissionsFlight=null;permissionsFlightUid=null;}});
 return task;
}
async function readAppPermissions(user){
  appPermissions={};
  if(!user||!firestoreDb){window.appPermissions=appPermissions;applyAppPermissionsUI();return;}
  try{
    const ref=firestoreDb.collection('users').doc(user.uid);
    const snap=await ref.get();
    if(!snap.exists){
      // Ein fehlendes Profil wird nie automatisch zum Administrator erhoben.
      const base={uid:user.uid,email:user.email||'',name:user.displayName||user.email||user.uid,admin:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      Object.keys(APP_PERMISSIONS).forEach(k=>base[k]=false);base.whiteboard=false;
      await ref.set(base);
      appPermissions=base;
    }else appPermissions=snap.data()||{};
    if(appPermissions.admin)Object.keys(APP_PERMISSIONS).forEach(k=>appPermissions[k]=true);
  }catch(e){console.error('Berechtigungen konnten nicht geladen werden:',e);showToast('Berechtigungen konnten nicht geladen werden',5000)}
  window.appPermissions=appPermissions;applyAppPermissionsUI();
  // Only after the permissions have been loaded can the design configuration
  // be read reliably; otherwise an arbitrary timer may miss the admin login.
  if(appPermissions.admin===true && typeof ECWConfig!=='undefined'){
    try{await ECWConfig.load()}catch(e){console.warn('Design konnte nicht geladen werden',e)}
  }
}
function hasAppPermission(k){
 if(!firebaseAuthUser)return false;
 if(appPermissions.admin===true)return true;
 if(isWhiteboardUser()&&!k.endsWith('View')&&k!=='tp')return false;
 return appPermissions[k]===true||(k==='shView'&&appPermissions.sh===true);
}

const WHITEBOARD_KIOSK_EMAIL='informationssystem@ec-wegscheid.de';
function isWhiteboardKioskAccount(){
 return String(firebaseAuthUser?.email||'').toLowerCase()===WHITEBOARD_KIOSK_EMAIL;
}
function updateWhiteboardKioskUI(){
 const publicWb=isPublicWhiteboardMode();
 const logoutBtn=document.getElementById('adminLogoutBtn');
 if(logoutBtn)logoutBtn.hidden=publicWb;
 const loginBtn=document.getElementById('shUserLogin');
 if(loginBtn){
   loginBtn.hidden=false;
   loginBtn.textContent='Benutzer anmelden';
   loginBtn.title=publicWb?'Anmeldung: 5-mal kurz berühren':'Benutzer anmelden';
 }
}
function isWhiteboardUser(){
 if(isPublicWhiteboardMode())return true;
 if(!firebaseAuthUser||appPermissions.admin===true)return false;
 if(appPermissions.whiteboard===true)return true;
 // V2.9.1: Firestore-Profile mit role='whiteboard' ebenfalls als
 // Whiteboard erkennen. Ohne diese Prüfung wurde die Solo-Pyramide beim
 // erneuten Öffnen nicht mit der bereits verifizierten Sitzung gestartet.
 if(String(appPermissions.role||'').trim().toLowerCase()==='whiteboard')return true;
 // Kompatibilität mit dem zuerst angelegten Profil ohne Whiteboard-Feld.
 return !Object.prototype.hasOwnProperty.call(appPermissions,'whiteboard')
   && appPermissions.shView===true && appPermissions.tp===true
   && !['tv','jm','t','o','n','p','sp','mv','m','lk','sh'].some(k=>appPermissions[k]===true);
}
function prefersPresentationStart(){return !!(firebaseAuthUser&&appPermissions.admin!==true&&canViewApp('sh'));}
function canViewApp(k){
 const editKey=k==='shView'?'sh':k;
 if(isPublicWhiteboardMode())return PRESENTATION_PERMISSIONS.includes(editKey);
 return hasAppPermission(editKey)||hasAppPermission(editKey+'View')||(isWhiteboardUser()&&PRESENTATION_PERMISSIONS.includes(editKey));
}
function canChangeOwnPassword(){return !!(firebaseAuthUser && !isWhiteboardUser());}
function applyPasswordUI(){document.querySelectorAll('[data-user-password]').forEach(el=>{el.hidden=!canChangeOwnPassword();});}

function applyAppPermissionsUI(){
  updateWhiteboardScreenControls();
  applyPasswordUI();
  document.querySelectorAll('[data-global-admin]').forEach(el=>{el.hidden=appPermissions.admin!==true;el.disabled=appPermissions.admin!==true;});
  document.querySelectorAll('[data-app-perm]').forEach(el=>{
    const k=el.dataset.appPerm, ok=hasAppPermission(k);
    el.disabled=!ok; el.classList.toggle('app-disabled',!ok); el.setAttribute('aria-disabled',String(!ok));
    if(!ok)el.title='Für diesen Benutzer nicht freigegeben';
  });
  const vsMenu=document.getElementById('vsAdminMenuRow');if(vsMenu)vsMenu.style.display=hasAppPermission('vs')&&!isWhiteboardUser()?'flex':'none';
  const twMenu=document.getElementById('twAdminMenuRow');if(twMenu)twMenu.style.display=hasAppPermission('tw')?'flex':'none';
  updateHomeAdminButton();
  updateWhiteboardKioskUI();
  try{if(typeof shRender==='function')shRender()}catch(e){}
}
const APP_BACKUP_COLLECTIONS=['users','tournamentPlanner','tournamentInvitations','ownTournamentInvitations','pressReports','news','photos','sponsorPhotos','teams','turniere','vereine','meldungen','einstellungen','ecw','linkPreferences','appSettings','soloPyramide','liveStartlisten','turnierauswertung','turnierWirtschaftlichkeit','turnierWirtschaftlichkeitSicherungen'];
let appBackupBusy=false;
function backupDateLabel(){return new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date()).replace(/\./g,'_');}
function backupEncode(value){
 if(value===null||typeof value!=='object')return value;
 if(value instanceof firebase.firestore.Timestamp)return {__ecwType:'timestamp',seconds:value.seconds,nanoseconds:value.nanoseconds};
 if(value instanceof firebase.firestore.GeoPoint)return {__ecwType:'geopoint',latitude:value.latitude,longitude:value.longitude};
 if(value instanceof firebase.firestore.DocumentReference)return {__ecwType:'reference',path:value.path};
 if(value instanceof firebase.firestore.Blob)return {__ecwType:'bytes',base64:value.toBase64()};
 if(Array.isArray(value))return value.map(backupEncode);
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,backupEncode(v)]));
}
function backupCrc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function backupZip(entries){
 const encoder=new TextEncoder(),parts=[],central=[];let offset=0,total=0;
 for(const entry of entries){
  const name=encoder.encode(entry.name),bytes=typeof entry.content==='string'?encoder.encode(entry.content):entry.content;
  const crc=backupCrc32(bytes),head=new Uint8Array(30+name.length),h=new DataView(head.buffer);
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);head.set(name,30);
  const cd=new Uint8Array(46+name.length),c=new DataView(cd.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);cd.set(name,46);
  parts.push(head,bytes);central.push(cd);offset+=head.length+bytes.length;total+=cd.length;
  if(offset+total>0xffffffff)throw new Error('Sicherung ist zu groß für dieses ZIP-Format.');
 }
 if(entries.length>65535)throw new Error('Zu viele Sicherungsdateien.');
 const tail=new Uint8Array(22),t=new DataView(tail.buffer);t.setUint32(0,0x06054b50,true);t.setUint16(8,entries.length,true);t.setUint16(10,entries.length,true);t.setUint32(12,total,true);t.setUint32(16,offset,true);
 return new Blob([...parts,...central,tail],{type:'application/zip'});
}
function backupDownload(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function backupBlobDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('Lokale Mediendatei nicht lesbar.'));reader.readAsDataURL(blob);});}
let appLocalRestoreFiles={};
async function selectAppLocalRestore(kind,file){
 if(appPermissions.admin!==true||!file)return;
 try{const value=JSON.parse(await file.text());if(kind==='settings'&&(!value.storage||typeof value.storage!=='object'))throw Error('Keine lokale Einstellungssicherung.');if(kind==='media'&&!Array.isArray(value))throw Error('Keine lokale Mediensicherung.');appLocalRestoreFiles[kind]=value;document.getElementById('localRestoreStatus').textContent=kind==='settings'?'Einstellungen geladen.':'Mediensicherung geladen.';}catch(e){appLocalRestoreFiles[kind]=null;document.getElementById('localRestoreStatus').textContent=e.message;}
}
async function restoreAppLocalBackup(){
 if(appPermissions.admin!==true||appBackupBusy)return;
 const status=document.getElementById('localRestoreStatus'),settings=appLocalRestoreFiles.settings,media=appLocalRestoreFiles.media;
 if(!settings||!media){status.textContent='Bitte beide JSON-Dateien auswählen.';return;}
 if(!confirm('Lokale App-Einstellungen und gleichnamige Medien dieses Browsers durch die Sicherung ersetzen? Firebase-Daten bleiben unverändert.'))return;
 appBackupBusy=true;
 try{
  const validated=media.map(item=>{if(typeof item.id!=='string'||typeof item.dataUrl!=='string'||!item.dataUrl.startsWith('data:'))throw Error('Ungültige Mediendatei.');return {id:item.id,blob:dataUrlToBlob(item.dataUrl)};});
  for(const item of validated)await mediaPut(item.id,item.blob);
  for(const key of [DBKEY,OLD_DBKEY,SH_KEY,TEAMS_KEY,'verein_base_url','verein_startseite_url','verein_admin_email'])if(Object.prototype.hasOwnProperty.call(settings.storage,key)){const value=settings.storage[key];if(value===null)localStorage.removeItem(key);else if(typeof value==='string')localStorage.setItem(key,value);else throw Error('Ungültiger lokaler Wert: '+key);}
  location.reload();
 }catch(e){status.textContent='Lokale Wiederherstellung nicht vollständig abgeschlossen: '+e.message;}
 finally{appBackupBusy=false;}
}


function renderStorageAdminHtml(){
 return '<div class="card" style="margin-top:14px"><h3>Speicher verwalten</h3><p class="small">Lokaler Dateispeicher dieses Browsers: Bilder und PDF-Seiten in IndexedDB. Das Löschen betrifft nur diesen Browser und ersetzt keine Firebase-Datensicherung.</p><div id="storageInfo" class="small" style="margin:10px 0">Speicher wird ermittelt …</div><div class="row"><button type="button" class="primary" onclick="showStorageInfo()">Speicher aktualisieren</button><button type="button" class="danger" onclick="clearLocalMedia()">Alle lokalen Bilder/PDF-Seiten löschen</button></div></div>';
}

function renderBackupAdmin(){
 if(appPermissions.admin!==true)return;
 document.getElementById('adminMain').innerHTML='<h2>Datensicherung – Version '+APP_VERSION+'</h2><div class="card"><p>Die App-Sicherung enthält alle von dieser App verwendeten Firestore-Sammlungen, Benutzerprofile mit Rechten, die vollständigen Mitgliederdaten und die lokalen Einstellungen und Medien dieses Browsers.</p><button class="primary" id="appBackupButton" onclick="exportAppBackup()">App-Daten als ZIP sichern</button> <button id="memberBackupButton" onclick="exportMemberBackup()">Mitglieder als JSON sichern</button><p id="appBackupStatus" role="status"></p><p class="small">Die Dateien tragen das Sicherungsdatum. Firebase-Anmeldekonten samt Passwort-Hashes, veröffentlichte Regeln, Indizes und eventuell separat verwendete Storage-Dateien sind zusätzlich nach der Anleitung im Sicherungspaket zu sichern. Während des Exports bitte keine Daten ändern.</p></div><details class="card" style="margin-top:12px"><summary>Lokale Browserdaten wiederherstellen</summary><p>Aus der Sicherungs-ZIP Lokale_Einstellungen und Lokale_Medien auswählen. Firebase-Daten werden hierdurch nicht geändert.</p><label>Lokale Einstellungen (JSON)<input type="file" accept=".json" onchange="selectAppLocalRestore(\'settings\',this.files[0])"></label><label>Lokale Medien (JSON)<input type="file" accept=".json" onchange="selectAppLocalRestore(\'media\',this.files[0])"></label><button onclick="restoreAppLocalBackup()">Lokale Daten wiederherstellen und App neu laden</button><p id="localRestoreStatus" role="status"></p></details>' +renderStorageAdminHtml();
 showStorageInfo();
}
async function exportMemberBackup(){
 if(appPermissions.admin!==true||appBackupBusy)return;
 appBackupBusy=true;const status=document.getElementById('appBackupStatus');
 try{if(status)status.textContent='Mitgliederdaten werden geladen …';const snap=await firestoreDb.collection('ecw').doc('state').get({source:'server'});if(!snap.exists)throw new Error('ecw/state fehlt. Zuerst die vollständigen Mitgliederdaten übernehmen.');const state=snap.data();if(!Array.isArray(state.members))throw new Error('Ungültige Mitgliederdaten.');backupDownload(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'Mitglieder_Sicherung_'+backupDateLabel()+'.json');if(status)status.textContent=state.members.length+' Mitglieder gesichert.';}
 catch(e){if(status)status.textContent='Sicherung fehlgeschlagen: '+e.message;}
 finally{appBackupBusy=false;}
}
async function exportAppBackup(){
 if(appPermissions.admin!==true||appBackupBusy)return;
 appBackupBusy=true;const status=document.getElementById('appBackupStatus'),button=document.getElementById('appBackupButton');if(button)button.disabled=true;
 try{
  const startedAt=new Date().toISOString(),documents=[],counts={},skippedCollections=[];
  for(const name of APP_BACKUP_COLLECTIONS){
   if(status)status.textContent='Sichere '+name+' …';
   try{
    // Sammlungen mit dokumentbezogenen Firestore-Regeln gezielt auslesen.
    // Eine Collection-Abfrage wäre dort trotz erlaubtem Dokumentzugriff gesperrt.
    const fixedDocs={
      ecw:['state','publicMembers'],
      linkPreferences:['config'],
      soloPyramide:['state']
    };
    if(Object.prototype.hasOwnProperty.call(fixedDocs,name)){
      counts[name]=0;
      for(const id of fixedDocs[name]){
        if(status)status.textContent='Sichere '+name+'/'+id+' …';
        const doc=await firestoreDb.collection(name).doc(id).get({source:'server'});
        if(doc.exists){counts[name]++;documents.push({path:name+'/'+id,data:backupEncode(doc.data())});}
      }
    }else{
      const snap=await firestoreDb.collection(name).get({source:'server'});
      counts[name]=snap.size;
      snap.forEach(doc=>documents.push({path:doc.ref.path,data:backupEncode(doc.data())}));
    }
   }catch(collectionError){
     const reason=collectionError?.message||String(collectionError);
     const code=collectionError?.code||'unbekannter Fehler';
     if(['turnierWirtschaftlichkeit','turnierWirtschaftlichkeitSicherungen'].includes(name) && (code==='permission-denied'||/missing or insufficient permissions/i.test(reason))){
       skippedCollections.push(name);counts[name]='NICHT GESICHERT (Firebase-Berechtigung fehlt)';continue;
     }
     throw new Error('Firestore-Zugriff bei „'+name+'“ fehlgeschlagen ('+code+'): '+reason);
   }
  }
  const members=documents.find(d=>d.path==='ecw/state');
  if(!members||!Array.isArray(members.data.members))throw new Error('Vollständige Mitgliederdaten fehlen (ecw/state). Keine vollständige App-Sicherung erstellt.');
  const label=backupDateLabel(),entries=[];
  const add=(name,data)=>entries.push({name,content:JSON.stringify(data,null,2)});
  add('Firestore_Sicherung_'+label+'.json',{format:'ecw-firestore-v1',appVersion:APP_VERSION,projectId:firebaseConfig.projectId,startedAt,completedAt:new Date().toISOString(),collections:APP_BACKUP_COLLECTIONS.filter(name=>!skippedCollections.includes(name)),skippedCollections,documents});
  add('Mitglieder_Sicherung_'+label+'.json',members.data);
  add('Benutzer_und_Rechte_'+label+'.json',documents.filter(d=>d.path.startsWith('users/')));
  const local={};for(const key of [DBKEY,OLD_DBKEY,SH_KEY,TEAMS_KEY,'verein_base_url','verein_startseite_url','verein_admin_email'])local[key]=localStorage.getItem(key);
  add('Lokale_Einstellungen_'+label+'.json',{storage:local,currentData:data,startseite:SH,teams:teamsData});
  if(status)status.textContent='Sichere lokale Bilder und Dokumente …';
  const media=await mediaAll(),mediaEntries=[];
  for(const item of media){if(!item.blob)throw new Error('Lokale Mediendatei ohne Inhalt: '+item.id);mediaEntries.push({id:item.id,dataUrl:await backupBlobDataUrl(item.blob)});}
  add('Lokale_Medien_'+label+'.json',mediaEntries);
  add('Sicherungsprotokoll_'+label+'.json',{appVersion:APP_VERSION,projectId:firebaseConfig.projectId,startedAt,completedAt:new Date().toISOString(),collections:counts,skippedCollections,localMediaCount:media.length,scope:'Alle zugänglichen bekannten Sammlungen der App und lokale App-Daten dieses Browsers; nicht gesicherte Sammlungen stehen unter skippedCollections.',excluded:['Firebase Authentication samt Passwort-Hashes','veröffentlichte Regeln und Indizes','Cloud Storage außerhalb der App','Realtime Database','Hosting','andere Browser und Geräte'],consistentSnapshot:false});
  entries.push({name:'HINWEISE.txt',content:(skippedCollections.length?'ACHTUNG: Nicht gesicherte Sammlungen: '+skippedCollections.join(', ')+'. Diese Finanzdaten bitte separat sichern, sobald Firebase-Berechtigungen eingerichtet sind.\n\n':'')+'App-Datensicherung '+APP_VERSION+'. Mit dem Versionspaket gemeinsam aufbewahren. Authentication-Konten separat exportieren. Die Mitglieder-JSON kann bei fehlendem ecw/state über die Übernahmefunktion eingelesen werden. Für eine vollständige Wiederherstellung siehe Anleitung. Benutzerrechte sind Firestore-Profile; sie enthalten keine Firebase-Anmeldepasswörter.'});
  backupDownload(backupZip(entries),'EC_Wegscheid_App_Datensicherung_'+label+'.zip');
  if(status)status.textContent=(skippedCollections.length?'Teilsicherung erstellt! NICHT gesichert: '+skippedCollections.join(', ')+'. ':'Sicherung erstellt: ')+documents.length+' Dokumente, '+members.data.members.length+' Mitglieder, '+media.length+' lokale Mediendateien. ZIP im Downloadordner gemeinsam mit dem Versionspaket ablegen.';
 }catch(e){if(status)status.textContent='Sicherung abgebrochen: '+e.message;}
 finally{appBackupBusy=false;if(button)button.disabled=false;}
}

async function saveUserPermissions(uid,patch){
  if(!appPermissions.admin||!firestoreDb||!uid)return;
  await firestoreDb.collection('users').doc(uid).set({...patch,updatedAt:new Date().toISOString()},{merge:true});
  if(uid===firebaseAuthUser.uid){appPermissions={...appPermissions,...patch};window.appPermissions=appPermissions;applyAppPermissionsUI()}
}
function openUserRightsAdmin(){
  if(!appPermissions.admin)return;
  const a=document.getElementById('adminMain');
  a.innerHTML=
    '<h2>Benutzer, Rechte und Datensicherung</h2>'+
    '<div class="card" style="margin-bottom:14px">'+
      '<h3 style="margin-top:0">📱 Mobilzugang – Smartphone & Tablet</h3>'+
      '<p class="small">Ein gemeinsamer QR-Code führt zu einer einfachen mobilen Übersicht mit vier Bereichen: Turnierverwaltung, Vereinsnachrichten, neuen Termin/Turnier anlegen und Ziel Jahresmeisterschaft eingeben. Welche Bereiche ein Benutzer sieht, wird über die Rechte unten gesteuert.</p>'+
      '<iframe src="mobile-zugang.html?qr=1&v=2.5.2" title="QR-Code Mobilzugang" style="width:100%;max-width:760px;height:500px;border:0;border-radius:12px;background:transparent;display:block;margin:10px auto"></iframe>'+
      '<div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap">'+
        '<button type="button" onclick="window.open(\'mobile-zugang.html?v=2.5.2\',\'_blank\')">Mobilzugang öffnen</button>'+
      '</div>'+
    '</div>'+
    '<div class="card" style="margin-bottom:14px"><h3>Kontoverwaltung & Datensicherung</h3><div class="row" style="gap:9px;flex-wrap:wrap"><button type="button" onclick="openUserPassword()" '+(canChangeOwnPassword()?'':'disabled')+'>Benutzerkennwort ändern</button><button type="button" class="primary" onclick="openBackupFromUserRights()">Datensicherung öffnen</button></div><p class="small">Die Datensicherung ist nur für Administratoren verfügbar. Das eigene Kennwort kann mit einem persönlichen Konto geändert werden.</p></div>'+
    '<div class="card"><h3>Benutzerkonten</h3><p class="small">Hier werden die in Firestore angelegten Benutzerprofile mit ihren Rechten angezeigt. Die vollständige Liste der Firebase-Authentication-Konten ist aus einer Browser-Webseite aus Sicherheitsgründen nicht abrufbar.</p><div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="primary" onclick="openNewFirebaseUserHelp()">+ Neuen Benutzer hinzufügen</button><button type="button" onclick="loadUserRightsAdmin()">Benutzerliste aktualisieren</button></div><div id="userCreateHelp" style="display:none;margin:12px 0" class="small"></div><div id="userRightsList">Benutzer werden geladen …</div></div>' +
    '<div id="wbPermissionsEmbedded" style="margin-top:20px"></div>';
  renderWhiteboardPermissionsAdmin(document.getElementById('wbPermissionsEmbedded'));
  loadUserRightsAdmin();
}
function openBackupFromUserRights(){
 if(appPermissions.admin!==true)return;
 renderBackupAdmin();
 const root=document.getElementById('adminMain');
 if(root){const b=document.createElement('button');b.type='button';b.textContent='← Zurück zu Benutzer, Rechte und Datensicherung';b.onclick=openUserRightsAdmin;b.style.marginBottom='12px';root.prepend(b);}
}
function openNewFirebaseUserHelp(){
 if(!appPermissions.admin)return;
 const el=document.getElementById('userCreateHelp');if(!el)return;
 const project=String(firebaseConfig?.projectId||'');
 const url='https://console.firebase.google.com/project/'+encodeURIComponent(project)+'/authentication/users';
 el.style.display='block';
 el.innerHTML='<b>Neues Konto sicher anlegen:</b><ol><li>Firebase Authentication öffnen und „Nutzer hinzufügen“ wählen.</li><li>E-Mail-Adresse und sicheres Startkennwort eintragen.</li><li>Den neuen Benutzer einmal in der Vereinsverwaltung anmelden lassen, damit das Firestore-Profil erstellt wird.</li><li>Hier „Benutzerliste aktualisieren“ drücken und die gewünschten Rechte vergeben.</li></ol><p><a href="'+url+'" target="_blank" rel="noopener noreferrer">Firebase Authentication – Benutzer öffnen ↗</a></p><p>Das Anlegen von Authentication-Konten direkt aus dem Browser ohne geschützten Serverdienst wäre nicht ausreichend gegen unbefugte Registrierung abgesichert. Deshalb ist diese Funktion bewusst als geführter Administrationsablauf ausgeführt.</p>';
}
async function loadUserRightsAdmin(){
  const el=document.getElementById('userRightsList');if(!el)return;
  const accountName=u=>String(u.username||u.userName||u.benutzername||u.displayName||u.name||u.email?.split('@')[0]||'').trim();
  const showRows=rows=>{
    rows.sort((a,b)=>accountName(a).localeCompare(accountName(b),'de'));
    const loggedIn=firebaseAuthUser?.email||'';
    el.innerHTML='<p class="small">Angemeldet: <b>'+esc(firebaseAuthUser?.displayName||loggedIn||'–')+'</b>. Nachfolgend die in Firestore verfügbaren Benutzerprofile ('+rows.length+').</p>'+
      (rows.map(u=>'<div class="card" style="margin-top:10px"><div><b>Benutzername: '+esc(accountName(u)||'Nicht hinterlegt')+'</b></div><div class="small">'+esc(u.email||'Keine E-Mail im Profil')+' · Rolle: '+esc(u.admin?'Administrator':u.whiteboard?'Whiteboard':'Benutzer')+'</div><details open><summary class="small" style="cursor:pointer">Berechtigungen für diesen Benutzer</summary><div class="small">UID: '+esc(u.id)+'</div><label><input type="checkbox" '+(u.whiteboard?'checked':'')+' onchange="changeUserPermission(\''+esc(u.id)+'\',\'whiteboard\',this.checked)"> Whiteboard</label><label style="display:block;margin-top:8px"><input type="checkbox" '+(u.admin?'checked':'')+' onchange="changeUserPermission(\''+esc(u.id)+'\',\'admin\',this.checked)"> Administrator</label><div class="perm-apps">'+Object.entries(APP_PERMISSIONS).map(([k,n])=>'<label><input type="checkbox" '+(u[k]?'checked':'')+' '+(u.admin?'disabled':'')+' onchange="changeUserPermission(\''+esc(u.id)+'\',\''+k+'\',this.checked)"> '+esc(n)+'</label>').join('')+'</div></details></div>').join('')||'<p class="small">Keine Firestore-Benutzerprofile abrufbar. Das ist keine vollständige Firebase-Authentication-Benutzerliste.</p>');
  };
  try{
    const snap=await firestoreDb.collection('users').get();
    const rows=[];snap.forEach(d=>rows.push({id:d.id,...d.data()}));
    showRows(rows);
  }catch(e){
    // Falls Firestore nur den eigenen Profilzugriff erlaubt, keine fremden Konten vortäuschen.
    try{const uid=firebaseAuthUser?.uid;if(!uid)throw e;const own=await firestoreDb.collection('users').doc(uid).get();showRows(own.exists?[{id:own.id,...own.data()}]:[]);el.insertAdjacentHTML('beforeend','<p class="small">Die übrigen Profile konnten aufgrund der Firestore-Berechtigungen nicht geladen werden. Für die vollständige Benutzerliste ist eine sichere Administratorfunktion nötig.</p>');}
    catch(err){el.textContent='Fehler beim Laden der Benutzer: '+(e.message||e)}
  }
}
async function changeUserPermission(uid,key,value){
  if(!appPermissions.admin)return;
  try{await saveUserPermissions(uid,{[key]:value});await loadUserRightsAdmin()}catch(e){alert('Recht konnte nicht gespeichert werden: '+(e.message||e))}
}
function showToast(s,ms){const t=document.getElementById('toast');t.textContent=s;t.style.display='block';clearTimeout(t._timer);t._timer=setTimeout(()=>t.style.display='none',ms||2800)}
async function enterPresentationFullscreen(){
 try{
  if(document.fullscreenElement)return;
  if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({navigationUI:'hide'});
 }catch(e){console.log('Vollbildmodus konnte nicht aktiviert werden:',e)}
}
async function leavePresentationFullscreen(){
 if(isWhiteboardUser())return;
 try{if(document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();}catch(e){}
}
function adminPreviewOpen(kind){
  if(kind==='solo'){
    if(appPermissions.admin!==true){showToast('Solo Pyramide · Vorschau ist nur für Administratoren freigegeben.',5000);return;}
    openSoloPyramidePreview();
    return;
  }
  const perm=(kind==='zr'?'t':kind==='docs'||kind==='ergebnisse'?'sh':kind);
  if(!canViewApp(perm)){showToast('Dieser Bereich ist für Sie nicht freigegeben.',4000);return;}
  if(kind==='ergebnisse'){ecwResults.preview();return;}
  if(kind==='t'){ openTournamentSection('tournaments'); window.__adminPreviewMode=true; }
  else if(kind==='o'){ openTournamentSection('ownTournaments'); window.__adminPreviewMode=true; }
  else if(kind==='tp'){ if(firebaseAuthUser||isPublicWhiteboardMode()){tpOpenTournamentPlannerView(true);window.__adminPreviewMode=true;}else{showToast('Bitte zuerst anmelden.');} }
  else if(kind==='n'){ openPublicSection('news'); window.__adminPreviewMode=true; }
  else if(kind==='p'){ openPublicSection('photos'); window.__adminPreviewMode=true; }
  else if(kind==='sp'){ openPublicSection('sponsorPhotos'); window.__adminPreviewMode=true; }
  else if(kind==='m'){ openTeams().then(()=>{window.__adminPreviewMode=true}); }
  else if(kind==='sh'){ window.__ecwAdminHomeReturn=true; window.__adminPreviewMode=true; shOpen=-1; showView('startseite'); shRender(); shUpdateBack(); }
  else if(kind==='docs'){ window.__adminPreviewMode=true; ecwDocsOpen(null,true); }
  else if(kind==='tv'){ window.__adminPreviewMode=true; showView('turnierverwaltung'); updateAdminPreviewBackButtons(); try{enterPresentationFullscreen()}catch(e){} }
  else if(kind==='mv'){ window.__adminPreviewMode=true; openMemberManagement(); }
  else if(kind==='zr'){ window.__adminPreviewMode=true; openTournamentSection('pressReports'); }
  updateAdminPreviewBackButtons();
}
let userSwitchPending=false;
async function switchUserLogin(){
 window.__ecwAdminHomeReturn=false;
 if(isPublicWhiteboardMode()){
   try{
     const u=new URL(location.href);
     u.searchParams.delete('whiteboard');
     u.searchParams.set('login','1');
     u.hash='';
     location.href=u.href;
     return;
   }catch(e){}
 }
 userSwitchPending=true;
 window.__adminPreviewMode=false;loginPurpose='switch';
 showView('login');
 const password=document.getElementById('firebaseLoginPassword');if(password)password.value='';
 const email=document.getElementById('firebaseLoginEmail');if(email){email.value='';email.focus();}
 const status=document.getElementById('firebaseLoginStatus');if(status)status.textContent='Anderen Benutzer anmelden oder mit Abbrechen zur Startseite zurückkehren.';
}
function cancelUserLogin(){
 userSwitchPending=false;loginPurpose='admin';
 const pw=document.getElementById('firebaseLoginPassword');if(pw)pw.value='';
 if(firebaseAuthUser&&canViewApp('sh')){window.__adminPreviewMode=false;showView('startseite');return;}
 const status=document.getElementById('firebaseLoginStatus');if(status)status.textContent='Bitte zuerst anmelden, um die Startseite zu öffnen.';
}

function openAdminFromHome(){
 if(window.__ecwAdminHomeReturn){returnToAdminManagementView();return;}
 if(isWhiteboardUser()||isPublicWhiteboardMode()){window.__adminPreviewMode=false;showView('startseite');return;}
  if(firebaseAuthUser){ showView('admin'); return; }
  loginPurpose='admin';
  showView('login');
}
function openTournamentPlannerGate(){
  window.__adminPreviewMode=false;
  if(isPublicWhiteboardMode() && canViewApp('tp')){tpOpenTournamentPlannerView(true);return;}
  if(firebaseAuthUser && canViewApp('tp')){tpOpenTournamentPlannerView(true);return;}
  if(firebaseAuthUser){showToast('Turnierplaner nicht freigegeben.',4000);return;}
  loginPurpose='planner';
  showView('login');
}
function updateHomeAdminButton(){
  const b=document.getElementById('homeAdminButton');
  if(!b)return;
  b.hidden=isWhiteboardUser()||isPublicWhiteboardMode();
  if(firebaseAuthUser || currentUser==='admin'){ b.textContent='🔐 Verwaltung (angemeldet)'; b.title='Verwaltung öffnen'; }
  else { b.textContent='🔐 Verwaltung'; b.title='Administrator anmelden'; }
}

function openPublicSection(id){
  const pm={news:'n',photos:'p',sponsorPhotos:'sp'}; if(pm[id]&&!canViewApp(pm[id])){showToast('Dieser Bereich ist für diesen Benutzer nicht freigegeben.',4000);return;}
  try{
    if(!window.__ecwAdminHomeReturn)window.__adminPreviewMode=false;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    const el=document.getElementById(id);
    if(!el)return;
    el.classList.add('active');
    if(id==='startseite'&&shOpen!==-1){shOpen=-1;try{shRender()}catch(e){}}
    if(['news','photos','sponsorPhotos'].includes(id)) enterPresentationFullscreen();
    if(id==='links') { try{ shRenderExternalLinks(); }catch(e){ console.error('Linksanzeige:',e); } }
    if(id==='news') { try{ renderNews(); }catch(e){ console.error('Nachrichtenanzeige:',e); } }
    if(id==='photos'||id==='sponsorPhotos') { pCollection=(id==='sponsorPhotos')?'sponsorPhotos':'photos'; loadPhotoPresentation(pCollection).catch(e=>console.error('Fotoanzeige:',e)); }
  }catch(e){console.error('Navigation:',e);}
}

/* ===== Version 2.5.2: Startseite-Rücksprung, Mannschaften, Link-Erzeugung ===== */
const STARTSEITE_DEFAULT='index.html#startseite';
const BASE_DEFAULT=new URL("",window.ECW_SITE_BASE||location.href).href;
let centralNavigationSettings={baseUrl:'',startseiteUrl:''};
function getStartseiteUrl(){
 try{
   return String(centralNavigationSettings.startseiteUrl||localStorage.getItem('verein_startseite_url')||'').trim()||STARTSEITE_DEFAULT;
 }catch(e){return centralNavigationSettings.startseiteUrl||STARTSEITE_DEFAULT}
}

/* ===== Startseite (integriert) ===== */
const SH_BG='assets/startseite-standard.jpg';
const SH_KEY='ecw-startseite-v1';
const SH_B=new URL("",window.ECW_SITE_BASE||location.href).href;
const SOLO_PYRAMIDE_PAGE=SH_B+'solo-pyramide.html?v=2.5.2';
// V2.9.13: Die Verbands-/Regelwerk-Links werden zusammen mit der Startseite
// im bereits vorhandenen Firebase-Dokument appSettings/startseite gespeichert.
// Damit bleiben bestehende Firebase-Regeln und Whiteboard-Leserechte unveraendert.
const SH_DEFAULT_LINKS=[
 {t:'Kreis 107',u:'https://kreis107.de/'},
 {t:'Kreis 102',u:'https://www.kreis102.de/'},
 {t:'Bezirk 1',u:'https://www.bev-bezirk1.de/'},
 {t:'BEV Bayern',u:'https://bev-eissport.de/eisstocksport/'},
 {t:'DESV',u:'https://www.eisstock-verband.com/'},
 {t:'IFI-Eisstock',u:'https://www.icestock.sport/'},
 {t:'Landesverband OÖ Turniere',u:'https://www.ooe-stocksport.at/turniere/'},
 {t:'Belegungsplan Eishalle Waldkirchen',u:'https://kreis107.de/onewebmedia/Belegungsplan%202026_2027%20einzel.pdf'},
 {t:'IFI-Regelbuch 2022',u:'https://www.icestock.sport/wp-content/uploads/2025/01/IFI-Official-Rules-Book.pdf'},
 {t:'Stocksportvideos',u:'https://www.stocksportnews.at/html/videos.htm'}
];
function shValidExternalLink(u){
 try{const x=new URL(String(u||'').trim());return /^https?:$/.test(x.protocol)&&!!x.hostname;}
 catch(e){return false;}
}
function shRenderExternalLinks(){
 const grid=document.querySelector('#links .links-grid');if(!grid)return;
 grid.replaceChildren();
 (SH.links||[]).forEach(item=>{
   const title=String(item.t||'').trim(),url=String(item.u||'').trim();
   if(!title||!shValidExternalLink(url))return;
   const a=document.createElement('a');a.className='linkbtn';a.textContent=title;
   a.href=url;a.target='_blank';a.rel='noopener noreferrer';
   grid.appendChild(a);
 });
 if(!grid.children.length){
   const hint=document.createElement('p');hint.className='small';
   hint.textContent='Zurzeit sind keine Links hinterlegt.';grid.appendChild(hint);
 }
}
const SH_DEF={title:'Informationssystem',cols:3,bg:null,links:SH_DEFAULT_LINKS,buttons:[
{t:'Turnier-\neinladungen',u:SH_B+'#turniere-monatsuebersicht'},{t:'Termin\nKalender',u:SH_B+'#turnierliste'},
{t:'Bahn\nReservierung',u:'https://ecwegscheid.github.io/Reservierungssystem/'},{t:'Homepage',u:'https://www.ec-wegscheid.de/'},
{t:'Mannschaften',u:SH_B+'#mannschaften'},{t:'Vereins\nVeranstaltungen',u:SH_B+'#nachrichten'},{t:'Google',u:'https://www.google.de/'},
{t:'Sponsoren',u:SH_B+'#fotos-sponsoren'},{t:'Links',u:SH_B+'#links'},
{t:'Ergebnisse\nTurniere Intern',u:'',sub:[
 {t:'Cupauswertung',u:new URL("turnierauswertung.html?v=2.5.2&seite=cup",window.ECW_SITE_BASE||location.href).href},
 {t:'Jahresmeisterschaft Ziel',u:new URL("turnierauswertung.html?v=2.5.2&seite=jahresmeisterschaft",window.ECW_SITE_BASE||location.href).href},
 {t:'Turnierauslosung',u:new URL("turnierauswertung.html?v=2.5.2&seite=auslosung",window.ECW_SITE_BASE||location.href).href},
 {t:'Stockdartauswertung',u:new URL("turnierauswertung.html?v=2.5.2&seite=stockdart",window.ECW_SITE_BASE||location.href).href},
 {t:'Solo Pyramide',u:SOLO_PYRAMIDE_PAGE},
 {t:'Doppel KO System',u:SH_B+'turnierauswertung.html?seite=doppelko'}
]},
{t:'Fotos\nVerein',u:SH_B+'#fotos'},
{t:'Mitgliederliste\nGeburtstage',u:SH_B+'#mitglieder'},{t:'Eigene Turniere',u:SH_B+'#eigene-turniere'},{t:'Nützliches',u:''}]};

function shEnsureSoloPyramide(d){
 if(!d||!Array.isArray(d.buttons))return d;
 const norm=s=>String(s||'').toLowerCase().replace(/[^a-zäöüß0-9]+/g,' ').trim();
 const integratedResultUrl=(value)=>{
   try{
     const u=new URL(String(value||''),location.href);
     let mode=(u.searchParams.get('seite')||'').toLowerCase();

     if(!mode){
       const vv=String(u.searchParams.get('v')||'');
       const mm=vv.match(/\?seite=(cup|doppelko|jahresmeisterschaft|auslosung|stockdart)/i);
       if(mm)mode=mm[1].toLowerCase();
     }

     const legacy=u.origin==='https://ecwegscheid.github.io'
       && /^\/Turnierverwaltung\/?$/i.test(u.pathname);
     const local=u.origin==='https://ecwegscheid.github.io'
       && /^\/Vereinsverwaltung-Aktuell\/turnierauswertung\.html$/i.test(u.pathname);

     if((legacy||local) && ['cup','doppelko','jahresmeisterschaft','auslosung','stockdart'].includes(mode)){
       return SH_B+'turnierauswertung.html?v=2.5.2&seite='+encodeURIComponent(mode);
     }
   }catch(e){}
   return value;
 };
 d.buttons.forEach(b=>{
   if(b && typeof b.u==='string')b.u=integratedResultUrl(b.u);
   if(Array.isArray(b?.sub))b.sub.forEach(x=>{if(x&&typeof x.u==='string')x.u=integratedResultUrl(x.u)});
 });
 let target=d.buttons.find(b=>{
   const n=norm(b?.t);
   return n==='ergebnisse turniere intern'||(n.includes('ergebnisse')&&n.includes('turniere')&&n.includes('intern'));
 });
 if(!target){
   target=d.buttons.find(b=>norm(b?.t)==='ergebnisse cups');
   if(target)target.t='Ergebnisse\nTurniere Intern';
 }
 if(!target)return d;
 if(!Array.isArray(target.sub))target.sub=[];
 const exists=target.sub.some(x=>norm(x?.t)==='solo pyramide'||String(x?.u||'').toLowerCase().includes('solo-pyramide'));
 if(!exists)target.sub.push({t:'Solo Pyramide',u:SOLO_PYRAMIDE_PAGE});
 if(!target.sub.some(x=>norm(x?.t)==='doppel ko system'||/seite=doppelko/i.test(String(x?.u||''))))target.sub.push({t:'Doppel KO System',u:SH_B+'turnierauswertung.html?seite=doppelko'});
 return d;
}
function shSane(j){const d=JSON.parse(JSON.stringify(SH_DEF));j=j||{};
 if(Array.isArray(j.links))d.links=j.links.filter(x=>x&&typeof x.t==='string'&&typeof x.u==='string').slice(0,100).map(x=>({t:x.t.slice(0,150),u:x.u.slice(0,2048)}));
 if(typeof j.title==='string')d.title=j.title;
 if([2,3,4].includes(+j.cols))d.cols=+j.cols;
 if(typeof j.bg==='string'&&j.bg.startsWith('data:image/'))d.bg=j.bg;
 if(Array.isArray(j.buttons))d.buttons=j.buttons.filter(b=>b&&typeof b.t==='string').map(b=>{const o={t:b.t,u:typeof b.u==='string'?b.u:''};
  if(Array.isArray(b.sub)){const sb=b.sub.filter(x=>x&&typeof x.t==='string').map(x=>({t:x.t,u:typeof x.u==='string'?x.u:''}));if(sb.length)o.sub=sb}
  return o});
 if(j.docMenuInitialized===true)d.docMenuInitialized=true;
 if(!d.docMenuInitialized){
   if(!d.buttons.some(b=>String(b.u||'').includes('#druckdokumente')||b.sub?.some(x=>String(x.u||'').includes('#druckdokumente'))))
     d.buttons.push({t:'Dokumente\nDrucken',u:'',sub:[
       {t:'Vereinsdokumente',u:'#druckdokumente-verein'},
       {t:'Turnierunterlagen',u:'#druckdokumente-turnier'},
       {t:'Formulare',u:'#druckdokumente-formulare'}]});
   d.docMenuInitialized=true;
 }
 if(window.ecwResults){
  d.results=window.ecwResults.normalize(j.results);
  if(j.resultsMenuInitialized!==true){
   if(!d.buttons.some(b=>String(b.u||'').endsWith('#ecw-ergebnisse')))d.buttons.push({t:'Ergebnisse',u:'#ecw-ergebnisse'});
  }
  if(j.resultsPositionVersion!==2){
   const at=d.buttons.findIndex(b=>String(b.u||'').endsWith('#ecw-ergebnisse'));
   if(at>=0){const result=d.buttons.splice(at,1)[0];const news=d.buttons.findIndex(b=>/vereins\s*veranstaltungen/i.test(String(b.t||''))||String(b.u||'').endsWith('#nachrichten'));const google=d.buttons.findIndex(b=>/^google$/i.test(String(b.t||'').trim()));d.buttons.splice(news>=0?news+1:google>=0?google:d.buttons.length,0,result)}
  }
  d.resultsPositionVersion=2;
  d.resultsMenuInitialized=true;
 }
 if(window.ecwUtility)window.ecwUtility.normalize(d,j);
 return shEnsureSoloPyramide(d)}
let SH=(function(){try{return shSane(JSON.parse(localStorage.getItem(SH_KEY)))}catch(e){return shSane({})}})();


/* ===== V2.5.2: zentrale Startseiten-Speicherung in Firebase =====
   Lokal bleibt weiterhin eine Zwischensicherung im Browser bestehen.
   Die freigegebene/produktive Startseite liegt zentral in Firestore. */
const SH_FB_COLLECTION='appSettings';
const SH_FB_DOC='startseite';
let shFirebaseDirty=false;
let shFirebaseBusy=false;
let shFirebaseUpdatedAt='';
let shFirebaseUpdatedBy='';

function shSave(markDirty=true){
 try{
   localStorage.setItem(SH_KEY,JSON.stringify(SH));
   if(markDirty)shMarkDirty();
 }catch(e){showToast('Speichern nicht möglich (Bild evtl. zu groß)')}
}
function shMarkDirty(){
 shFirebaseDirty=true;
 shUpdateFirebaseStatus();
}
function shFormatFirebaseTime(v){
 if(!v)return '';
 try{
   const d=new Date(v);
   if(Number.isNaN(d.getTime()))return String(v);
   return d.toLocaleString('de-DE');
 }catch(e){return String(v)}
}
function shUpdateFirebaseStatus(message){
 const el=document.getElementById('shFirebaseStatus');
 if(!el)return;
 if(message){el.textContent=message;return;}
 if(shFirebaseBusy){el.textContent='Firebase wird verarbeitet …';return;}
 if(shFirebaseDirty){
   el.textContent='Ungespeicherte Änderungen – noch nicht zentral in Firebase gespeichert.';
   return;
 }
 if(shFirebaseUpdatedAt){
   el.textContent='Zentral gespeichert: '+shFormatFirebaseTime(shFirebaseUpdatedAt)+(shFirebaseUpdatedBy?' · '+shFirebaseUpdatedBy:'');
   return;
 }
 el.textContent='Noch kein zentraler Firebase-Speicherstand geladen.';
}

async function shSaveToFirebase(){
 if(window.ecwResults && !(await window.ecwResults.prepareSave()))return false;
 if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return false;}
 const invalid=(SH.links||[]).find(x=>!String(x.t||'').trim()||!shValidExternalLink(x.u));
 if(invalid){showToast('Bitte alle Links mit Bezeichnung und gültiger http(s)-Adresse ausfüllen oder unvollständige Links entfernen.',6500);return false;}
 if(!firebaseReady||!firestoreDb||!firebaseAuthUser){
   showToast('Firebase ist nicht verbunden oder kein Benutzer ist angemeldet.',5000);
   shUpdateFirebaseStatus('Speichern nicht möglich: Firebase/Anmeldung fehlt.');
   return false;
 }
 if(shFirebaseBusy)return false;
 shFirebaseBusy=true;shUpdateFirebaseStatus();
 const btn=document.getElementById('shFirebaseSaveBtn');if(btn)btn.disabled=true;
 try{
   const now=new Date().toISOString();
   const by=firebaseAuthUser.email||firebaseAuthUser.uid||'';
   await fbTimeout(
     firestoreDb.collection(SH_FB_COLLECTION).doc(SH_FB_DOC).set({
       config:JSON.parse(JSON.stringify(SH)),
       updatedAt:now,
       updatedBy:by,
       appVersion:APP_VERSION
     }),
     60000,
     'Startseite speichern'
   );
   shFirebaseUpdatedAt=now;
   shFirebaseUpdatedBy=by;
   shFirebaseDirty=false;
   shSave(false);
   shUpdateFirebaseStatus();
   showToast('Startseite zentral in Firebase gespeichert ✓',3500);
   return true;
 }catch(e){
   console.error('Startseite Firebase speichern:',e);
   const msg=(typeof firebaseErrorText==='function')?firebaseErrorText(e):(e?.message||String(e));
   shUpdateFirebaseStatus('Firebase-Speichern fehlgeschlagen: '+msg);
   showToast('Startseite konnte nicht in Firebase gespeichert werden.',5000);
   return false;
 }finally{
   shFirebaseBusy=false;
   if(btn)btn.disabled=false;
   if(!shFirebaseDirty)shUpdateFirebaseStatus();
 }
}

async function shLoadFromFirebase(showMessage=true){
 if(!firebaseReady||!firestoreDb||(!firebaseAuthUser&&!isPublicWhiteboardMode()))return false;
 if(shFirebaseBusy)return false;
 shFirebaseBusy=true;
 if(showMessage)shUpdateFirebaseStatus('Lade Startseite aus Firebase …');
 const btn=document.getElementById('shFirebaseLoadBtn');if(btn)btn.disabled=true;
 try{
   const snap=await fbTimeout(
     firestoreDb.collection(SH_FB_COLLECTION).doc(SH_FB_DOC).get(),
     30000,
     'Startseite laden'
   );
   if(!snap.exists){
     shFirebaseUpdatedAt='';
     shFirebaseUpdatedBy='';
     shFirebaseDirty=false;
     if(showMessage){
       shUpdateFirebaseStatus('In Firebase ist noch keine Startseite gespeichert. Der lokale Stand bleibt erhalten.');
       showToast('Noch keine zentrale Startseite in Firebase vorhanden.',3500);
     }
     return false;
   }
   const data=snap.data()||{};
   const cfg=data.config||data.startseite||data;
   SH=shSane(cfg);
   shFirebaseUpdatedAt=data.updatedAt||'';
   shFirebaseUpdatedBy=data.updatedBy||'';
   shFirebaseDirty=false;
   shSave(false);
   shOpen=-1;
   shRender();
   if(document.getElementById('admin')?.classList.contains('active') && document.getElementById('shFirebaseStatus')){
     // Oberfläche nur aktualisieren, wenn gerade die Startseiten-Verwaltung sichtbar ist.
     renderStartseiteAdmin();
   }
   if(showMessage)showToast('Startseite aus Firebase geladen ✓',3000);
   return true;
 }catch(e){
   console.error('Startseite Firebase laden:',e);
   const msg=(typeof firebaseErrorText==='function')?firebaseErrorText(e):(e?.message||String(e));
   if(showMessage){
     shUpdateFirebaseStatus('Firebase-Laden fehlgeschlagen: '+msg);
     showToast('Startseite konnte nicht aus Firebase geladen werden.',5000);
   }
   return false;
 }finally{
   shFirebaseBusy=false;
   if(btn)btn.disabled=false;
   if(!showMessage)shUpdateFirebaseStatus();
 }
}

function shSafeUrl(u){u=(u||'').trim();if(!u||/^(javascript|data|vbscript):/i.test(u))return '';
 if(/^[a-z][a-z0-9+.-]*:/i.test(u)||/^[#/.?]/.test(u))return u;return 'https://'+u}
var shOpen=-1;
function shMakeBtn(b,idx){
 try{
  b=b||{};
  const a=document.createElement('a'),u=shSafeUrl(b.u);
  a.className='shbtn';a.textContent=String(b.t||'');
  const routePerm=(shInternalHash(u)||String(b.u||'')).replace(/^.*#/,'').split('?')[0];
  const routeMap={'turnierliste':'tp','turniere-monatsuebersicht':'t','eigene-turniere':'o','nachrichten':'n','fotos':'p','fotos-sponsoren':'sp','mitglieder':'mv','mannschaften':'m','links':'lk'};
  const pk=routeMap[routePerm];
  if(pk&&!canViewApp(pk)){
   a.classList.add('app-disabled');a.setAttribute('aria-disabled','true');
   a.title='Für diesen Benutzer nicht freigegeben';a.href='#';
   a.onclick=e=>e.preventDefault();return a;
  }
  if(String(b.u||'').endsWith('#ecw-ergebnisse')){
   a.href='#ecw-ergebnisse';a.classList.add('hassub');
   a.onclick=e=>{e.preventDefault();if(window.ecwResults)window.ecwResults.open(false);else showToast('Ergebnisbereich fehlt. Bitte alle Update-Dateien hochladen.');};return a;
  }
  if(String(b.u||'').endsWith('#ecw-nuetzliches-links')){a.href='#ecw-nuetzliches-links';a.classList.add('hassub');a.onclick=e=>{e.preventDefault();window.ecwUtility.open()};return a;}
  if(idx>=0&&Array.isArray(b.sub)&&b.sub.length){
   a.classList.add('hassub');a.href='#';
   a.onclick=e=>{e.preventDefault();shOpen=idx;shRender();};
   return a;
  }
  if(!u){
   a.classList.add('nolink');
   a.href='#';
   a.onclick=e=>{e.preventDefault();showToast('Für diesen Button ist noch kein Link hinterlegt.');};
   return a;
  }

  a.href=u;
  const h=shInternalHash(u);
  if(h){
   a.onclick=e=>{e.preventDefault();shGo(h);};
   return a;
  }

  if(externalWebUrl(u)){
   if(isLiveStartlistUrl(u)){
    a.onclick=e=>{e.preventDefault();openExternalPage(u,b.t);};
   }else if(isEcwTournamentAppUrl(u)||isSoloPyramideUrl(u)){
    if(isPublicWhiteboardMode()&&!isWhiteboardInternalResultAllowed(u)){
      a.classList.add('app-disabled');
      a.title='Dieser Bereich ist im Whiteboardmodus nicht freigegeben';
      a.onclick=e=>{e.preventDefault();showToast('Dieser interne Ergebnisbereich ist im Whiteboardmodus nicht freigegeben.',5000);};
    }else{
      a.onclick=e=>{e.preventDefault();openExternalPage(u,b.t);};
    }
   }else if(shouldEmbedExternal(u,b.t)){
    // V2.9.3: Die gespeicherte Link-Einstellung gilt auch fuer angemeldete
    // Whiteboards. Einbettung darf nicht durch die Benutzerrolle ueberschrieben werden.
    a.onclick=e=>{e.preventDefault();openExternalPage(u,b.t);};
   }else{
    // Browser-nativer neuer Tab statt location.href (welches die Vereinsverwaltung ersetzt).
    a.target='_blank';a.rel='noopener noreferrer';
   }
   return a;
  }

  // Sonstige zulässige Links nicht speziell blockieren.
  return a;
 }catch(err){
  console.error('Startseiten-Button konnte nicht erzeugt werden:',b,err);
  const a=document.createElement('a');
  a.className='shbtn app-disabled';
  a.href='#';
  a.textContent=String((b&&b.t)||'Link');
  a.title='Dieser Link konnte nicht geladen werden';
  a.onclick=e=>e.preventDefault();
  return a;
 }
}
function closeStartSubmenu(){shOpen=-1;shRender();}
function shRender(){
 const art=document.getElementById('shArt');if(!art)return;
 if(shOpen>=SH.buttons.length||(shOpen>=0&&!(SH.buttons[shOpen].sub||[]).length))shOpen=-1;
 const grp=shOpen>=0?SH.buttons[shOpen]:null;
 const label=grp?grp.t.replace(/\n/g,' '):SH.title;
 art.style.backgroundImage='url("'+(SH.bg||SH_BG)+'")';
 document.getElementById('shTitle').textContent=label;document.getElementById('shTitle2').textContent=label;
 document.getElementById('shSubReturn').hidden=!grp;
 document.getElementById('startseite').classList.toggle('sh-submenu',!!grp);
 const items=grp?grp.sub:SH.buttons;
 const total=items.length;
 const g=document.getElementById('shGrid'),rows=Math.max(1,Math.ceil(total/SH.cols));
 g.style.setProperty('--cd',SH.cols);g.style.setProperty('--rd',rows);g.style.setProperty('--rp',Math.ceil(total/2)||1);
 const els=[];
 items.forEach((b,i)=>{
  try{els.push(shMakeBtn(b,grp?-1:i))}
  catch(e){
   console.error('Startseiten-Button:',e);
   const x=document.createElement('a');x.className='shbtn app-disabled';x.href='#';x.textContent=String(b?.t||'Link');x.onclick=ev=>ev.preventDefault();els.push(x);
  }
 });
 g.replaceChildren(...els);shRenderExternalLinks();shUpdateBack();updateWhiteboardScreenControls()}
function shNorm(u){return String(u).split('#')[0].split('?')[0].replace(/index\.html$/i,'')}
function shInternalHash(u){let x;try{x=new URL(u,location.href)}catch(e){return ''}
 if(x.hostname==='ecwegscheid.github.io'&&/^\/Mitglieder(?:\/|$)/i.test(x.pathname))return '#mitglieder';
 if(!x.hash||x.hash.length<2)return '';
 const t=shNorm(x.origin+x.pathname);
 const ok=[location.origin+location.pathname,getBaseUrl(),SH_B].map(shNorm);
 return ok.includes(t)?x.hash:''}
function shGo(h){/* Verwaltungskontext beim Wechsel in ein Startseiten-Untermenü erhalten */try{history.replaceState(null,'',location.pathname+location.search+h)}catch(e){}
 if(window.__directRouteV1248)window.__directRouteV1248()}
window.addEventListener('hashchange',()=>{try{if(window.__directRouteV1248)window.__directRouteV1248()}catch(e){}});
function shUpdateBack(){const g=document.getElementById('shGear');if(g){const visible=!!(window.__ecwAdminHomeReturn&&firebaseAuthUser&&appPermissions.admin===true&&!isWhiteboardUser()&&!isPublicWhiteboardMode());g.style.display=visible?'block':'none';g.hidden=!visible;}}
function shFullscreen(){if(isWhiteboardUser()){enterPresentationFullscreen();return;}const d=document,e=d.documentElement;if(d.fullscreenElement||d.webkitFullscreenElement)(d.exitFullscreen||d.webkitExitFullscreen).call(d);else(e.requestFullscreen||e.webkitRequestFullscreen).call(e)}
function shImg(file){return new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{const s=Math.min(1,1920/im.width),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.85))};im.src=r.result};r.readAsDataURL(file)})}
function shLink(){return getBaseUrl()+'#startseite'}
function shExternalLinksAdminHtml(){
 const rows=(SH.links||[]).map((item,i)=>
   '<div class="sh-row"><div class="in"><label>Bezeichnung</label><input type="text" maxlength="150" value="'+esc(item.t)+'" oninput="shExternalLinkSet('+i+',\'t\',this.value)">'
   +'<label>Internetadresse (https:// oder http://)</label><input type="url" maxlength="2048" value="'+esc(item.u)+'" oninput="shExternalLinkSet('+i+',\'u\',this.value)">'
   +'</div><div class="acts"><button type="button" onclick="shExternalLinkMove('+i+',-1)" title="Nach oben">↑</button>'
   +'<button type="button" onclick="shExternalLinkMove('+i+',1)" title="Nach unten">↓</button>'
   +'<button type="button" class="danger" onclick="shExternalLinkDel('+i+')" title="Link entfernen">✕</button></div></div>'
 ).join('');
 return '<div class="card" id="shExternalLinksAdmin" style="margin-top:12px;border:1px solid rgba(255,255,255,.35)">'
   +'<h3 style="margin-top:0">Verbände, Regelwerk und Sonstiges – Links verwalten</h3>'
   +'<p class="small">Diese Links erscheinen unter „Links“ auf der öffentlichen Startseite. Bezeichnungen und Adressen bearbeiten, Reihenfolge ändern oder Links hinzufügen/entfernen. Änderungen werden zunächst lokal vorgemerkt. Anschließend oben auf <b>„Startseite speichern“</b> klicken, um sie zentral für das Whiteboard zu übernehmen.</p>'
   +rows
   +'<div class="row" style="margin-top:10px"><button type="button" class="primary" onclick="shExternalLinkAdd()">+ Link hinzufügen</button><button type="button" onclick="shSaveToFirebase()">Links und Startseite in Firebase speichern</button></div>'
   +'</div>';
}
function shExternalLinkSet(i,k,value){
 if(!hasAppPermission('sh')||!SH.links?.[i]||!['t','u'].includes(k))return;
 SH.links[i][k]=String(value).slice(0,k==='t'?150:2048);
 shSave();shRender();
}
function shExternalLinkAdd(){
 if(!hasAppPermission('sh'))return;
 if(!Array.isArray(SH.links))SH.links=[];
 if(SH.links.length>=100){showToast('Maximal 100 Links möglich.');return;}
 SH.links.push({t:'Neuer Link',u:'https://'});shSave();shRender();renderStartseiteAdmin();
 const e=document.getElementById('shExternalLinksAdmin');if(e)e.scrollIntoView({block:'end',behavior:'instant'});
}
function shExternalLinkMove(i,dir){
 if(!hasAppPermission('sh')||!SH.links?.[i])return;
 const j=i+dir;if(j<0||j>=SH.links.length)return;
 [SH.links[i],SH.links[j]]=[SH.links[j],SH.links[i]];
 shSave();shRender();renderStartseiteAdmin();
}
function shExternalLinkDel(i){
 if(!hasAppPermission('sh')||!SH.links?.[i])return;
 if(!confirm('Link „'+SH.links[i].t+'“ entfernen?'))return;
 SH.links.splice(i,1);shSave();shRender();renderStartseiteAdmin();
}
function renderStartseiteAdmin(){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}
 const a=document.getElementById('adminMain'),st=a.scrollTop;
 a.innerHTML='<h2>Startseite verwalten</h2>'
 +'<div class="card"><label>Link zur Startseite</label><div class="row"><input type="text" readonly id="shLinkField" value="'+esc(shLink())+'" onclick="this.select()" style="flex:3"><button onclick="shCopy(this)">Kopieren</button><button onclick="window.open(shLink(),\'_blank\')">Öffnen</button></div>'
 +'<p class="small">Änderungen werden sofort angezeigt und zunächst lokal in diesem Browser zwischengespeichert.</p></div>'
 +'<div class="card" style="margin-top:12px;border:2px solid rgba(255,255,255,.28)"><h3 style="margin-top:0">Zentrale Startseite</h3><p class="small">Mit „Startseite speichern“ wird dieser Stand zentral in Firebase gespeichert. Beim nächsten Anmelden lädt PC/Whiteboard automatisch genau diesen Stand.</p><div class="row"><button id="shFirebaseSaveBtn" class="primary" onclick="shSaveToFirebase()">Startseite speichern</button><button id="shFirebaseLoadBtn" onclick="shLoadFromFirebase(true)">Aus Firebase laden</button></div><div id="shFirebaseStatus" class="small" style="margin-top:10px;font-weight:bold"></div></div>'
 +shExternalLinksAdminHtml()
 +(window.ecwUtility?window.ecwUtility.adminHtml():'')

 +'<div class="card" style="margin-top:12px"><label>Text auf der Startseite</label><input type="text" value="'+esc(SH.title)+'" oninput="shSet(\'title\',this.value)">'
 +'<label>Buttons pro Reihe</label><select onchange="shSet(\'cols\',+this.value,true)">'+[2,3,4].map(n=>'<option'+(n===SH.cols?' selected':'')+'>'+n+'</option>').join('')+'</select>'
 +'<label>Hintergrundbild (16:9, wird automatisch verkleinert)</label><input type="file" accept="image/*" onchange="shBg(this)"><div style="margin-top:8px"><button onclick="shBgReset()">Originalbild wiederherstellen</button></div></div>'
 +'<h3 style="margin:18px 0 8px">Buttons ('+SH.buttons.length+')</h3>'
 +SH.buttons.map(shAdminRow).join('')
 +'<div class="row" style="margin:10px 0"><button class="primary" onclick="shAdd()">+ Button hinzufügen</button></div>'
 +'<div class="card"><div class="row"><button onclick="shExport()">Konfiguration exportieren</button><button class="danger" onclick="shReset()">Alles zurücksetzen</button></div><label>Konfiguration importieren (.json)</label><input type="file" accept=".json,application/json" onchange="shImport(this)"></div>' +'<div id="shLinksEmbedded" style="margin-top:20px"></div>';
 a.scrollTop=st;
 shUpdateFirebaseStatus();
 renderLinksAdmin(document.getElementById('shLinksEmbedded'));
}
var shAdminOpen=new WeakSet();
function shAdminRow(b,i){
 const subs=b.sub||[],open=shAdminOpen.has(b);
 let h='<div class="sh-row"><div class="in"><textarea rows="2" placeholder="Name (Zeilenumbruch erlaubt)" oninput="shBtn('+i+',\'t\',this.value)">'+esc(b.t)+'</textarea><input type="text" placeholder="Link, z. B. https://…" value="'+esc(b.u)+'" oninput="shBtn('+i+',\'u\',this.value)">'
  +'<div><button onclick="shSubToggle('+i+')">Unterbuttons ('+subs.length+') '+(open?'\u25BE':'\u25B8')+'</button></div>'
  +(subs.length?'<p class="small" style="margin:0">Dieser Button öffnet die nächste Ebene – der Link oben wird dann nicht verwendet.</p>':'')
  +'</div><div class="acts"><button onclick="shMove('+i+',-1)" title="Nach vorne">↑</button><button onclick="shMove('+i+',1)" title="Nach hinten">↓</button><button class="danger" onclick="shDel('+i+')" title="Löschen">✕</button></div></div>';
 if(open){
  h+='<div class="sh-sub">'+subs.map((x,j)=>'<div class="sh-row"><div class="in"><textarea rows="2" placeholder="Name des Unterbuttons" oninput="shSub('+i+','+j+',\'t\',this.value)">'+esc(x.t)+'</textarea><input type="text" placeholder="Link, z. B. https://…" value="'+esc(x.u)+'" oninput="shSub('+i+','+j+',\'u\',this.value)"></div><div class="acts"><button onclick="shSubMove('+i+','+j+',-1)" title="Nach vorne">↑</button><button onclick="shSubMove('+i+','+j+',1)" title="Nach hinten">↓</button><button class="danger" onclick="shSubDel('+i+','+j+')" title="Löschen">✕</button></div></div>').join('')
   +'<div class="row" style="margin:6px 0 10px"><button onclick="shSubAdd('+i+')">+ Unterbutton hinzufügen</button></div></div>'}
 return h}
function shSubToggle(i){const b=SH.buttons[i];if(shAdminOpen.has(b))shAdminOpen.delete(b);else shAdminOpen.add(b);renderStartseiteAdmin()}
function shSubAdd(i){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}const b=SH.buttons[i];(b.sub=b.sub||[]).push({t:'Neuer Unterbutton',u:''});shAdminOpen.add(b);shSave();shRender();renderStartseiteAdmin()}
function shSub(i,j,k,v){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}SH.buttons[i].sub[j][k]=v;shSave();shRender()}
function shSubMove(i,j,d){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}const sb=SH.buttons[i].sub,k=j+d;if(k<0||k>=sb.length)return;const [x]=sb.splice(j,1);sb.splice(k,0,x);shSave();shRender();renderStartseiteAdmin()}
function shSubDel(i,j){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}const b=SH.buttons[i],sb=b.sub;if(confirm('Unterbutton „'+sb[j].t.replace(/\n/g,' ')+'“ löschen?')){sb.splice(j,1);if(!sb.length)delete b.sub;shSave();shRender();renderStartseiteAdmin()}}
function shSet(k,v,re){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}SH[k]=v;shSave();shRender();if(re)renderStartseiteAdmin()}
function shBtn(i,k,v){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}SH.buttons[i][k]=v;shSave();shRender()}
function shMove(i,d){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}const j=i+d;if(j<0||j>=SH.buttons.length)return;const [b]=SH.buttons.splice(i,1);SH.buttons.splice(j,0,b);shOpen=-1;shSave();shRender();renderStartseiteAdmin()}
function shDel(i){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}const b=SH.buttons[i],n=(b.sub||[]).length;if(confirm('Button „'+b.t.replace(/\n/g,' ')+'“'+(n?' mit '+n+' Unterbutton(s)':'')+' löschen?')){SH.buttons.splice(i,1);shOpen=-1;shSave();shRender();renderStartseiteAdmin()}}
function shAdd(){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}SH.buttons.push({t:'Neuer Button',u:''});shSave();shRender();renderStartseiteAdmin();const a=document.getElementById('adminMain');a.scrollTop=a.scrollHeight}
async function shBg(inp){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}if(!inp.files[0])return;try{SH.bg=await shImg(inp.files[0]);shSave();shRender();showToast('Hintergrundbild geändert')}catch(e){showToast('Bild konnte nicht geladen werden')}}
function shBgReset(){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}SH.bg=null;shSave();shRender()}
function shReset(){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}if(confirm('Alle Änderungen (Texte, Buttons, Links, Hintergrundbild) verwerfen?')){SH=shSane({});shSave();shRender();renderStartseiteAdmin()}}
function shExport(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(SH,null,1)],{type:'application/json'}));a.download='startseite-konfiguration.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function shImport(inp){if(!hasAppPermission('sh')){showToast('Startseite bearbeiten ist nicht freigegeben.');return;}if(!inp.files[0])return;try{SH=shSane(JSON.parse(await inp.files[0].text()));shSave();shRender();renderStartseiteAdmin();showToast('Konfiguration importiert')}catch(e){showToast('Datei ungültig')}}
async function shCopy(btn){const i=document.getElementById('shLinkField');try{await navigator.clipboard.writeText(i.value)}catch(e){i.select();try{document.execCommand('copy')}catch(x){}}const o=btn.textContent;btn.textContent='Kopiert ✓';setTimeout(()=>btn.textContent=o,1500)}
/* ===== Ende Startseite ===== */
function goToStartseite(){
 if(isWhiteboardUser()||isPublicWhiteboardMode()){window.__adminPreviewMode=false;showView('startseite');return;}
  try{leavePresentationFullscreen()}catch(e){}
  let c='';try{c=(localStorage.getItem('verein_startseite_url')||'').trim()}catch(e){}
  if(c&&!/^startseite\.html$/i.test(c))location.href=c;else{window.__adminPreviewMode=false;showView('startseite')}
}
function getBaseUrl(){
  try{
    const central=String(centralNavigationSettings.baseUrl||'').trim();
    if(central)return window.ECW_SITE_BASE;
    const v=(localStorage.getItem('verein_base_url')||'').trim();
    if(v)return window.ECW_SITE_BASE;
  }catch(e){}
  if(/^https?:$/.test(location.protocol))return (location.origin+location.pathname).replace(/index\.html$/i,'');
  return BASE_DEFAULT;
}

/* ---------- Mannschaften: Daten ---------- */
const TEAMS_KEY='verein_teams_v1';
const TEAMS_FB='teams';
const TEAMS_SEED=[];
let teamsData=null,currentTeamId=null,teamsFbTried=false,teamsPersistTimer=null;
let teamsSaveInProgress=false;
const teamsPendingDeletes=new Set();
function slugTeam(n){return String(n||'').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||('team-'+Date.now())}
function uniqueTeamId(base,skip){let id=base,n=2;while((teamsData||[]).some(t=>t!==skip&&t.id===id))id=base+'-'+(n++);return id}
function teamsSeedClone(){return TEAMS_SEED.map((t,i)=>({id:slugTeam(t.name),name:t.name,league:t.league||'',players:(t.players||[]).slice(),photos:(t.photos||[]).map((d,j)=>({id:'seed_'+i+'_'+j,name:'Foto '+(j+1),data:d}))}))}
function teamsLoadLocal(){
  if(teamsData)return;
  try{const j=JSON.parse(localStorage.getItem(TEAMS_KEY)||'null');if(j&&Array.isArray(j.teams)){teamsData=j.teams;return}}catch(e){console.warn('Mannschaften lokal:',e)}
  teamsData=teamsSeedClone();
}
async function teamsHydrate(){
  for(const t of teamsData||[])for(const p of t.photos||[]){
    if(p.mediaId&&!(p.data&&/^(blob:|data:)/.test(p.data))){try{const b=await mediaGet(p.mediaId);if(b){p.data=URL.createObjectURL(b);mediaObjectUrls.push(p.data)}}catch(e){console.error(e)}}
  }
}
/* Unveränderte PowerPoint-Fotos (nur im Code) werden beim Speichern in den lokalen Dateispeicher übernommen. */
async function teamsPersist(){
  try{
    for(const t of teamsData)for(const p of t.photos){
      if(!p.mediaId&&p.data&&String(p.data).startsWith('data:')){const st=await storeMedia('m',p.id,p.data);p.mediaId=st.id;p.data=st.url}
    }
    const meta=teamsData.map(t=>({id:t.id,name:t.name,league:t.league,players:t.players,photos:t.photos.map(p=>({id:p.id,name:p.name,mediaId:p.mediaId}))}));
    localStorage.setItem(TEAMS_KEY,JSON.stringify({teams:meta}));
    return true;
  }catch(e){console.error(e);showToast('Mannschaften konnten lokal nicht gespeichert werden: '+(e?.message||e),6000);return false}
}
function teamsPersistSoon(){clearTimeout(teamsPersistTimer);teamsPersistTimer=setTimeout(teamsPersist,600)}
function isAdminNow(){return appPermissions.admin===true}

/* ---------- Mannschaften: Firebase ---------- */
async function teamsSyncToFirebase(){
  if(!firebaseReady||!firestoreDb||!firebaseAuthUser)return {ok:false,error:'Bitte zuerst anmelden.'};
  if(teamsSaveInProgress)return {ok:false,error:'Speichern läuft bereits.'};
  teamsSaveInProgress=true;
  try{
    let remoteDocs=[];
    try{
      const safety=await ecwSafetyServerSnapshot(TEAMS_FB,'Mannschaften vor Speichern');
      remoteDocs=safety.docs||[];
    }catch(e){
      return {ok:false,error:'Sicherheitsprüfung fehlgeschlagen: '+(e?.message||e)};
    }

    const remoteTeams=remoteDocs.filter(x=>x.data?.type==='team');
    const localIds=new Set((teamsData||[]).map(t=>String(t.id)));
    const remoteIds=new Set(remoteTeams.map(x=>String(x.data?.id||'')).filter(Boolean));

    const unexplainedMissing=[...remoteIds].filter(id=>!localIds.has(id)&&!teamsPendingDeletes.has(id));
    if(unexplainedMissing.length){
      return {ok:false,error:'Sicherheitsstopp: '+unexplainedMissing.length+' Firebase-Mannschaft(en) fehlen im lokalen Bearbeitungsstand. Es wurde nichts gelöscht. Bitte zuerst „Aus Firebase laden“ oder den Bestand wiederherstellen.'};
    }

    let photos=0,failed=0;
    for(let i=0;i<(teamsData||[]).length;i++){
      const t=teamsData[i];
      const tid='team_'+t.id;
      await fbTimeout(firestoreDb.collection(TEAMS_FB).doc(tid).set({
        type:'team',id:t.id,name:t.name,league:t.league||'',players:t.players||[],order:i,updatedAt:new Date().toISOString()
      }),60000,'Firebase');

      const desiredPhotoIds=new Set();
      let teamPhotoFailed=0;
      for(let j=0;j<(t.photos||[]).length;j++){
        const p=t.photos[j],pid='photo_'+t.id+'_'+j;
        let d=await getLocalPhotoDataUrl(p);
        if(d&&d.length>FIREBASE_MAX_CHARS)d=await shrinkDataUrlForFirebase(d);
        if(!d||d.length>FIREBASE_MAX_CHARS){failed++;teamPhotoFailed++;continue}
        desiredPhotoIds.add(pid);
        await fbTimeout(firestoreDb.collection(TEAMS_FB).doc(pid).set({
          type:'photo',teamId:t.id,index:j,id:String(p.id||''),name:String(p.name||''),data:d,updatedAt:new Date().toISOString()
        }),90000,'Firebase');
        photos++;
      }

      if(teamPhotoFailed===0){
        const oldPhotos=remoteDocs.filter(x=>x.data?.type==='photo'&&String(x.data?.teamId||'')===String(t.id));
        for(const x of oldPhotos){
          if(!desiredPhotoIds.has(x.id)){
            await fbTimeout(firestoreDb.collection(TEAMS_FB).doc(x.id).delete(),60000,'Firebase Foto löschen');
          }
        }
      }
    }

    for(const id of [...teamsPendingDeletes]){
      await fbTimeout(firestoreDb.collection(TEAMS_FB).doc('team_'+id).delete(),60000,'Firebase Mannschaft löschen');
      const photoSnap=await fbTimeout(firestoreDb.collection(TEAMS_FB).where('teamId','==',id).get(),60000,'Firebase Fotos lesen');
      const dels=[];photoSnap.forEach(doc=>dels.push(doc.ref.delete()));
      if(dels.length)await fbTimeout(Promise.all(dels),60000,'Firebase Mannschaftsfotos löschen');
    }
    teamsPendingDeletes.clear();

    return {ok:failed===0,message:(teamsData||[]).length+' Mannschaft(en) und '+photos+' Foto(s) sicher übertragen'+(failed?' · '+failed+' Foto(s) nicht übertragen':'')+'.'};
  }catch(e){
    console.error(e);
    return {ok:false,error:firebaseErrorText(e)}
  }finally{
    teamsSaveInProgress=false;
  }
}
async function teamsFetchFromFirebase(){
  const snap=await fbTimeout(firestoreDb.collection(TEAMS_FB).get(),30000,'Firebase');
  const teams=[],photos=[];
  snap.forEach(doc=>{const x=doc.data()||{};if(x.type==='team'&&x.id)teams.push({id:x.id,name:x.name||x.id,league:x.league||'',players:Array.isArray(x.players)?x.players:[],photos:[],order:Number.isFinite(x.order)?x.order:0});else if(x.type==='photo'&&x.teamId&&x.data)photos.push(x)});
  if(!teams.length)return null;
  teams.sort((a,b)=>a.order-b.order);
  photos.sort((a,b)=>(a.index||0)-(b.index||0));
  photos.forEach(p=>{const t=teams.find(t=>t.id===p.teamId);if(t)t.photos.push({id:p.id||('fb_'+p.index),name:p.name||'',data:p.data})});
  teams.forEach(t=>delete t.order);
  return teams;
}
/* Öffentlich (ohne Anmeldung): Firebase-Daten nur im Arbeitsspeicher; sonst bleiben die PowerPoint-Vorgaben sichtbar. */
async function teamsLoadPublic(){
  if(teamsFbTried||isAdminNow()||!firebaseReady||!firestoreDb)return false;
  teamsFbTried=true;
  try{const t=await teamsFetchFromFirebase();if(t){teamsData=t;return true}}catch(e){console.warn('Mannschaften (Firebase):',e)}
  return false;
}
async function teamsReloadFromFirebase(){
  const info=document.getElementById('teamsInfo');
  if(!firebaseReady||!firestoreDb){showToast('Firebase ist nicht verbunden');return}
  if(!confirm('Die lokalen Mannschaften werden durch die Daten aus Firebase ersetzt. Fortfahren?'))return;
  try{
    if(info)info.textContent='Lade aus Firebase …';
    const t=await teamsFetchFromFirebase();
    if(!t){if(info)info.textContent='In Firebase sind noch keine Mannschaften gespeichert.';return}
    teamsData=t;await teamsPersist();await teamsHydrate();renderTeamsAdmin();
    const i2=document.getElementById('teamsInfo');if(i2)i2.textContent=t.length+' Mannschaft(en) aus Firebase geladen.';
  }catch(e){if(info)info.textContent='Fehler: '+firebaseErrorText(e)}
}
async function teamsSaveAll(){
  const info=document.getElementById('teamsInfo');
  if(!ecwRequireCentralSave('Mannschaften speichern')){if(info)info.textContent='Nicht gespeichert: Firebase ist nicht verfügbar.';return}
  clearTimeout(teamsPersistTimer);
  if(info)info.textContent='Sicherheitsprüfung und Speicherung …';
  const ok=await teamsPersist();
  if(!ok){if(info)info.textContent='Lokales Zwischenspeichern fehlgeschlagen.';return}
  const r=await teamsSyncToFirebase();
  if(info)info.textContent=r.ok?('Zentral gespeichert. '+r.message):('SICHERHEITSSTOPP / Fehler: '+(r.error||r.message));
  showToast(r.ok?'Mannschaften sicher gespeichert ✓':'Mannschaften NICHT vollständig gespeichert – Firebase wurde geschützt',6000);
  if(r.ok){
    try{
      const fresh=await teamsFetchFromFirebase();
      if(fresh){teamsData=fresh;await teamsPersist();await teamsHydrate();renderTeamsAdmin();}
    }catch(e){console.warn('Mannschaften Nachkontrolle:',e)}
  }
}

/* ---------- Mannschaften: Anzeige ---------- */
async function teamsInit(){
  teamsLoadLocal();
  await teamsLoadPublic();
  try{await teamsHydrate()}catch(e){}
}
async function openTeams(){
  await teamsInit();
  showView('teams');
}
async function openTeam(id){
  await teamsInit();
  if(!teamsData.some(t=>t.id===id)){showToast('Mannschaft nicht gefunden');return showView('teams')}
  currentTeamId=id;
  showView('teamDetail');
}
function openTeamDirect(id){return openTeam(id)}
function renderTeamsOverview(){
  const g=document.getElementById('teamsGrid');if(!g)return;
  g.innerHTML='';
  if(!teamsData||!teamsData.length){g.innerHTML='<div class="empty">Noch keine Mannschaften angelegt.</div>';return}

  const groups=[
    {title:'Mannschaften',cls:'main',items:teamsData.filter(t=>/^Mannschaft\s+\d+$/i.test(t.name||'')).sort((a,b)=>(parseInt(a.name.match(/\d+/)?.[0]||999)-parseInt(b.name.match(/\d+/)?.[0]||999)))},
    {title:'Mixed',cls:'mixed',items:teamsData.filter(t=>/^Mixed\s+\d+$/i.test(t.name||'')).sort((a,b)=>(parseInt(a.name.match(/\d+/)?.[0]||999)-parseInt(b.name.match(/\d+/)?.[0]||999)))},
    {title:'Damen',cls:'damen',items:teamsData.filter(t=>/^Damen\s+\d+$/i.test(t.name||'')).sort((a,b)=>(parseInt(a.name.match(/\d+/)?.[0]||999)-parseInt(b.name.match(/\d+/)?.[0]||999)))},
    {title:'Jugend',cls:'jugend',items:teamsData.filter(t=>/^(U14|U19)$/i.test(t.name||'')).sort((a,b)=>(parseInt(a.name.replace(/\D/g,''))||999)-(parseInt(b.name.replace(/\D/g,''))||999))}
  ];
  const used=new Set(groups.flatMap(x=>x.items.map(t=>t.id)));
  const other=teamsData.filter(t=>!used.has(t.id));
  if(other.length)groups.push({title:'Weitere Mannschaften',cls:'main',items:other});

  groups.filter(gr=>gr.items.length).forEach(gr=>{
    const sec=document.createElement('div');sec.className='team-group';
    sec.innerHTML='<div class="team-group-title">'+esc(gr.title)+'</div>';
    const grid=document.createElement('div');grid.className='team-group-grid '+gr.cls;
    gr.items.forEach(t=>{
      const a=document.createElement('a');a.className='gbtn';a.textContent=t.name;a.href='#mannschaft-'+t.id;
      a.onclick=e=>{e.preventDefault();openTeam(t.id)};
      grid.appendChild(a);
    });
    sec.appendChild(grid);g.appendChild(sec);
  });
}
function renderTeamDetail(){
  const t=(teamsData||[]).find(x=>x.id===currentTeamId);if(!t)return;
  document.getElementById('tdTitle').textContent=t.name;
  document.getElementById('tdLeague').textContent=t.league||'';
  const pl=document.getElementById('tdPlayers');
  pl.innerHTML=(t.players&&t.players.length)?t.players.map(n=>'<div class="team-player">'+esc(n)+'</div>').join(''):'<div class="small">Noch keine Spieler eingetragen.</div>';
  const ph=document.getElementById('tdPhotos');ph.innerHTML='';
  const visiblePhotos=(t.photos||[]).filter(p=>p&&p.data);
  ph.className='team-photos count-'+Math.min(6,visiblePhotos.length);
  visiblePhotos.forEach(p=>{const im=document.createElement('img');im.src=p.data;im.alt=p.name||t.name;im.onclick=()=>teamZoom(p.data);ph.appendChild(im)});
}
function teamZoom(src){const z=document.getElementById('teamZoom');document.getElementById('teamZoomImg').src=src;z.classList.add('show')}
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('teamZoom')?.classList.remove('show')});

/* ---------- Mannschaften: Verwaltung (Admin) ---------- */
function teamsAdminEnsure(){teamsLoadLocal()}
function renderTeamsAdmin(){
  teamsAdminEnsure();
  const a=document.getElementById('adminMain');
  let h='<h2>Mannschaften</h2><div class="card"><p class="small">Pro Mannschaft: Name, Liga, Spieler (ein Name pro Zeile) und Fotos. Nach dem Ändern auf „Speichern“ klicken. Mannschaften werden nur nach ausdrücklichem Löschen entfernt; vor jeder Firebase-Änderung wird der aktuelle Bestand gesichert.</p>'
    +'<div class="row"><button class="primary" onclick="teamAdd()">+ Mannschaft hinzufügen</button><button class="primary" onclick="teamsSaveAll()">Speichern</button><button onclick="teamsReloadFromFirebase()">Aus Firebase laden</button></div>'
    +'<div id="teamsInfo" class="small" style="margin-top:10px"></div></div>';
  teamsData.forEach((t,i)=>{
    h+='<div class="card" style="margin-top:12px"><div class="row" style="align-items:flex-end">'
      +'<div style="flex:2"><label>Name</label><input type="text" value="'+esc(t.name)+'" oninput="teamEdit('+i+',\'name\',this.value)"></div>'
      +'<div style="flex:2"><label>Liga</label><input type="text" value="'+esc(t.league)+'" placeholder="z. B. Kreisliga" oninput="teamEdit('+i+',\'league\',this.value)"></div>'
      +'<div style="flex:none;display:flex;gap:6px"><button title="Nach oben" onclick="teamMove('+i+',-1)">↑</button><button title="Nach unten" onclick="teamMove('+i+',1)">↓</button><button class="danger" title="Mannschaft löschen" onclick="teamDelete('+i+')">✕</button></div></div>'
      +'<label>Spieler (ein Name pro Zeile)</label><textarea rows="'+Math.max(3,Math.min(8,(t.players||[]).length+1))+'" oninput="teamEdit('+i+',\'players\',this.value)">'+esc((t.players||[]).join('\n'))+'</textarea>'
      +'<label>Fotos</label><div class="thumb-grid">'
      +(t.photos||[]).map((p,j)=>'<div class="thumb team-photo-drag" data-team="'+i+'" data-photo="'+j+'">'+(p.data?'<img src="'+esc(p.data)+'" alt="">':'')+'<button title="Foto löschen" onclick="event.stopPropagation();teamPhotoDelete('+i+','+j+')">✕</button><button class="rot" title="Links drehen" onclick="event.stopPropagation();teamPhotoRotate('+i+','+j+',-1)">↺</button><button class="crop-btn" title="Zuschneiden" onclick="event.stopPropagation();cropOpenTeam('+i+','+j+')">✂</button><button class="rot3" title="Rechts drehen" onclick="event.stopPropagation();teamPhotoRotate('+i+','+j+',1)">↻</button><div class="drag-handle" title="Foto verschieben" onpointerdown="teamPhotoPointerDown(event,'+i+','+j+')">↔ Verschieben</div></div>').join('')
      +'</div><input type="file" multiple accept=".png,.bmp,.jpg,.jpeg,.webp" onchange="teamPhotosAdd('+i+',this)">'
      +'<div class="small" style="margin-top:6px">Link zur Startseite: <code>#mannschaft-'+esc(t.id)+'</code></div></div>';
  });
  a.innerHTML=h;
}
function teamEdit(i,f,v){
  const t=teamsData[i];if(!t)return;
  if(f==='players')t.players=String(v).split('\n').map(s=>s.trim()).filter(Boolean);
  else t[f]=v;
  teamsPersistSoon();
}
function teamAdd(){
  const name='Neue Mannschaft';
  teamsData.push({id:uniqueTeamId(slugTeam(name)+'-'+(teamsData.length+1)),name,league:'',players:[],photos:[]});
  teamsPersist();renderTeamsAdmin();
  window.scrollTo(0,document.body.scrollHeight);
}
function teamMove(i,d){const j=i+d;if(j<0||j>=teamsData.length)return;const [t]=teamsData.splice(i,1);teamsData.splice(j,0,t);teamsPersist();renderTeamsAdmin()}
async function teamDelete(i){
  const t=teamsData[i];if(!t||!confirm('Mannschaft „'+t.name+'“ mit allen Fotos löschen?\n\nDie Löschung wird erst mit „Speichern“ nach Firebase übernommen.'))return;
  teamsPendingDeletes.add(String(t.id));
  for(const p of t.photos)if(p.mediaId){try{await mediaDelete(p.mediaId)}catch(e){}}
  teamsData.splice(i,1);await teamsPersist();renderTeamsAdmin();
}

/* ===== V2.5.2 Mannschaftsfotos: stabiles Pointer-Drag & Drop ===== */
let teamPointerDrag=null;

function teamPhotoSwap(teamIndex,a,b){
  const arr=teamsData?.[teamIndex]?.photos;
  if(!arr||a===b||a<0||b<0||a>=arr.length||b>=arr.length)return false;
  [arr[a],arr[b]]=[arr[b],arr[a]];
  return true;
}

function teamDragClearTargets(){
  document.querySelectorAll('.team-photo-drag.drop-target').forEach(x=>x.classList.remove('drop-target'));
}

function teamPhotoPointerDown(e,teamIndex,photoIndex){
  e.preventDefault();
  e.stopPropagation();

  const handle=e.currentTarget;
  const card=handle.closest('.team-photo-drag');
  if(!card)return;

  const pid=e.pointerId;
  const startX=e.clientX,startY=e.clientY;
  let started=false;

  const startDrag=()=>{
    if(started)return;
    started=true;
    teamPointerDrag={teamIndex,photoIndex,pid,card};
    card.classList.add('dragging');

    const ghost=document.getElementById('teamTouchDragGhost');
    const gi=document.getElementById('teamTouchDragGhostImg');
    const src=card.querySelector('img')?.src||'';
    if(gi)gi.src=src;
    if(ghost){
      ghost.style.display='block';
      ghost.style.left=startX+'px';
      ghost.style.top=startY+'px';
    }
    try{handle.setPointerCapture(pid)}catch(_){}
  };

  // Start immediately on mouse/pen; short hold on touch avoids accidental moves.
  let holdTimer=null;
  if(e.pointerType==='touch') holdTimer=setTimeout(startDrag,180);
  else startDrag();

  const move=ev=>{
    if(ev.pointerId!==pid)return;

    if(!started){
      if(Math.hypot(ev.clientX-startX,ev.clientY-startY)>14){
        clearTimeout(holdTimer);
      }
      return;
    }

    ev.preventDefault();
    const ghost=document.getElementById('teamTouchDragGhost');
    if(ghost){
      ghost.style.left=ev.clientX+'px';
      ghost.style.top=ev.clientY+'px';
    }

    teamDragClearTargets();
    const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.team-photo-drag');
    if(target && Number(target.dataset.team)===teamIndex && Number(target.dataset.photo)!==photoIndex){
      target.classList.add('drop-target');
    }
  };

  const finish=async ev=>{
    if(ev.pointerId!==pid)return;
    clearTimeout(holdTimer);
    cleanup();

    if(!started)return;

    const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.team-photo-drag');
    const ghost=document.getElementById('teamTouchDragGhost');
    if(ghost)ghost.style.display='none';

    card.classList.remove('dragging');
    teamDragClearTargets();
    teamPointerDrag=null;

    if(!target || Number(target.dataset.team)!==teamIndex)return;

    const targetIndex=Number(target.dataset.photo);
    if(teamPhotoSwap(teamIndex,photoIndex,targetIndex)){
      await teamsPersist();
      renderTeamsAdmin();
      showToast('Foto-Reihenfolge geändert – bitte noch „Speichern“ klicken',3500);
    }
  };

  const cancel=ev=>{
    if(ev.pointerId!==pid)return;
    clearTimeout(holdTimer);
    cleanup();
    card.classList.remove('dragging');
    teamDragClearTargets();
    const ghost=document.getElementById('teamTouchDragGhost');
    if(ghost)ghost.style.display='none';
    teamPointerDrag=null;
  };

  const cleanup=()=>{
    handle.removeEventListener('pointermove',move);
    handle.removeEventListener('pointerup',finish);
    handle.removeEventListener('pointercancel',cancel);
  };

  handle.addEventListener('pointermove',move,{passive:false});
  handle.addEventListener('pointerup',finish,{once:true});
  handle.addEventListener('pointercancel',cancel,{once:true});
}

async function teamPhotoDelete(i,j){
  const p=teamsData[i]?.photos[j];if(!p)return;
  if(p.mediaId){try{await mediaDelete(p.mediaId)}catch(e){}}
  teamsData[i].photos.splice(j,1);await teamsPersist();renderTeamsAdmin();
}


/* ===== V2.5.2: Einfaches Zuschneiden für Mannschaften und Turniereinladungen ===== */
let cropState=null,cropImage=null;
async function cropLoadImage(src){
 return await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src});
}
async function cropOpenTeam(teamIndex,photoIndex){
 const p=teamsData?.[teamIndex]?.photos?.[photoIndex];if(!p||!p.data)return;
 try{cropImage=await cropLoadImage(p.data);cropState={type:'team',teamIndex,photoIndex};cropReset();document.getElementById('cropModal').hidden=false;cropRender()}
 catch(e){console.error(e);showToast('Bild konnte nicht zum Zuschneiden geöffnet werden')}
}
async function cropOpenTournament(month,index){
 const item=(tStore()[month]||[])[index];if(!item)return;
 try{
  if(!item.data&&item.mediaId){const b=await mediaGet(item.mediaId);if(b){item.data=URL.createObjectURL(b);mediaObjectUrls.push(item.data)}}
  if(!item.data)throw new Error('Bilddaten fehlen');
  cropImage=await cropLoadImage(item.data);cropState={type:'tournament',month,index};cropReset();document.getElementById('cropModal').hidden=false;cropRender();
 }catch(e){console.error(e);showToast('Einladung konnte nicht zum Zuschneiden geöffnet werden')}
}
function cropVals(){
 let l=+document.getElementById('cropLeft').value||0,r=+document.getElementById('cropRight').value||0,t=+document.getElementById('cropTop').value||0,b=+document.getElementById('cropBottom').value||0;
 if(l+r>90){r=90-l;document.getElementById('cropRight').value=r}
 if(t+b>90){b=90-t;document.getElementById('cropBottom').value=b}
 return {l,r,t,b};
}
function cropRender(){
 if(!cropImage)return;
 const v=cropVals();
 ['Left','Right','Top','Bottom'].forEach(k=>{const e=document.getElementById('crop'+k+'Val'),i=document.getElementById('crop'+k);if(e&&i)e.textContent=i.value+'%'});
 const sx=Math.round(cropImage.naturalWidth*v.l/100),sy=Math.round(cropImage.naturalHeight*v.t/100);
 const sw=Math.max(1,Math.round(cropImage.naturalWidth*(100-v.l-v.r)/100)),sh=Math.max(1,Math.round(cropImage.naturalHeight*(100-v.t-v.b)/100));
 const maxW=820,maxH=520,scale=Math.min(1,maxW/sw,maxH/sh);
 const c=document.getElementById('cropCanvas');c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
 const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(cropImage,sx,sy,sw,sh,0,0,c.width,c.height);
}
function cropReset(){['Left','Right','Top','Bottom'].forEach(k=>{const e=document.getElementById('crop'+k);if(e)e.value=0});if(cropImage)cropRender()}
function cropClose(){document.getElementById('cropModal').hidden=true;cropState=null;cropImage=null}
async function cropApply(){
 if(!cropState||!cropImage)return;
 const v=cropVals();
 if(v.l===0&&v.r===0&&v.t===0&&v.b===0){showToast('Bitte zuerst einen Rand zum Zuschneiden einstellen');return}
 const sx=Math.round(cropImage.naturalWidth*v.l/100),sy=Math.round(cropImage.naturalHeight*v.t/100);
 const sw=Math.max(1,Math.round(cropImage.naturalWidth*(100-v.l-v.r)/100)),sh=Math.max(1,Math.round(cropImage.naturalHeight*(100-v.t-v.b)/100));
 const scale=Math.min(1,1800/Math.max(sw,sh)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
 const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(cropImage,sx,sy,sw,sh,0,0,c.width,c.height);
 try{
  if(cropState.type==='team'){
   const p=teamsData?.[cropState.teamIndex]?.photos?.[cropState.photoIndex];if(!p)throw new Error('Mannschaftsfoto nicht gefunden');
   const url=await teamEncode(c);
   const nid='m_crop_'+Date.now()+'_'+Math.random().toString(36).slice(2),st=await storeMedia('m',nid,url);
   const old=p.mediaId;p.mediaId=st.id;p.data=st.url;
   if(old&&old!==st.id){try{await mediaDelete(old)}catch(e){}}
   await teamsPersist();renderTeamsAdmin();
   showToast('Foto zugeschnitten – bitte noch „Speichern“ klicken',4000);
  }else{
   const item=(tStore()[cropState.month]||[])[cropState.index];if(!item)throw new Error('Turniereinladung nicht gefunden');
   let q=.92,url=c.toDataURL('image/jpeg',q);while(url.length>900000&&q>.62){q-=.06;url=c.toDataURL('image/jpeg',q)}
   const nid='t_crop_'+Date.now()+'_'+Math.random().toString(36).slice(2),st=await storeMedia('t',nid,url);
   const old=item.mediaId;item.mediaId=st.id;item.data=st.url;
   if(old&&old!==st.id){try{await mediaDelete(old)}catch(e){}}
   save();renderTournamentAdminPreview();renderTournamentAdminList();
   if(document.getElementById('tournaments')?.classList.contains('active'))renderTournaments();
   showToast('Einladung zugeschnitten – bitte unten auf „Speichern“ klicken',4500);
  }
  cropClose();
 }catch(e){console.error(e);showToast('Zuschneiden fehlgeschlagen: '+(e?.message||e),6000)}
}

/* ===== Mannschaftsfotos: Ausrichtung (EXIF) + Qualität ===== */
async function teamEncode(canvas){
  const MAX=880000; let scale=1,q=.92,last='';
  for(let n=0;n<20;n++){
    const w=Math.max(1,Math.round(canvas.width*scale)),h=Math.max(1,Math.round(canvas.height*scale));
    let c=canvas;
    if(scale<1){c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(canvas,0,0,w,h)}
    last=c.toDataURL('image/jpeg',q);
    if(last.length<=MAX)return last;
    if(q>.62)q=Math.max(.62,q-.06);else scale*=.88;
  }
  return last;
}
async function teamPrepareImage(file){
  let src,w,h;
  try{src=await createImageBitmap(file,{imageOrientation:'from-image'});w=src.width;h=src.height}
  catch(e){
    src=await new Promise((res,rej)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);res(im)};im.onerror=rej;im.src=u});
    w=src.naturalWidth;h=src.naturalHeight;
  }
  const s=Math.min(1,1800/Math.max(w,h)),cw=Math.max(1,Math.round(w*s)),ch=Math.max(1,Math.round(h*s));
  const c=document.createElement('canvas');c.width=cw;c.height=ch;
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cw,ch);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(src,0,0,cw,ch);
  try{src.close&&src.close()}catch(e){}
  return teamEncode(c);
}
async function teamPhotoRotate(i,j,dir){
  const t=teamsData[i],p=t&&t.photos[j];if(!p||!p.data)return;
  try{
    const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=p.data});
    const w=img.naturalWidth,h=img.naturalHeight,c=document.createElement('canvas');c.width=h;c.height=w;
    const x=c.getContext('2d');
    if(dir>0){x.translate(h,0);x.rotate(Math.PI/2)}else{x.translate(0,w);x.rotate(-Math.PI/2)}
    x.drawImage(img,0,0);
    const url=await teamEncode(c);
    if(p.mediaId){try{await mediaDelete(p.mediaId)}catch(e){}}
    const nid='m_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const st=await storeMedia('m',nid,url);
    p.id=nid;p.mediaId=st.id;p.data=st.url;
    await teamsPersist();renderTeamsAdmin();showToast('Foto gedreht – bitte noch „Speichern“ klicken',3500);
  }catch(e){console.error(e);showToast('Foto konnte nicht gedreht werden')}
}
async function teamPhotosAdd(i,input){
  const t=teamsData[i];const files=[...(input.files||[])];if(!t||!files.length)return;
  let added=0,failed=0;
  for(const f of files){
    try{
      const img=await teamPrepareImage(f);
      const id='m_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const st=await storeMedia('m',id,img);
      t.photos.push({id,name:f.name,mediaId:st.id,data:st.url});added++;
    }catch(e){failed++;console.error('Foto:',f.name,e)}
  }
  await teamsPersist();renderTeamsAdmin();
  showToast(added+' Foto(s) hinzugefügt'+(failed?' · '+failed+' fehlgeschlagen':'')+' – bitte noch „Speichern“ klicken',4000);
}

/* ---------- Mitgliederverwaltung als Reiter in der Verwaltung ---------- */
function unloadMvAdmin(){
 document.getElementById("admin")?.classList.remove("meeting-wide");
 document.getElementById("adminMain")?.classList.remove("meeting-mode");
  document.getElementById('admin')?.classList.remove('member-wide');
  const f=document.getElementById('mvAdminFrame');
  if(f){try{f.removeAttribute('srcdoc');f.src='about:blank'}catch(e){}f.remove()}
}
function renderMemberAdmin(){
  const a=document.getElementById('adminMain');
  document.getElementById('admin').classList.add('member-wide');
  applyPasswordUI();
  a.classList.add('mv-mode');
  a.innerHTML='<iframe id="mvAdminFrame" title="Mitgliederverwaltung"></iframe>';
  try{
    document.getElementById('mvAdminFrame').src='mitgliederverwaltung.html?embed=admin';
  }catch(e){
    console.error('Mitgliederverwaltung konnte nicht geladen werden:',e);
    document.getElementById('admin').classList.remove('member-wide');
    a.classList.remove('mv-mode');a.innerHTML='<h2>Mitgliederverwaltung</h2><p class="small">Die Mitgliederverwaltung konnte nicht geladen werden.</p>';
  }
}

function returnFromMemberAdmin(){
 unloadMvAdmin();
 const a=document.getElementById('adminMain');
 a.classList.remove('mv-mode');
 a.innerHTML='<h2>Verwaltung</h2><p class="small">Wähle links den gewünschten Bereich.</p>';
 applyAppPermissionsUI();
}

/* ---------- Übersichtsseite Verwaltung (früher die Einstiegsseite „Vereins-Informationssystem“) ---------- */
const OV_ITEMS=[['Termin- und Turnierplaner','tp'],['Turnierverwaltung','tv'],['Turniereinladungen','t'],['Eigene Turniereinladungen','o'],['Vereinsnachrichten','n'],['Fotos für Diashow','p'],['Fotos Sponsoren für Diashow','sp'],['Mitgliederverwaltung','mv'],['Mannschaften','m'],['Links','lk'],['Startseite','sh']];
function renderOverviewAdmin(){
  const a=document.getElementById('adminMain');
  const items=appPermissions.admin===true?[...OV_ITEMS,['Interne Cup','ic'],['Solo Pyramide','solo']]:OV_ITEMS;
  a.innerHTML='<h2>Übersichtsseite Verwaltung</h2>'
   +'<div class="card"><p class="small">Öffnet die jeweilige Seite in der Anzeige. Mit „Zurück zur Startseite“ kommst du wieder hierher in die Verwaltung.</p>'
   +'<div class="ovmenu">'+items.map(x=>'<button type="button" onclick="ovOpen(\''+x[1]+'\')">'+esc(x[0])+'</button>').join('')+'</div></div>';
}
function soloPyramideAdminUrl(){
 const base=getBaseUrl();
 return new URL('solo-pyramide.html?v=2.9.32&mode=admin-embedded',base).href;
}
function soloPyramidePreviewUrl(){
 const base=getBaseUrl();
 return new URL('solo-pyramide.html?v=2.9.32&mode=whiteboard',base).href;
}
function soloPyramideSetAdminReturnButton(){
 const b=document.querySelector('#ecwExternalHomeBar button');
 if(b){
   b.textContent='← Zurück zur Verwaltung';
   b.onclick=returnToAdminManagementView;
 }
}
function openSoloPyramideAdmin(){
 if(appPermissions.admin!==true){showToast('Solo Pyramide · Admin ist nur für Administratoren freigegeben.',5000);return;}
 window.__adminBack='menu';
 window.__adminPreviewMode=false;
 openExternalPage(soloPyramideAdminUrl(),'Solo Pyramide · Admin');
 soloPyramideSetAdminReturnButton();
}
function openSoloPyramidePreview(){
 if(appPermissions.admin!==true){showToast('Solo Pyramide · Vorschau ist nur für Administratoren freigegeben.',5000);return;}
 window.__adminBack='menu';
 window.__adminPreviewMode=true;
 openExternalPage(soloPyramidePreviewUrl(),'Solo Pyramide · Vorschau');
 soloPyramideSetAdminReturnButton();
}

function internalCupUrl(mode='home',extra=''){
 const base=getBaseUrl();
 const u=new URL('turnierauswertung.html',base);
 u.searchParams.set('v','2.5.2');
 u.searchParams.set('mode','admin-embedded');
 u.searchParams.set('seite',mode||'home');
 if(extra)u.searchParams.set(extra,'1');
 return u.href;
}
function setInternalCupAdminReturnButton(){
 setExternalReturnButton();
}
function openInternalCupAdmin(mode='home'){
 if(appPermissions.admin!==true){showToast('Interne Cup ist nur für Administratoren freigegeben.',5000);return;}
 window.__adminBack='menu';
 window.__adminPreviewMode=false;
 const labels={doppelko:'Doppel KO System',home:'Interne Cup',cup:'Cupauswertung',stockdart:'Stockdartauswertung',jahresmeisterschaft:'Ziel Jahresmeisterschaft',auslosung:'Turnierauslosung'};
 openExternalPage(internalCupUrl(mode),labels[mode]||'Interne Cup');
 setInternalCupAdminReturnButton();
}
function openInternalCupMigration(){
 if(appPermissions.admin!==true){showToast('Datenübernahme ist nur für Administratoren freigegeben.',5000);return;}
 openExternalPage(internalCupUrl('home','migration'),'Interne Cup · Datenübernahme');
 setInternalCupAdminReturnButton();
}
function renderInternalCupAdmin(){
 const a=document.getElementById('adminMain');if(!a)return;
 a.classList.remove('mv-mode');
 a.innerHTML='<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">'
  +'<div><h2 style="margin:0">Interne Cup</h2><div class="small">Turnierauswertung zentral in der Vereinsverwaltung · keine zweite Anmeldung erforderlich.</div></div>'
  +'<button type="button" onclick="returnToAdminManagementView()">← Zurück zur Verwaltung</button></div>'
  +'<div class="card"><h3>Bereich auswählen</h3><div class="ovmenu">'
  +'<button type="button" onclick="openInternalCupAdmin(\'cup\')">Cupauswertung</button>'
  +'<button type="button" onclick="openInternalCupAdmin(\'doppelko\')">Doppel KO System</button>'
  +'<button type="button" onclick="openInternalCupAdmin(\'stockdart\')">Stockdartauswertung</button>'
  +'<button type="button" onclick="openInternalCupAdmin(\'jahresmeisterschaft\')">Ziel Jahresmeisterschaft</button>'
  +'<button type="button" onclick="openInternalCupAdmin(\'auslosung\')">Turnierauslosung</button>'
  +'</div></div>'
  +'<div class="card" style="margin-top:14px"><h3>Datenübernahme</h3>'
  +'<p class="small">Einmalige Übernahme der Daten aus dem bisherigen Firebase-Projekt der Turnierauswertung. Danach wird nur noch das zentrale Firebase-Projekt der Vereinsverwaltung verwendet.</p>'
  +'<button type="button" class="primary" style="width:100%" onclick="openInternalCupMigration()">Bisherige Turnierauswertung nach Vereinsverwaltung übernehmen</button></div>';
}

function ovOpen(k){
  if(k==='solo'){openSoloPyramidePreview();return}
  if(k==='ic'){adminSection('ic');return}
  if(k==='tv'){showView('turnierverwaltung');window.__adminPreviewMode=true}
  else if(k==='mv'){adminSection('mv');return}
  else if(k==='lk'){showView('links');window.__adminPreviewMode=true}
  else adminPreviewOpen(k);
  window.__adminBack='ov';
}

/* ---------- Link-Erzeugung für die Startseite ---------- */
function renderLinksAdmin(target){
  teamsAdminEnsure();
  const a=target||document.getElementById('adminMain');
  const routes=[['Startseite','#startseite'],['Termin- und Turnierplaner','#turnierliste'],['Turniereinladungen (Monatsübersicht)','#turniere-monatsuebersicht'],['Zeitungsberichte EC Wegscheid','#zeitungsberichte'],['Eigene Turniere','#eigene-turniere'],['Vereinsnachrichten','#nachrichten'],['Fotos Verein','#fotos'],['Fotos Sponsoren','#fotos-sponsoren'],['Mitgliederverwaltung','#mitglieder'],['Links','#links'],['Mannschaften (Übersicht)','#mannschaften']]
    .concat(teamsData.map(t=>['Mannschaft: '+t.name,'#mannschaft-'+t.id]));
  const base=getBaseUrl();
  a.innerHTML='<h2>Links für die Startseite</h2>'
   +'<div class="card"><label>Adresse dieser Verwaltungsseite (Basis für alle Links)</label><input id="lkBase" type="text" value="'+esc(base)+'" oninput="lkSaveSettings()">'
   +'<label style="margin-top:10px">Adresse der Startseite (Ziel von „Zurück zur Startseite“)</label><input id="lkStart" type="text" value="'+esc((function(){try{return localStorage.getItem('verein_startseite_url')||''}catch(e){return ''}})())+'" placeholder="leer lassen = eingebaute Startseite" oninput="lkSaveSettings()">'
   +'<p class="small">Beide Adressen werden zentral in Firebase gespeichert; der Browser hält nur einen Cache. Ohne Angabe wird „'+STARTSEITE_DEFAULT+'“ im selben Ordner verwendet.</p></div>'
   +'<div class="card" style="margin-top:12px"><p class="small">Diese Links kopieren und auf der Startseite bei dem jeweiligen Button als Link eintragen.</p><div id="lkList">'
   +routes.map(r=>'<div class="list-item" style="flex-wrap:wrap"><div style="flex:1;min-width:200px"><b>'+esc(r[0])+'</b><input type="text" readonly class="lk-url" data-hash="'+esc(r[1])+'" value="'+esc(base+r[1])+'" onclick="this.select()" style="margin-top:4px"></div><button onclick="lkCopy(this)">Kopieren</button></div>').join('')
   +'</div></div>';
 renderExternalLinkOptions(a);
}
async function lkSaveSettings(){
  const b=document.getElementById('lkBase')?.value.trim()||'';
  const st=document.getElementById('lkStart')?.value.trim()||'';
  centralNavigationSettings={baseUrl:b,startseiteUrl:st};
  try{
    if(b)localStorage.setItem('verein_base_url',b);else localStorage.removeItem('verein_base_url');
    if(st)localStorage.setItem('verein_startseite_url',st);else localStorage.removeItem('verein_startseite_url');
  }catch(e){}
  const base=getBaseUrl();
  document.querySelectorAll('#lkList .lk-url').forEach(i=>{i.value=base+i.dataset.hash});
  if(!firebaseReady||!firestoreDb||!firebaseAuthUser){
    showToast('Navigation NICHT zentral gespeichert: Firebase/Anmeldung fehlt.',6000);
    return false;
  }
  if(!hasAppPermission('lk')&&!hasAppPermission('sh'))return false;
  try{
    await firestoreDb.collection('appSettings').doc('navigation').set({
      baseUrl:b,
      startseiteUrl:st,
      updatedAt:new Date().toISOString(),
      updatedBy:firebaseAuthUser.email||firebaseAuthUser.uid||'',
      appVersion:APP_VERSION
    },{merge:true});
    const status=document.getElementById('linkPreferenceStatus');
    if(status)status.textContent='Navigations- und Linkeinstellungen zentral in Firebase gespeichert.';
  }catch(e){
    console.error('Navigation Firebase:',e);
    showToast('Navigation konnte nicht zentral gespeichert werden: '+firebaseErrorText(e),6000);
  }
}
async function lkCopy(btn){
  const inp=btn.parentElement.querySelector('.lk-url');
  try{await navigator.clipboard.writeText(inp.value)}catch(e){inp.select();try{document.execCommand('copy')}catch(x){}}
  const old=btn.textContent;btn.textContent='Kopiert ✓';setTimeout(()=>btn.textContent=old,1500);
}

let mvLoaded=false;
function unloadMemberManagement(){
 const f=document.getElementById('mvFrame');
 if(f&&mvLoaded){f.removeAttribute('srcdoc');f.src='about:blank';mvLoaded=false;}
}
function openMemberManagement(){
 if(!canViewApp('mv')){showToast('Mitgliederansicht nicht freigegeben.');return;}
 showView('mitglieder');
 const f=document.getElementById('mvFrame');
 if(!f||mvLoaded)return;
 try{
   f.src='mitgliederverwaltung.html';
   mvLoaded=true;
 }catch(e){
   console.error('Mitgliederverwaltung konnte nicht geladen werden:',e);
   alert('Die Mitgliederverwaltung konnte nicht geladen werden.');
   if(firebaseAuthUser)showView('admin');else goToStartseite();
 }
}
window.addEventListener('message',e=>{
 const f=document.getElementById('mvFrame');
 if(e.data==='ecw-home'&&f&&e.source===f.contentWindow){window.__adminPreviewMode=false;showView('startseite');}
});

function updateWhiteboardScreenControls(){
 const wb=isWhiteboardUser();
 const full=!!(document.fullscreenElement||document.webkitFullscreenElement);
 const fs=document.getElementById('shFs');if(fs)fs.hidden=wb||full;
 const prompt=document.getElementById('whiteboardFullscreenPrompt');
 if(prompt)prompt.hidden=!(wb&&!full&&document.documentElement.requestFullscreen);
 // Auch am Whiteboard muss der Ausweichlink erreichbar sein, wenn eine
 // fremde Webseite die iframe-Einbettung per Sicherheitsheader blockiert.
 const newTab=document.getElementById('externalNewTab');if(newTab)newTab.hidden=!!document.getElementById('externalPage')?.classList.contains('ecw-tournament-embed');
 const note=document.getElementById('externalEmbedNote');if(note)note.textContent='Falls die Seite leer bleibt oder das Einbetten verhindert: „In neuem Tab öffnen“ verwenden.';
}
async function startWhiteboardFullscreen(){await enterPresentationFullscreen();updateWhiteboardScreenControls();}
document.addEventListener('fullscreenchange',updateWhiteboardScreenControls);
document.addEventListener('pointerdown',event=>{if(event.target.closest?.('a[target="_blank"]'))return;if(isWhiteboardUser()&&!document.fullscreenElement)enterPresentationFullscreen();},{capture:true});

let externalLinkPreferences={};
function shouldEmbedExternal(value,title){
 const url=externalWebUrl(value);if(!url)return false;
 if(isEcwTournamentAppUrl(url)||isSoloPyramideUrl(url))return true;
 if(typeof externalLinkPreferences[url]==='boolean')return externalLinkPreferences[url];
 const parsed=new URL(url);
 if(/(^|\.)google\.[a-z.]+$/i.test(parsed.hostname)||/(^|\.)kreis102\.de$/i.test(parsed.hostname))return false;
 if(/belegungsplan.*eishalle|eishalle.*belegungsplan/i.test(String(title||''))||/belegungsplan/i.test(parsed.pathname))return false;
 return true;
}
async function loadExternalLinkPreferences(){
 externalLinkPreferences={};
 if(!firestoreDb||(!firebaseAuthUser&&!isPublicWhiteboardMode()))return;
 try{const snap=await firestoreDb.collection('linkPreferences').doc('config').get();if(snap.exists)externalLinkPreferences=snap.data()?.entries||{};}catch(e){console.warn('Linkeinstellungen:',e);}
 try{shRender();}catch(e){}
}
function listExternalLinkOptions(){
 const list=new Map();
 const add=(title,value)=>{const url=externalWebUrl(shSafeUrl(value));if(url&&!shInternalHash(url))list.set(url,{title:String(title||url).replace(/\n/g,' '),url});};
 document.querySelectorAll('#links a[href]').forEach(a=>add(a.textContent,a.getAttribute('href')));
 const walk=buttons=>buttons.forEach(b=>{if(b.u)add(b.t,b.u);if(b.sub)walk(b.sub);});walk(SH.buttons);
 return [...list.values()];
}
function renderExternalLinkOptions(target){
 const main=target||document.getElementById('adminMain');const card=document.createElement('div');card.className='card';card.style.marginTop='12px';
 const heading=document.createElement('h3');heading.textContent='Externe Links öffnen';card.appendChild(heading);
 listExternalLinkOptions().forEach(item=>{const row=document.createElement('div');row.className='list-item';const label=document.createElement('span');label.textContent=item.title;label.style.flex='1';const select=document.createElement('select');select.style.width='auto';
 [['true','Eingebettet'],['false','In neuem Tab']].forEach(([v,t])=>{const option=document.createElement('option');option.value=v;option.textContent=t;select.appendChild(option);});select.value=String(shouldEmbedExternal(item.url,item.title));select.onchange=()=>saveExternalLinkPreference(item.url,select.value==='true',select);row.append(label,select);card.appendChild(row);});
 const status=document.createElement('p');status.id='linkPreferenceStatus';status.className='small';status.textContent='Änderungen werden für alle Benutzer in Firebase gespeichert.';card.appendChild(status);main.appendChild(card);
}
async function saveExternalLinkPreference(url,embed,select){
 if(!hasAppPermission('lk')&&!hasAppPermission('sh'))return;
 if(!ecwRequireCentralSave('Linkeinstellung speichern'))return;
 const previous=externalLinkPreferences[url];externalLinkPreferences[url]=!!embed;if(select)select.disabled=true;
 const status=document.getElementById('linkPreferenceStatus');
 try{await firestoreDb.collection('linkPreferences').doc('config').set({entries:externalLinkPreferences,updatedAt:new Date().toISOString()});if(status)status.textContent='Linkeinstellung gespeichert.';shRender();}
 catch(e){if(previous===undefined)delete externalLinkPreferences[url];else externalLinkPreferences[url]=previous;if(select)select.value=String(shouldEmbedExternal(url));if(status)status.textContent='Speichern fehlgeschlagen: '+(e.code||e.message);}
 finally{if(select)select.disabled=false;}
}


function isLiveStartlistUrl(value){
 try{
   const u=new URL(value,location.href);
   return u.origin==='https://ecwegscheid.github.io'
     && /^\/Vereinsverwaltung-Aktuell\/live-startlisten\.html$/i.test(u.pathname);
 }catch(e){return false}
}
function ecwTournamentModeFromUrl(value){
 try{
   const u=new URL(value,location.href);
   let mode=(u.searchParams.get('seite')||'').toLowerCase();
   if(!mode){
     const vv=String(u.searchParams.get('v')||'');
     const mm=vv.match(/\?seite=(cup|jahresmeisterschaft|auslosung|stockdart|home)/i);
     if(mm)mode=mm[1].toLowerCase();
   }
   return mode||'home';
 }catch(e){return ''}
}
function isEcwTournamentAppUrl(value){
 try{
   const u=new URL(value,location.href);
   const mode=ecwTournamentModeFromUrl(u.href);
   if(!['cup','doppelko','jahresmeisterschaft','auslosung','stockdart','home'].includes(mode))return false;
   // Auch lokale Testkopien, GitHub-Subpfade und zentral gespeicherte Links
   // muessen dieselbe interne Vollbildansicht verwenden.
   const localFile=/(?:^|\/)turnierauswertung\.html$/i.test(u.pathname);
   const legacy=u.hostname==='ecwegscheid.github.io' && /^\/Turnierverwaltung\/?$/i.test(u.pathname);
   const trustedLocal=u.origin===location.origin && localFile;
   const trustedGithub=u.hostname==='ecwegscheid.github.io' && localFile;
   return trustedLocal||trustedGithub||legacy;
 }catch(e){return false}
}
function isSoloPyramideUrl(value){
 try{
   const u=new URL(value,location.href);
   const localSolo=u.origin===location.origin && /(?:^|\/)solo-pyramide\.html$/i.test(u.pathname);
   const legacySolo=u.origin==='https://ecwegscheid.github.io' && /^\/Solo-Pyramide\/(?:index\.html)?$/i.test(u.pathname);
   return localSolo || legacySolo;
 }catch(e){return false}
}
const WHITEBOARD_RESULT_DEFAULTS={
  cup:true,
  jahresmeisterschaft:true,
  auslosung:true,
  stockdart:false,
  soloPyramide:true,
  doppelko:true
};
let whiteboardResultPermissions={...WHITEBOARD_RESULT_DEFAULTS};

function ecwInternalResultMode(value){
 try{
   const u=new URL(value,location.href);
   if(isSoloPyramideUrl(u.href))return 'soloPyramide';
   const local=u.origin===location.origin && /(?:^|\/)turnierauswertung\.html$/i.test(u.pathname);
   const legacy=u.origin==='https://ecwegscheid.github.io' && /^\/Turnierverwaltung\/?$/i.test(u.pathname);
   if(!local&&!legacy)return '';
   const mode=ecwTournamentModeFromUrl(u.href);
   return ['cup','doppelko','jahresmeisterschaft','auslosung','stockdart'].includes(mode)?mode:'';
 }catch(e){return ''}
}
function isWhiteboardInternalResultAllowed(value){
 const mode=ecwInternalResultMode(value);
 if(mode==='stockdart')return false; // Whiteboard: niemals Stockdart.
 if(['cup','doppelko','jahresmeisterschaft','auslosung','soloPyramide'].includes(mode))return true;
 return false;
}
async function loadWhiteboardResultPermissions(){
 if(!firestoreDb)return whiteboardResultPermissions;
 try{
   const ref=firestoreDb.collection('appSettings').doc('whiteboardFreigaben');
   const snap=await ref.get({source:'server'}).catch(()=>ref.get());
   if(snap.exists){
     const x=snap.data()||{};
     whiteboardResultPermissions={
       cup:x.cup!==false,
       jahresmeisterschaft:x.jahresmeisterschaft!==false,
       auslosung:x.auslosung!==false,
       stockdart:false,
       soloPyramide:x.soloPyramide!==false
     };
   }else whiteboardResultPermissions={...WHITEBOARD_RESULT_DEFAULTS};
 }catch(e){
   console.warn('Whiteboard-Freigaben:',e);
   whiteboardResultPermissions={...WHITEBOARD_RESULT_DEFAULTS};
 }
 try{shRender()}catch(e){}
 return whiteboardResultPermissions;
}
async function saveWhiteboardResultPermissions(){
 if(appPermissions.admin!==true){showToast('Nur Administratoren dürfen Whiteboard-Freigaben ändern.',5000);return;}
 const get=id=>!!document.getElementById(id)?.checked;
 const next={
   cup:get('wbPermCup'),
   jahresmeisterschaft:get('wbPermJm'),
   auslosung:get('wbPermAuslosung'),
   stockdart:false, // Stockdart bleibt ausschliesslich ADMIN vorbehalten.
   soloPyramide:get('wbPermSoloPyramide'),
   doppelko:get('wbPermDoppelKo'),
   updatedAt:new Date().toISOString()
 };
 const status=document.getElementById('wbPermStatus');
 if(status)status.textContent='Speichern …';
 try{
   await firestoreDb.collection('appSettings').doc('whiteboardFreigaben').set(next,{merge:true});
   whiteboardResultPermissions={...whiteboardResultPermissions,...next};
   if(status)status.textContent='Whiteboard-Freigaben gespeichert.';
   showToast('Whiteboard-Freigaben gespeichert');
   try{shRender()}catch(e){}
 }catch(e){
   console.error(e);
   if(status)status.textContent='Speichern fehlgeschlagen: '+(e.code||e.message||e);
   showToast('Whiteboard-Freigaben konnten nicht gespeichert werden.',6000);
 }
}
function renderWhiteboardPermissionsAdmin(target){
 const a=target||document.getElementById('adminMain');if(!a)return;
 const p=whiteboardResultPermissions||WHITEBOARD_RESULT_DEFAULTS;
 a.innerHTML='<h2>Whiteboard-Freigaben</h2>'
  +'<div class="card"><p class="small">Hier legst du fest, welche Bereiche unter „Ergebnisse Turniere intern“ am öffentlichen Whiteboard ohne zusätzliche Anmeldung geöffnet werden dürfen.</p>'
  +'<label class="checkbox-row"><input id="wbPermCup" type="checkbox" '+(p.cup?'checked':'')+'><span>Cupauswertung</span></label>'
  +'<label class="checkbox-row"><input id="wbPermJm" type="checkbox" '+(p.jahresmeisterschaft?'checked':'')+'><span>Jahresmeisterschaft Ziel</span></label>'
  +'<label class="checkbox-row"><input id="wbPermAuslosung" type="checkbox" '+(p.auslosung?'checked':'')+'><span>Turnierauslosung</span></label>'
  +'<p class="small">Stockdartauswertung: ausschliesslich Administrator (nicht fuer das Whiteboard freigegeben).</p>'
  +'<label class="checkbox-row"><input id="wbPermDoppelKo" type="checkbox" '+(p.doppelko!==false?'checked':'')+'><span>Doppel KO System</span></label>'
  +'<label class="checkbox-row"><input id="wbPermSoloPyramide" type="checkbox" '+(p.soloPyramide?'checked':'')+'><span>Solo Pyramide</span></label>'
  +'<button class="primary" style="width:100%;margin-top:14px" onclick="saveWhiteboardResultPermissions()">Freigaben speichern</button>'
  +'<div id="wbPermStatus" class="small" style="margin-top:10px"></div></div>'
  +'<div class="card" style="margin-top:12px"><b>Hinweis</b><div class="small" style="margin-top:6px">Diese Einstellung betrifft nur die internen Ergebnisbereiche. Die vollständige Turnierverwaltung, Mannschaftsmeldungen und Adminfunktionen bleiben geschützt.</div></div>';
}
function externalWebUrl(value){value=window.ecwLocalUrl(value);
 try{const parsed=new URL(value,location.href);return ['http:','https:'].includes(parsed.protocol)?parsed.href:'';}catch(e){return '';}
}
function clearExternalPage(){
 const frame=document.getElementById('externalFrame');if(frame)frame.src='about:blank';
 const page=document.getElementById('externalPage');if(page)page.classList.remove('ecw-tournament-embed','ecw-reservation-embed');
}
let externalPreviousView='startseite',externalPreviousSubmenu=-1;
// V2.9.0: Ein oeffentlicher Whiteboard-Start ist KEIN Firebase-Login.
// Nur eine tatsaechlich angemeldete und in Firestore berechtigte Person darf
// die eingebetteten internen Ergebnisprogramme im Whiteboardmodus starten.
window.__ecwVerifiedResultUid=null;
window.__ecwVerifiedWhiteboardUid=null;
window.__ecwPendingInternalResult=null;
async function ecwVerifyResultUser(){
 const u=firebaseAuthUser;
 if(!u||!firestoreDb)return false;
 try{
  const snap=await firestoreDb.collection('users').doc(u.uid).get();
  if(!snap.exists)return false;
  const profile=snap.data()||{};
  const legacy=!Object.prototype.hasOwnProperty.call(profile,'whiteboard')
   && profile.shView===true && profile.tp===true
   && !['tv','jm','t','o','n','p','sp','mv','m','lk','sh'].some(k=>profile[k]===true);
  const isVerifiedWhiteboard=profile.whiteboard===true ||
   String(profile.role||'').trim().toLowerCase()==='whiteboard' || legacy;
  // Nur ein aktuell von Firestore bestaetigtes Whiteboard-Profil darf
  // beim erneuten Oeffnen der Solo-Pyramide den Kiosk-Modus erhalten.
  window.__ecwVerifiedWhiteboardUid=isVerifiedWhiteboard?u.uid:null;
  return profile.admin===true || isVerifiedWhiteboard;
 }catch(e){window.__ecwVerifiedWhiteboardUid=null;console.error('Ergebnis-Berechtigung:',e);return false;}
}
async function openExternalPage(value,title){
 const checkUrl=externalWebUrl(value);
 const resultApp=isEcwTournamentAppUrl(checkUrl)||isSoloPyramideUrl(checkUrl);
 if(resultApp && (isPublicWhiteboardMode()||isWhiteboardUser()||isWhiteboardKioskAccount())){
  // Ohne echte Firebase-Sitzung darf der Browser die App nicht als Whiteboard starten.
  if(!firebaseAuthUser){
   window.__ecwVerifiedResultUid=null;
   window.__ecwVerifiedWhiteboardUid=null;
   window.__ecwPendingInternalResult={url:value,title:title};
   loginPurpose='internalResult';
   showView('login');
   return;
  }
  if(!await ecwVerifyResultUser()){
   window.__ecwVerifiedResultUid=null;
   window.__ecwVerifiedWhiteboardUid=null;
   showToast('Benutzer nicht fuer interne Ergebnisse freigegeben.',5000);
   return;
  }
  window.__ecwVerifiedResultUid=firebaseAuthUser.uid;
 }
 const url=externalWebUrl(value);if(!url){showToast('Dieser Link kann nicht eingebettet werden.');return;}
 const isEcwTournament=isEcwTournamentAppUrl(url);
 const isSoloPyramide=isSoloPyramideUrl(url);
 const isEcwInternalApp=isEcwTournament||isSoloPyramide;
 const page=document.getElementById('externalPage');
 if(page){
   page.classList.toggle('ecw-tournament-embed',isEcwInternalApp);
   // V2.9.16: Reservierung ist ein eingebetteter Fremdinhalt.
   // Der Zurueck-Button muss deshalb im Elternfenster sichtbar bleiben.
   page.classList.toggle('ecw-reservation-embed',/(?:^|\/)ecw-reservierung-v2955\.html(?:[?#]|$)/i.test(url));
 }
 const barTitle=document.getElementById('ecwExternalHomeTitle');
 if(barTitle)barTitle.textContent=isEcwInternalApp?'EC Wegscheid · '+String(title||(isSoloPyramide?'Solo Pyramide':'Turnierauswertung')).replace(/\n/g,' '):'EC Wegscheid Vereinsverwaltung';
 if(!firebaseAuthUser){
   if(isPublicWhiteboardMode()){
     if((isEcwTournamentAppUrl(url)||isSoloPyramideUrl(url)) && !isWhiteboardInternalResultAllowed(url)){
       showToast('Dieser interne Ergebnisbereich ist im Whiteboardmodus nicht freigegeben.',5000);
       return;
     }
   }else{
     loginPurpose='admin';showView('login');return;
   }
 }
 const internal=shInternalHash(url);if(internal){shGo(internal);return;}
 const active=document.querySelector('.view.active');
 if(active&&active.id!=='externalPage'){externalPreviousView=active.id;externalPreviousSubmenu=active.id==='startseite'?shOpen:-1;}
 setExternalReturnButton();
 const isReservationApp=/(?:^|\/)ecw-reservierung-v2955\.html(?:[?#]|$)/i.test(url);
 document.getElementById('externalPrevious').hidden=isReservationApp||externalPreviousView==='admin'||(externalPreviousView==='startseite'&&externalPreviousSubmenu<0);
 document.getElementById('externalTitle').textContent=String(title||'Externe Webseite').replace(/\n/g,' ');
 let frameUrl=url;
 // V2.5.2: Ein zentraler Aufruf fuer Startseite UND Verwaltung.
 // Versionierung der gespeicherten Startseitenlinks wird hier vereinheitlicht.
 if(isEcwTournament){
   try{
     const normalized=new URL('turnierauswertung.html',location.href);
     normalized.searchParams.set('v','2.9.29');
     normalized.searchParams.set('seite',ecwTournamentModeFromUrl(url));
     if(!isPublicWhiteboardMode() && appPermissions.admin===true){
       normalized.searchParams.set('mode','admin-embedded');
     }
     frameUrl=normalized.href;
   }catch(e){console.warn('Cup-Aufruf:',e);}
 }
 // V2.9.0: Auch bei einer getrennten GitHub-Testseite MUSS die lokal
 // hochgeladene Solo-Pyramide getestet werden, nicht die alte Produktivseite.
 if(isSoloPyramide){
   try{
     const localSolo=new URL('solo-pyramide.html',location.href);
     localSolo.searchParams.set('v','2.9.29');
     if(new URL(url).searchParams.get('mode')==='admin-embedded')localSolo.searchParams.set('mode','admin-embedded');
     else if(firebaseAuthUser && !isWhiteboardUser())localSolo.searchParams.set('mode',appPermissions.admin===true?'admin-embedded':'infosystem');
     frameUrl=localSolo.href;
   }catch(e){console.warn('Solo-Testpfad:',e);}
 }
 // V2.8.9: Auch ein regulär mit Firebase angemeldetes Whiteboard muss den
 // Whiteboard-Modus an die eingebettete Solo-Pyramide übergeben.
 // Die Solo-Pyramide selbst prüft zusätzlich die authentifizierte Eltern-Sitzung.
 // V2.9.1: Die Solo-Pyramide wird bei jedem Oeffnen anhand des frisch
 // geprueften Firestore-Profils als Whiteboard gestartet. Keine zweite
 // Passwortabfrage und keine Speicherung eines privilegierten Solo-Logins.
 // V2.9.2: Dieselbe frisch in Firestore gepruefte Whiteboard-Sitzung
 // fuer ALLE Ergebnisprogramme nutzen. Kein erneutes Login in den iFrames.
 // Nicht der URL-Parameter, sondern die bestaetigte Eltern-Sitzung erteilt Rechte.
 const verifiedWhiteboard=!!(firebaseAuthUser &&
    window.__ecwVerifiedResultUid===firebaseAuthUser.uid &&
    window.__ecwVerifiedWhiteboardUid===firebaseAuthUser.uid);
 if(verifiedWhiteboard && isWhiteboardInternalResultAllowed(url)){
  try{
   const wu=new URL(frameUrl,location.href);
   if(isSoloPyramide)wu.searchParams.set('mode','whiteboard');
   else wu.searchParams.set('whiteboard','1');
   frameUrl=wu.href;
  }catch(e){}
 }else if(isSoloPyramide && firebaseAuthUser){
  // Admin erhaelt seine bereits authentifizierte zentrale Sitzung.
  try{
   const wu=new URL(frameUrl,location.href);
   wu.searchParams.set('mode',appPermissions.admin===true?'admin-embedded':'infosystem');
   frameUrl=wu.href;
  }catch(e){}
 }
 const direct=document.getElementById('externalNewTab');direct.href=frameUrl;
 showView('externalPage');
 const frame=document.getElementById('externalFrame');
 frame.setAttribute('sandbox',isEcwInternalApp?'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals':(isWhiteboardUser()?'allow-scripts allow-forms allow-same-origin allow-modals':'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals'));
 updateWhiteboardScreenControls();frame.title=String(title||'Externe Webseite');frame.src=frameUrl;
}
function setExternalReturnButton(){
 const b=document.querySelector('#ecwExternalHomeBar button');if(!b)return;
 const backToAdmin=externalPreviousView==='admin' && !!firebaseAuthUser && appPermissions.admin===true;
 b.textContent=document.getElementById('externalPage')?.classList.contains('ecw-reservation-embed')?'← Zurück zum Startmenü':(backToAdmin?'← Zurück zur Verwaltung':'← Zurück zur Startseite');
 b.onclick=document.getElementById('externalPage')?.classList.contains('ecw-reservation-embed')?function(){externalPreviousView='startseite';closeExternalPage();}:closeExternalPage;
}
function backExternalPrevious(){
 clearExternalPage();window.__adminPreviewMode=false;
 shOpen=externalPreviousView==='startseite'?externalPreviousSubmenu:-1;
 showView(externalPreviousView||'startseite');
}
function closeExternalPage(){
 const adminBack=externalPreviousView==='admin'&&!!firebaseAuthUser&&appPermissions.admin===true;
 clearExternalPage();shOpen=-1;window.__adminPreviewMode=false;
 if(adminBack){returnToAdminManagementView();return;}
 try{history.replaceState(null,'',location.pathname+location.search+'#startseite');}catch(e){}
 showView('startseite');
}
document.addEventListener('click',event=>{
 const anchor=event.target.closest?.('#links a[href]');if(!anchor||event.defaultPrevented)return;
 const url=externalWebUrl(anchor.getAttribute('href'));if(!url){if(isWhiteboardUser())event.preventDefault();return;}
 if(!shouldEmbedExternal(url,anchor.textContent.trim())){
   // Gleiche neue-Tab-Logik wie bei den konfigurierbaren Startseiten-Buttons.
   anchor.target='_blank';anchor.rel='noopener noreferrer';return;
 }
 event.preventDefault();openExternalPage(url,anchor.textContent.trim());
});

function showView(id){
 if(id!=='externalPage')clearExternalPage();
 if(id==='userPassword'&&!canChangeOwnPassword()){showToast('Benutzerkennwort ändern ist für dieses Konto nicht verfügbar.');return;}
 if((id==='admin'||id==='home') && (isWhiteboardUser()||isPublicWhiteboardMode())){showView('startseite');return;}
 const viewPerm={tournamentPlanner:'tp',turnierverwaltung:'tv',tournamentMonths:'t',tournaments:'t',ownTournaments:'o',news:'n',photos:'p',sponsorPhotos:'sp',mitglieder:'mv',teams:'m',teamDetail:'m',links:'lk',startseite:'shView'};
 const pk=id==='tournaments'&&tCollection==='ownTournaments'?'o':viewPerm[id];
 if(pk && !canViewApp(pk)){showToast('Diese Anwendung ist für diesen Benutzer nicht freigegeben.',4000);return;}
 if(id!=='admin'){try{unloadMvAdmin()}catch(e){}}
 if(id==='home'){loginPurpose='admin';id=(firebaseAuthUser||currentUser==='admin')?'admin':'login';}
 if(id!=='mitglieder')unloadMemberManagement();
 try{closeInvitationZoom()}catch(e){}
 if(id!=='news'){try{stopNews()}catch(e){}}
 if(id==='admin' && !firebaseAuthUser && currentUser!=='admin'){ showView('login'); return; }
 if(id==='login'){
   const emEl=document.getElementById('firebaseLoginEmail');
   if(emEl&&!emEl.value){try{emEl.value=localStorage.getItem('verein_admin_email')||''}catch(e){}}
   const isPlanner=loginPurpose==='planner';
   const t=document.getElementById('loginTitle'),s=document.getElementById('loginSubtitle'),h=document.getElementById('loginHeading'),hi=document.getElementById('loginHint');
   if(t)t.textContent=isPlanner?'Termin- und Turnierplaner':'Verwaltung';
   if(s)s.textContent='Benutzer-Anmeldung';
   if(h)h.textContent=isPlanner?'Termin- und Turnierplaner – Zugang anmelden':'Benutzer anmelden';
   if(hi)hi.textContent=isPlanner?'Für den Termin- und Turnierplaner ist eine einmalige Anmeldung mit E-Mail-Adresse und Kennwort erforderlich. Die Anmeldung bleibt danach bestehen.':'Bitte mit deiner E-Mail-Adresse und deinem Kennwort anmelden.';
 }
 document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
 document.getElementById(id).classList.add('active');
 if(isWhiteboardUser()||['externalPage','tournamentMonths','tournaments','news','photos','sponsorPhotos','tournamentPlanner','teams','teamDetail','turnierverwaltung'].includes(id)){
   enterPresentationFullscreen();
 }else{
   leavePresentationFullscreen();
 }
 if(['tournamentMonths','tournaments'].includes(id))updateTournamentTitles();
 if(id==='tournamentMonths')renderTournamentMonthOverview();
 if(id==='tournaments'){hydrateMedia().then(()=>initTournaments()).catch(()=>initTournaments());}
 if(id==='news')renderNews();
 if(id==='startseite')shRender();
 if(id==='userPassword')renderUserPasswordPanel();
 if(id==='turnierverwaltung'){
   if(appPermissions.admin!==true){
     showToast('Der vollständige Verwaltungsbereich ist nur im Adminmodus verfügbar.',5000);
     if(isPublicWhiteboardMode()){showView('startseite');return;}
     showView('admin');return;
   }
   const f=document.getElementById('turnierverwaltungFrame');
   if(f){
     const wanted=f.dataset.src||'turnierverwaltung.html?v=2.5.2';
     const cur=String(f.getAttribute('src')||'');
     if(!cur || cur==='about:blank')f.src=wanted;
   }
 }
  if(id==='teams')renderTeamsOverview();
 if(id==='teamDetail')renderTeamDetail();
 if(id==='tournamentPlanner'){
   // WICHTIG: showView darf niemals selbst zum aktuellen Termin springen.
   // Diese Funktion wird auch durch interne Navigation/Neuladen verwendet.
   // Der Sprung "Aktueller Termin" ist ausschließlich eine bewusste
   // Benutzeraktion über tpOpenTournamentPlannerView().
   renderTournamentPlanner();
   if(!centralFirebaseReady)tpRefreshFromFirebase(false)
     .then(ok=>{if(ok && document.getElementById('tournamentPlanner')?.classList.contains('active'))requestAnimationFrame(()=>tpScrollToCurrentEntry());})
     .catch(e=>console.error('Turnierplaner aktualisieren:',e));
 }
 if(id==='photos'||id==='sponsorPhotos'){pCollection=(id==='sponsorPhotos')?'sponsorPhotos':'photos';loadPhotoPresentation(pCollection).catch(e=>console.error('Fotoanzeige:',e));}
 updateWhiteboardScreenControls();
 updateAdminPreviewBackButtons();
 if(id==='admin'){
   const u=data.users.find(x=>x.id===currentUser);
   const lab=document.getElementById('currentUserLabel');
   if(lab)lab.textContent=firebaseAuthUser?.email||(u?u.name:'');
   const requested=window.__adminBack;
   window.__adminBack=null;
   if(requested==='menu')renderAdminMenuLanding();
   else{
     const _bk=requested||(appPermissions.admin?'t':Object.keys(APP_PERMISSIONS).find(k=>!k.endsWith('View')&&hasAppPermission(k)))||'password';
     adminSection(_bk);
   }
 }
}

function authErrorText(e){
 const c=e?.code||'';
 if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-login-credentials'].includes(c))return 'E-Mail oder Kennwort falsch.';
 if(c==='auth/invalid-email')return 'Ungültige E-Mail-Adresse.';
 if(c==='auth/too-many-requests')return 'Zu viele Versuche – bitte später erneut versuchen.';
 if(c==='auth/network-request-failed')return 'Keine Internetverbindung.';
 if(c==='auth/operation-not-allowed')return 'Die Anmeldung per E-Mail/Kennwort ist in Firebase nicht aktiviert.';
 if(c==='auth/user-disabled')return 'Dieses Konto ist deaktiviert.';
 return e?.message||'Anmeldung fehlgeschlagen.';
}
async function loginFirebaseAdmin(){
 enterPresentationFullscreen();
 const email=(document.getElementById('firebaseLoginEmail')?.value||'').trim();
 const pw=document.getElementById('firebaseLoginPassword')?.value||'';
 const status=document.getElementById('firebaseLoginStatus');
 const setStatus=t=>{if(status)status.textContent=t};
 if(!firebaseReady||!window.firebaseAuth){setStatus('Firebase ist nicht verfügbar – Internetverbindung prüfen.');return;}
 if(!email||!pw){setStatus('Bitte E-Mail und Kennwort eingeben.');return;}
 const purpose=loginPurpose||'admin';
 try{
   setStatus('Anmeldung läuft …');
   // Admin-Anmeldung wird wie bisher nicht dauerhaft gemerkt (nach Neuladen/Schließen wieder abgemeldet).
   // Die Anmeldung für den Turnierplaner (Listenansicht, Button 6) bleibt dagegen dauerhaft bestehen,
   // damit dort gemachte Eingaben auch nach einem Neuladen in Firebase gespeichert werden.
   const persistence=firebase.auth.Auth.Persistence.LOCAL;
   await window.firebaseAuth.setPersistence(persistence);
   await window.firebaseAuth.signInWithEmailAndPassword(email,pw);
   firebaseAuthUser=window.firebaseAuth.currentUser; window.firebaseAuthUser=firebaseAuthUser;
   await loadAppPermissions(window.firebaseAuth.currentUser);
   if(isWhiteboardUser() || isWhiteboardKioskAccount()){
     try{
       localStorage.setItem('ecw_whiteboard_trusted_device','1');
       localStorage.setItem('ecw_whiteboard_last_uid',String(window.firebaseAuth.currentUser?.uid||''));
       localStorage.setItem('ecw_whiteboard_last_email',String(window.firebaseAuth.currentUser?.email||email||''));
     }catch(e){}
   }
 }catch(e){console.error(e);const t=authErrorText(e);setStatus(t);showToast(t,4000);return;}
 userSwitchPending=false;
 try{localStorage.setItem('verein_admin_email',email)}catch(e){}
 const pwField=document.getElementById('firebaseLoginPassword');if(pwField)pwField.value='';
 // Erst die öffentlichen Firebase-Daten fertig laden, damit nichts Veraltetes aus dem Browser die Firebase-Daten überschreibt.
 if(window.__publicLoadPromise){
   setStatus('Daten werden geladen …');
   try{await Promise.race([window.__publicLoadPromise,new Promise(r=>setTimeout(r,5000))])}catch(e){}
 }
 if(window.__ecwPendingInternalResult){
  const pending=window.__ecwPendingInternalResult;
  window.__ecwPendingInternalResult=null;
  setStatus('Anmeldung erfolgreich. Ergebnisprogramm wird geoeffnet ...');
  await openExternalPage(pending.url,pending.title);
  return;
 }
 if(!Object.keys(APP_PERMISSIONS).some(k=>canViewApp(k))){setStatus('Angemeldet. Noch keine Anwendungen freigegeben.');if(canChangeOwnPassword())showView('userPassword');return;}
 if(prefersPresentationStart()){setStatus('Anmeldung erfolgreich.');currentUser=null;window.__adminPreviewMode=false;showView('startseite');return;}
 setStatus('Anmeldung erfolgreich.');
 updateHomeAdminButton();
 if(purpose==='planner'&&canViewApp('tp')){ loginPurpose='admin'; tpOpenTournamentPlannerView(true); return; }
 if(!appPermissions.admin&&!Object.keys(APP_PERMISSIONS).some(k=>!k.endsWith('View')&&hasAppPermission(k))){if(canViewApp('sh'))showView('startseite');else showView('userPassword');return;}
 currentUser=appPermissions.admin===true?'admin':null;
 showView('admin');
}
async function resetAdminPassword(){
 if(isWhiteboardUser()){showToast('Kennwortverwaltung für dieses Konto gesperrt.');return;}
 const email=(document.getElementById('firebaseLoginEmail')?.value||'').trim();
 const status=document.getElementById('firebaseLoginStatus');
 const setStatus=t=>{if(status)status.textContent=t};
 if(!firebaseReady||!window.firebaseAuth){setStatus('Firebase ist nicht verfügbar – Internetverbindung prüfen.');return;}
 if(!email){setStatus('Bitte oben die E-Mail-Adresse eingeben.');return;}
 try{
   await window.firebaseAuth.sendPasswordResetEmail(email);
   setStatus('Falls für diese Adresse ein Konto existiert, wurde eine E-Mail zum Zurücksetzen des Kennworts gesendet.');
 }catch(e){console.error(e);setStatus(authErrorText(e));}
}

let userPasswordBack='startseite', userPasswordBusy=false, userPasswordMemberBack=false;
function openUserPassword(){
 if(!canChangeOwnPassword()){showToast('Benutzerkennwort ändern ist für dieses Konto nicht verfügbar.');return;}
 const active=document.querySelector('.view.active');
 if(active&&active.id!=='userPassword'){userPasswordBack=active.id;userPasswordMemberBack=active.id==='admin'&&active.classList.contains('member-wide');}
 showView('userPassword');
}
function closeUserPassword(){
 ['ownCurrentPassword','ownNewPassword','ownRepeatPassword'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
 if(userPasswordBack==='admin'&&userPasswordMemberBack)window.__adminBack='mv';
 userPasswordMemberBack=false;
 showView(userPasswordBack==='userPassword'?'startseite':userPasswordBack);
}
function renderUserPasswordPanel(){
 const panel=document.getElementById('userPasswordPanel');
 panel.innerHTML='<div class="card"><p>Angemeldet als: <b>'+esc(firebaseAuthUser.email||'')+'</b></p><form onsubmit="event.preventDefault();changeOwnPassword()"><label>Aktuelles Kennwort</label><input id="ownCurrentPassword" type="password" autocomplete="current-password" required><label>Neues Kennwort</label><input id="ownNewPassword" type="password" autocomplete="new-password" minlength="6" required><label>Neues Kennwort wiederholen</label><input id="ownRepeatPassword" type="password" autocomplete="new-password" minlength="6" required><button class="primary" data-password-action type="submit" style="margin-top:12px">Kennwort ändern</button></form></div><div class="card" style="margin-top:12px"><p>Alternativ kannst du dir einen Link zum Zurücksetzen an deine eigene E-Mail-Adresse senden lassen.</p><button data-password-action type="button" onclick="resetOwnPasswordFromPanel()">Kennwort per E-Mail zurücksetzen</button></div><p id="ownPasswordStatus" role="status" aria-live="polite"></p>';
}
function ownPasswordStatus(message){const el=document.getElementById('ownPasswordStatus');if(el)el.textContent=message;}
function setPasswordBusy(value){userPasswordBusy=value;document.querySelectorAll('[data-password-action]').forEach(el=>el.disabled=value);}
async function changeOwnPassword(){
 if(!canChangeOwnPassword()||userPasswordBusy)return;
 const user=firebaseAuthUser;
 const current=document.getElementById('ownCurrentPassword').value;
 const next=document.getElementById('ownNewPassword').value;
 const repeat=document.getElementById('ownRepeatPassword').value;
 if(!current){ownPasswordStatus('Bitte aktuelles Kennwort eingeben.');return;}
 if(next.length<6){ownPasswordStatus('Das neue Kennwort muss mindestens 6 Zeichen haben.');return;}
 if(next!==repeat){ownPasswordStatus('Die neuen Kennwörter stimmen nicht überein.');return;}
 setPasswordBusy(true);ownPasswordStatus('Kennwort wird geändert …');
 try{
  const credential=firebase.auth.EmailAuthProvider.credential(user.email,current);
  await user.reauthenticateWithCredential(credential);
  if(firebaseAuthUser?.uid!==user.uid||!canChangeOwnPassword())throw new Error('Das angemeldete Konto hat sich geändert.');
  await user.updatePassword(next);
  ['ownCurrentPassword','ownNewPassword','ownRepeatPassword'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ownPasswordStatus('Dein Kennwort wurde erfolgreich geändert.');
 }catch(e){ownPasswordStatus(e.code==='auth/weak-password'?'Das Kennwort erfüllt die Firebase-Kennwortvorgaben nicht.':authErrorText(e));}
 finally{setPasswordBusy(false);}
}
async function resetOwnPasswordFromPanel(){
 if(!canChangeOwnPassword()||userPasswordBusy)return;
 setPasswordBusy(true);ownPasswordStatus('E-Mail wird angefordert …');
 try{window.firebaseAuth.languageCode='de';await window.firebaseAuth.sendPasswordResetEmail(firebaseAuthUser.email);ownPasswordStatus('Reset-E-Mail angefordert. Bitte auch den Spam-Ordner prüfen.');}
 catch(e){ownPasswordStatus(authErrorText(e));}
 finally{setPasswordBusy(false);}
}

async function sendOwnPasswordReset(){
 if(!canChangeOwnPassword()){showToast('Kennwortverwaltung für dieses Konto gesperrt.');return;}
 const email=firebaseAuthUser?.email||'';
 const info=document.getElementById('authInfo');
 if(!email){if(info)info.textContent='Nicht angemeldet.';return;}
 try{await window.firebaseAuth.sendPasswordResetEmail(email);if(info)info.textContent='E-Mail zum Zurücksetzen des Kennworts wurde an '+email+' gesendet.';}
 catch(e){console.error(e);if(info)info.textContent=authErrorText(e);}
}


function updateAdminPreviewBackButtons(){
 const preview=!!window.__adminPreviewMode;
 const tvView=document.getElementById('turnierverwaltung');
 const tvActive=!!(preview&&tvView?.classList.contains('active'));
 if(tvView)tvView.classList.toggle('tv-fullscreen',tvActive);
 document.body.classList.toggle('tv-preview-open',tvActive);

 const tvb=document.getElementById('tvPreviewBack');
 if(tvb)tvb.hidden=!tvActive;

 const mvb=document.getElementById('mvPreviewBack');
 if(mvb)mvb.hidden=!(preview&&document.getElementById('mitglieder')?.classList.contains('active'));
}
function returnToAdminManagementView(){
 window.__ecwAdminHomeReturn=false;
 window.__adminPreviewMode=false;
 const tvView=document.getElementById('turnierverwaltung');
 if(tvView)tvView.classList.remove('tv-fullscreen');
 document.body.classList.remove('tv-preview-open');
 try{leavePresentationFullscreen()}catch(e){}
 updateAdminPreviewBackButtons();
 window.__adminBack='menu';
 showView('admin');
}
function returnFromAdminPreviewToMenu(){
 returnToAdminManagementView();
}
function returnToPowerPoint(){
 if(window.__ecwAdminHomeReturn&&firebaseAuthUser&&appPermissions.admin===true){returnToAdminManagementView();return;}
 if(isWhiteboardUser()){window.__adminPreviewMode=false;showView('startseite');return;}
 if(window.__adminPreviewMode){
   window.__adminPreviewMode=false;
   try{leavePresentationFullscreen()}catch(e){}
   showView('admin');
   return;
 }
 // V2.9.11: Firebase-Sitzung und Benutzerkontext beim Ansichtswechsel erhalten.
 if(firebaseAuthUser){showView('startseite');return;}
 // V2.5.2: Beim normalen Zurückkehren zur Startseite wird NICHT mehr automatisch
 // aus Firebase abgemeldet. Abmelden erfolgt nur noch bewusst über die Logout-Funktion.
 // Das verhindert besonders am Whiteboard eine erneute Kennwortabfrage bei jedem Start.
 goToStartseite();
}
async function logout(){
 window.__ecwAdminHomeReturn=false;
 if(isWhiteboardKioskAccount()){
   showView('startseite');
   return;
 }
 try{window.tvSignOut&&window.tvSignOut()}catch(e){}
 try{if(window.firebaseAuth&&firebaseAuthUser)await window.firebaseAuth.signOut();}catch(e){console.error(e)}
 firebaseAuthUser=null;currentUser=null;updateHomeAdminButton();loginPurpose='admin';showView('login');
}

function monthKey(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function monthLabel(k){const [y,m]=k.split('-').map(Number);return new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(new Date(y,m-1,1))}
function jsArg(v){return "'"+String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;')+"'"}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function tournamentInvitationVisible(x){return !!x&&(!x.endDate||x.endDate>=todayStr())}
function existingMonths(){if(tCollection==='pressReports')return [PRESS_REPORTS_GROUP];const st=tStore();return Object.keys(st).filter(k=>(st[k]||[]).some(Boolean)).sort()}
function presentationTournamentMonths(){
 if(tCollection!=='tournaments')return existingMonths();
 const st=tStore();
 return Object.keys(st).filter(k=>(st[k]||[]).some(tournamentInvitationVisible)).sort();
}
function renderTournamentMonthOverview(){
 const el=document.getElementById('tMonthOverview');if(!el)return;
 if(tCollection==='pressReports'){
   const folders=pressFolderList();
   if(!folders.length){el.innerHTML='<div class="empty">Noch keine Zeitungsbericht-Ordner vorhanden.</div>';return;}
   el.innerHTML=folders.map(k=>{
     const count=(tStore()[k]||[]).filter(Boolean).length;
     return '<button type="button" class="month-tile '+(count?'has-items':'')+'" data-month="'+esc(k)+'"><b>'+esc(pressFolderLabel(k))+'</b><span>'+count+' Bericht'+(count===1?'':'e')+'</span></button>';
   }).join('');
   el.querySelectorAll('.month-tile').forEach(btn=>btn.addEventListener('click',()=>openTournamentMonth(btn.dataset.month),{once:true}));
   return;
 }
 const now=new Date(),arr=[];
 for(let i=0;i<12;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1);arr.push(monthKey(d))}
 el.innerHTML=arr.map(k=>{const count=(tStore()[k]||[]).filter(tournamentInvitationVisible).length;return '<button type="button" class="month-tile '+(count?'has-items':'')+'" data-month="'+esc(k)+'"><b>'+monthLabel(k)+'</b><span>'+(count?count+' Einladung'+(count===1?'':'en'):'keine Einladung')+'</span></button>'}).join('');
 el.querySelectorAll('.month-tile').forEach(btn=>btn.addEventListener('click',()=>openTournamentMonth(btn.dataset.month),{once:true}));
}
async function openTournamentMonth(k){currentMonth=String(k);currentPage=0;adminTournamentPage=0;await showView('tournaments')}
function initTournaments(){const ms=tCollection==='tournaments'?presentationTournamentMonths():existingMonths();currentMonth=currentMonth&&ms.includes(currentMonth)?currentMonth:(ms[0]||(tCollection==='pressReports'?PRESS_REPORTS_GROUP:monthKey()));currentPage=0;adminTournamentPage=0;renderTournaments()}
function monthKeyOffset(offset){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);return monthKey(d)}
function tournamentMonthOptions(){
  const set=new Set(existingMonths());
  const start=new Date();start.setDate(1);start.setMonth(start.getMonth()-3);
  const end=new Date();end.setDate(1);end.setFullYear(end.getFullYear()+2);
  for(let d=new Date(start);d<=end;d.setMonth(d.getMonth()+1))set.add(monthKey(d));
  return [...set].sort();
}
function cleanupOldTournaments(){
  // Turniereinladungen, die 4 Monate oder länger in der Vergangenheit liegen, werden automatisch entfernt.
  const cutoff=monthKeyOffset(-3);
  const st=data.tournaments||{};
  const removedMedia=[];
  let changed=false;
  Object.keys(st).forEach(m=>{
    if(m<cutoff){
      (st[m]||[]).forEach(x=>{if(x&&x.mediaId)removedMedia.push(x.mediaId)});
      delete st[m];
      changed=true;
    }
  });
  if(!changed)return;
  save();
  removedMedia.forEach(id=>{mediaDelete(id).catch(()=>{})});
  if(firebaseReady&&firestoreDb){
    const desired=new Set(Object.keys(data.tournaments||{}).flatMap(month=>(data.tournaments[month]||[]).map((item,i)=>item?firebaseDocId(month,i,item):null)).filter(Boolean));
    if(desired.size)removeFirebaseDocsNotInSet('tournamentInvitations',desired).catch(e=>console.warn('Automatische Bereinigung: Firebase-Löschen fehlgeschlagen',e));
  }
  if(currentMonth && currentMonth<cutoff){currentMonth=null;currentPage=0;}
  if(tCollection==='tournaments'){
    if(document.getElementById('tournamentMonths')?.classList.contains('active'))renderTournamentMonthOverview();
    if(document.getElementById('tournaments')?.classList.contains('active'))renderTournaments();
  }
}
function ownTournamentEntries(){const st=data.ownTournaments||{};const out=[];Object.keys(st).sort().forEach(m=>{(st[m]||[]).forEach((x,i)=>{if(x)out.push({item:x,month:m,index:i})})});return out}
function findOwnItemById(id){const st=data.ownTournaments||{};for(const m in st){const arr=st[m]||[];const idx=arr.findIndex(x=>x&&String(x.id)===String(id));if(idx>=0)return{item:arr[idx],month:m,index:idx}}return null}
function todayStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function activeOwnItems(){
 const today=todayStr();
 const items=ownTournamentEntries().map(e=>e.item).filter(x=>!x.endDate||x.endDate>=today);
 items.sort((a,b)=>{const ea=a.endDate||'9999-99-99',eb=b.endDate||'9999-99-99';return ea<eb?-1:ea>eb?1:0});
 return items.slice(0,6);
}
function setOwnEndDate(id,value){
 const found=findOwnItemById(id);if(!found)return;
 found.item.endDate=value;
 showToast('Enddatum geändert – bitte oben Speichern drücken');
}
function setTournamentInvitationEndDate(month,index,value){
 const arr=(data.tournaments&&data.tournaments[month])||[];
 const item=arr[index];if(!item)return;
 item.endDate=String(value||'');
 save();
 showToast('„Anzeigen bis“ geändert – bitte unten Speichern drücken');
}
function renderOwnTournamentAdminList(){
 const el=document.getElementById('oAdminList');if(!el)return;
 const entries=ownTournamentEntries();
 if(!entries.length){el.innerHTML='<div class="small">Noch keine eigenen Einladungen vorhanden.</div>';return}
 el.innerHTML='';
 entries.forEach(({item:x,month:m,index:i})=>{
   const d=document.createElement('div');d.className='list-item';
   d.innerHTML='<span>'+esc(x.name)+'</span><label class="small" style="margin:0 8px 0 16px;white-space:nowrap">Anzeigen bis</label><input type="date" required value="'+esc(x.endDate||'')+'" style="width:170px" onchange="setOwnEndDate('+jsArg(x.id)+',this.value)"><button class="danger" onclick="deleteTournament('+jsArg(m)+','+i+')">Löschen</button>';
   el.appendChild(d);
 });
}
async function saveOwnTournamentFiles(){
 tCollection='ownTournaments';
 const month=monthKey();
 const files=[...(document.getElementById('ofiles')?.files||[])];
 const info=document.getElementById('firebaseOwnTournamentInfo');
 if(info)info.textContent='Einladungen werden gespeichert …';
 let added=0,failed=0,firstError='';
 try{
   for(const file of files){
     try{
       if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)) await addTournamentPdfFile(file,month);
       else if(/\.(png|bmp|jpe?g)$/i.test(file.name)||/^image\/(png|bmp|jpeg)$/i.test(file.type)) await addTournamentImageFile(file,month);
       else throw new Error('Nur PDF, PNG, JPG oder BMP sind erlaubt');
       added++;
     }catch(e){failed++;if(!firstError)firstError=file.name+': '+(e?.message||e);console.error('Datei:',file.name,e)}
   }
   if(!save()){if(info)info.textContent='Fehler: lokales Speichern fehlgeschlagen';return}
   await hydrateMedia();
   renderOwnTournamentAdminList();
   if(document.getElementById('tournaments')?.classList.contains('active')&&tCollection==='ownTournaments')renderTournaments();
   let fb=null;
   if(firebaseReady&&firestoreDb){
     if(info)info.textContent='Programm gespeichert. Firebase wird aktualisiert …';
     fb=await syncTournamentsToFirebase();
   }
   if(document.getElementById('ofiles'))document.getElementById('ofiles').value='';
   const parts=[];
   if(added)parts.push(added+' neue Datei(en) hinzugefügt');
   if(failed)parts.push(failed+' Datei(en) fehlgeschlagen ('+firstError+')');
   if(fb&&!fb.ok)showToast('Lokal gespeichert – aber Firebase: '+(fb.error||fb.message)+(parts.length?' · '+parts.join(' · '):''),8000);
   else showToast('Einladungen gespeichert'+(fb?' und Firebase aktualisiert':' (nur lokal – Firebase nicht verbunden)')+(parts.length?' · '+parts.join(' · '):''),failed?8000:3500);
 }catch(e){
   console.error(e);
   if(info)info.textContent='Fehler: '+(e?.message||e);
   showToast('Speichern fehlgeschlagen: '+(e?.message||e),6000);
 }
}

let wbLiveStartlistenRetryTimer=null;
let wbLiveStartlistenLoading=false;

function wbFsValue(v){
 if(!v||typeof v!=='object')return null;
 if(Object.prototype.hasOwnProperty.call(v,'stringValue'))return v.stringValue;
 if(Object.prototype.hasOwnProperty.call(v,'integerValue'))return Number(v.integerValue);
 if(Object.prototype.hasOwnProperty.call(v,'doubleValue'))return Number(v.doubleValue);
 if(Object.prototype.hasOwnProperty.call(v,'booleanValue'))return !!v.booleanValue;
 if(Object.prototype.hasOwnProperty.call(v,'nullValue'))return null;
 if(v.arrayValue)return (v.arrayValue.values||[]).map(wbFsValue);
 if(v.mapValue){
   const o={};
   Object.entries(v.mapValue.fields||{}).forEach(([k,x])=>o[k]=wbFsValue(x));
   return o;
 }
 return null;
}
function wbLiveDocFromRest(doc){
 const out={};
 Object.entries(doc?.fields||{}).forEach(([k,v])=>out[k]=wbFsValue(v));
 out.id=String(doc?.name||'').split('/').pop()||String(out.turnierId||'');
 return out;
}
async function wbLoadLiveStartlistenPublic(){
 if(wbLiveStartlistenLoading)return;
 wbLiveStartlistenLoading=true;

 const box=document.getElementById('ownLiveStartlistButtons');
 if(box && !wbLiveStartlisten.length){
   box.innerHTML='<div class="own-live-empty">Live-Startlisten werden geladen …</div>';
 }

 try{
   let rows=null;

   if(firestoreDb){
     try{
       const snap=await Promise.race([
         firestoreDb.collection('liveStartlisten').get(),
         new Promise((_,reject)=>setTimeout(()=>reject(new Error('Firestore-Zeitüberschreitung')),12000))
       ]);
       rows=[];
       snap.forEach(doc=>rows.push({...doc.data(),id:doc.id}));
     }catch(sdkErr){
       console.warn('Live Startlisten SDK:',sdkErr);
       rows=null;
     }
   }

   if(rows===null){
     const url='https://firestore.googleapis.com/v1/projects/'
       +encodeURIComponent(firebaseConfig.projectId)
       +'/databases/(default)/documents/liveStartlisten?pageSize=200&key='
       +encodeURIComponent(firebaseConfig.apiKey)
       +'&_='+Date.now();

     const ctrl=new AbortController();
     const timer=setTimeout(()=>ctrl.abort(),12000);
     try{
       const res=await fetch(url,{cache:'no-store',signal:ctrl.signal});
       if(!res.ok)throw new Error('Firestore '+res.status);
       const json=await res.json();
       rows=(json.documents||[]).map(wbLiveDocFromRest);
     }finally{
       clearTimeout(timer);
     }
   }

   wbLiveStartlisten=(rows||[])
     .filter(x=>x&&x.id)
     .sort((a,b)=>(a.datum||'9999-99-99').localeCompare(b.datum||'9999-99-99')||(a.name||'').localeCompare(b.name||''));

   wbRefreshLiveStartlistButtons();
 }catch(e){
   console.warn('Live Startlisten öffentlich laden:',e);
   const box2=document.getElementById('ownLiveStartlistButtons');
   if(box2){
     box2.innerHTML='<div class="own-live-empty">Live-Startlisten konnten nicht geladen werden.</div>'
       +'<button type="button" class="own-live-turnier-btn" onclick="wbLoadLiveStartlistenPublic()">↻ Erneut laden</button>';
   }
 }finally{
   wbLiveStartlistenLoading=false;
 }
}
window.wbLoadLiveStartlistenPublic=wbLoadLiveStartlistenPublic;

function wbStartLiveStartlistenListener(){
 clearTimeout(wbLiveStartlistenRetryTimer);
 wbLoadLiveStartlistenPublic();
 wbLiveStartlistenRetryTimer=setTimeout(()=>{
   if(document.getElementById('tournaments')?.classList.contains('active') && tCollection==='ownTournaments'){
     wbStartLiveStartlistenListener();
   }
 },5000);
}
function wbLiveStartlistButtonHtml(x){
 const dateText=(function(v){
   const p=String(v||'').split('-');
   return p.length===3 ? (p[2]+'.'+p[1]+'.'+p[0]) : String(v||'');
 })(x.datum);
 const date=dateText?'<span class="own-live-date">'+esc(dateText)+'</span>':'';
 return '<button type="button" class="own-live-turnier-btn" data-live-id="'+esc(x.id)+'">'
   +'<span>'+esc(x.name||'Turnier')+'</span>'+date+'</button>';
}
function wbLiveStartlistVisible(x){
 if(!x||!x.id)return false;
 const status=String(x.status||x.statusTurnier||x.turnierStatus||'').trim().toLowerCase();
 if(x.beendet===true||x.finished===true||x.abgeschlossen===true||['beendet','abgeschlossen','finished','archiviert','archived'].includes(status))return false;
 const raw=String(x.datum||x.date||'').trim();
 const iso=/^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
 const de=/^(\d{2})\.(\d{2})\.(\d{4})/.exec(raw);
 const date=iso?iso[1]+'-'+iso[2]+'-'+iso[3]:(de?de[3]+'-'+de[2]+'-'+de[1]:'');
 const now=new Date(),today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
 return !date||date>=today;
}
function wbRefreshLiveStartlistButtons(){
 const box=document.getElementById('ownLiveStartlistButtons');
 if(!box)return;
 const list=wbLiveStartlisten.filter(wbLiveStartlistVisible);
 if(!list.length){
   box.innerHTML='<div class="own-live-empty">Noch keine Live-Startlisten vorhanden</div>'
     +'<button type="button" class="own-live-turnier-btn" onclick="wbLoadLiveStartlistenPublic()">↻ Aktualisieren</button>';
   return;
 }
 box.innerHTML=list.map(wbLiveStartlistButtonHtml).join('')
   +'<button type="button" class="own-live-turnier-btn" style="opacity:.78" onclick="wbLoadLiveStartlistenPublic()">↻ Aktualisieren</button>';
 box.querySelectorAll('.own-live-turnier-btn').forEach(btn=>{
   btn.addEventListener('click',e=>{
     e.preventDefault();
     e.stopPropagation();
     openWhiteboardLiveStartlist(btn.dataset.liveId);
   });
 });
}
function openWhiteboardLiveStartlist(id){
 const u=SH_B+'live-startlisten.html?v=2.5.2&turnier='+encodeURIComponent(id);
 openExternalPage(u,'Live Startliste');
}
function renderOwnTournaments(){
 wbStartLiveStartlistenListener();
 const items=activeOwnItems();
 const mEl=document.getElementById('tMonth');if(mEl)mEl.textContent='';
 const f=document.getElementById('tFooter');if(f)f.style.display='block';
 ['prevPageBtn','nextPageBtn','prevMonthBtn','nextMonthBtn','tMonthsBtn'].forEach(id=>{const b=document.getElementById(id);if(b)b.style.display='none'});
 const c=document.getElementById('tContent');c.innerHTML='';

 // Maximal 6 Einladungen + genau ein Platzhalter in derselben A4-Größe.
 const totalSlots=items.length+1;
 const availableH=Math.max(200,c.clientHeight),availableW=Math.max(200,c.clientWidth),gap=6;
 let best={cols:1,rows:totalSlots,w:0,h:0};
 for(let cols=1;cols<=totalSlots;cols++){
   const rows=Math.ceil(totalSlots/cols);
   const slotH=Math.floor((availableH-(rows-1)*gap)/rows);
   const slotW=Math.floor((availableW-(cols-1)*gap)/cols);
   const w=Math.max(40,Math.min(slotW,Math.floor(slotH*(210/297))));
   if(w>best.w)best={cols,rows,w,h:Math.round(w*(297/210))};
 }
 c.style.gridTemplateColumns='repeat('+best.cols+','+best.w+'px)';
 c.style.gridTemplateRows='repeat('+best.rows+','+best.h+'px)';
 c.style.alignContent='center';
 c.style.justifyContent='center';
 c.style.columnGap=gap+'px';
 c.style.rowGap=gap+'px';

 // Bestehende Einladungen unverändert anzeigen.
 items.forEach(x=>{
   const slot=document.createElement('div');
   slot.className='page-slot';
   const img=document.createElement('img');
   img.alt=x.name||'Turniereinladung';
   img.src=x.data||'';
   slot.appendChild(img);
   slot.addEventListener('click',()=>openInvitationZoom(x));
   c.appendChild(slot);
 });

 // Der letzte A4-Platz ist ausschließlich die Live-Startlisten-Auswahl.
 const live=document.createElement('div');
 live.className='page-slot own-live-startlist-tile';
 live.innerHTML='<div class="own-live-startlist-inner">'
   +'<div class="own-live-startlist-head">Live Startlisten</div>'
   +'<div id="ownLiveStartlistButtons" class="own-live-startlist-buttons"></div>'
   +'</div>';
 c.appendChild(live);
 wbRefreshLiveStartlistButtons();
 setTimeout(()=>{wbStartLiveStartlistenListener();wbRefreshLiveStartlistButtons();},900);
}
function renderTournaments(){
 if(tCollection==='ownTournaments')return renderOwnTournaments();
 const fEl=document.getElementById('tFooter');if(fEl)fEl.style.display='none';
 const mbEl=document.getElementById('tMonthsBtn');
 if(mbEl){mbEl.style.display=tCollection==='pressReports'?'none':'block';mbEl.textContent='Monatsübersicht';}
 const ms=tCollection==='tournaments'?presentationTournamentMonths():existingMonths();
 if(!currentMonth)currentMonth=ms[0]||(tCollection==='pressReports'?PRESS_REPORTS_GROUP:monthKey());
 const sourceItems=tStore()[currentMonth]||[];
 const rawItems=tCollection==='tournaments'?sourceItems.filter(tournamentInvitationVisible):sourceItems,items=[];
 for(let i=0;i<rawItems.length;i++)items.push(rawItems[i]||null);
 const perPage=Math.max(1,Math.min(30,Number(data.settings.tournamentPerPage)||12));
 const totalPages=Math.max(1,Math.ceil(items.length/perPage));currentPage=Math.max(0,Math.min(currentPage,totalPages-1));
 const shown=items.slice(currentPage*perPage,currentPage*perPage+perPage);
 const title=document.getElementById('tMonth');
 if(title)title.textContent=(tCollection==='pressReports'?'Zeitungsberichte':tGroupLabel(currentMonth))+(items.some(Boolean)?'':(tCollection==='pressReports'?' – noch keine Berichte':' – noch keine Einladungen'));
 const c=document.getElementById('tContent');c.innerHTML='';const n=shown.length;
 if(!n){
   c.style.gridTemplateColumns='1fr';c.style.gridTemplateRows='1fr';
   c.innerHTML='<div class="empty">'+(tCollection==='pressReports'?'Noch keine Zeitungsberichte vorhanden.':'Für diesen Monat sind noch keine Turniereinladungen vorhanden.')+'</div>';
 }else{
   const rows=2,cols=Math.ceil(perPage/2),availableH=Math.max(300,c.clientHeight),availableW=Math.max(300,c.clientWidth),minGap=4;
   const slotH=Math.floor((availableH-(rows-1)*minGap)/rows),slotWByHeight=Math.floor(slotH*(210/297)),widthLimit=Math.floor((availableW-(cols-1)*minGap)/cols),slotW=Math.max(70,Math.min(slotWByHeight,widthLimit));
   let gap=minGap;if(cols>1){const free=availableW-(cols*slotW);gap=Math.max(minGap,Math.floor(free/(cols-1)));}
   c.style.gridTemplateColumns='repeat('+cols+','+slotW+'px)';c.style.gridTemplateRows='repeat('+rows+','+slotH+'px)';c.style.alignContent='start';c.style.columnGap=gap+'px';c.style.rowGap=minGap+'px';c.style.justifyContent='start';
   shown.forEach(x=>{
     const slot=document.createElement('div');
     if(!x){slot.className='page-slot page-slot-empty';c.appendChild(slot);return}
     slot.className='page-slot'+(x.data2?' press-pair':'');
     slot.innerHTML='<img src="'+x.data+'" alt="'+esc(x.name)+'">'+(x.data2?'<img src="'+x.data2+'" alt="'+esc(x.name2||x.name+' Seite 2')+'">':'');
     slot.onclick=()=>openInvitationZoom(x);c.appendChild(slot);
   });
 }
 document.getElementById('prevPageBtn').style.display=currentPage>0?'block':'none';
 document.getElementById('nextPageBtn').style.display=currentPage<totalPages-1?'block':'none';
 const idx=ms.indexOf(currentMonth),prev=document.getElementById('prevMonthBtn'),next=document.getElementById('nextMonthBtn');
 if(prev){prev.style.display=tCollection==='pressReports'?'none':(idx>0?'block':'none');prev.textContent='Voriger Monat';}
 if(next){next.style.display=tCollection==='pressReports'?'none':(idx>=0&&idx<ms.length-1?'block':'none');next.textContent='Nächster Monat';}
}
function openInvitationZoom(x){
 if(!x||!x.data)return;
 let ov=document.getElementById('invZoom');
 if(!ov){
   ov=document.createElement('div');ov.id='invZoom';ov.className='inv-zoom';
   ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
   ov.onclick=closeInvitationZoom;document.body.appendChild(ov);
   document.addEventListener('keydown',e=>{if(e.key==='Escape')closeInvitationZoom()});
 }
 ov.innerHTML='<div class="inv-zoom-images'+(x.data2?' pair':'')+'"><img src="'+x.data+'" alt="'+esc(x.name||'Seite 1')+'">'+(x.data2?'<img src="'+x.data2+'" alt="'+esc(x.name2||'Seite 2')+'">':'')+'</div><button type="button" class="inv-zoom-close" aria-label="Schließen">✕</button>';
 void ov.offsetWidth;requestAnimationFrame(()=>ov.classList.add('show'));
}
function closeInvitationZoom(){
 const ov=document.getElementById('invZoom');
 if(ov)ov.classList.remove('show');
}
function changePage(d){currentPage+=d;renderTournaments()}
function changeMonth(d){const ms=existingMonths();let i=ms.indexOf(currentMonth);if(i<0)i=d>0?-1:ms.length;i+=d;if(i>=0&&i<ms.length){currentMonth=ms[i];currentPage=0;renderTournaments()}}
const TP_EXCEL_IMPORT_2023_2025=[];
/* ===== Turnierplaner ===== */
function tpFindEvent(id){return (data.tournamentPlanner||[]).find(x=>x&&String(x.id)===String(id))}
function tpDayLabel(dateStr){if(!dateStr)return '';const d=new Date(dateStr+'T00:00:00');if(isNaN(d))return '';return new Intl.DateTimeFormat('de-DE',{weekday:'short'}).format(d).toUpperCase().replace('.','')}
function tpFormatDate(dateStr){if(!dateStr)return 'Datum offen';const p=dateStr.split('-');if(p.length!==3)return dateStr;return p[2]+'.'+p[1]+'.'+p[0]}
function tpMonthKey(dateStr){return dateStr?dateStr.slice(0,7):'ohne-datum'}
function tpExistingMonths(){const s=new Set();(data.tournamentPlanner||[]).forEach(x=>{if(x&&x.date)s.add(tpMonthKey(x.date))});return [...s].sort()}
const TP_DEFAULT_TYPES=['Turnier','Turnier intern','Meisterschaft','Gremlins','Turnier als Ausrichter','Sitzung','Feier'];
function tpCanonicalType(type){
  const raw=String(type||'').trim();
  const t=raw.toLowerCase().replace(/\s+/g,' ');
  if(t==='internes turnier'||t==='turnier intern'||t==='interner turnier')return 'Turnier intern';
  if(t==='turnier als veranstalter'||t==='turnier als ausrichter')return 'Turnier als Ausrichter';
  if(t==='turnier')return 'Turnier';
  if(t==='meisterschaft')return 'Meisterschaft';
  if(t==='gremlins')return 'Gremlins';
  if(t==='sitzung')return 'Sitzung';
  if(t==='feier')return 'Feier';
  return raw;
}
function tpNormalizeType(type){return tpCanonicalType(type).toLowerCase()}

function tpEffectiveType(x){
  if(!x)return '';
  const stored=tpCanonicalType(x.type);
  if(stored)return stored;
  const n=String(x.name||'').toLowerCase().replace(/\s+/g,' ').trim();
  const l=String(x.location||'').toLowerCase().replace(/\s+/g,' ').trim();

  if(n.includes('gremlins'))return 'Gremlins';
  if(/sitzung|versammlung/.test(n))return 'Sitzung';
  if(/fasching|feier|weihnacht|ausflug|zeltwochenende|jugendcamp|arbeitseinsatz/.test(n))return 'Feier';

  if(/meisterschaft|kreisliga|kreisoberliga|bezirksliga|bezirksoberliga|landesliga|bundesliga|pokal|zielschiessen|kreis[- ]?cup|weitschiessen|talentesichtung|euro gp|a-klasse|b-klasse/.test(n)){
    return 'Meisterschaft';
  }

  const tournamentWord=/turnier|cup|eispartie|solo|pyramide|schiessen/.test(n);
  if(tournamentWord){
    if(n.includes('ec wegscheid'))return 'Turnier intern';
    if(/wegscheid|vereinsheim|vereinheim|stüberl/.test(l))return 'Turnier als Ausrichter';
    return 'Turnier';
  }
  return '';
}
function tpEffectiveNormalizeType(x){return tpEffectiveType(x).toLowerCase()}
function tpIsExternalTournament(x){return tpEffectiveNormalizeType(x)==='turnier'}
function tpIsAnyTournamentEvent(x){
  const t=tpEffectiveNormalizeType(x);
  return t==='turnier'||t==='turnier intern'||t==='turnier als ausrichter';
}
function tpIsChampionshipEvent(x){return tpEffectiveNormalizeType(x)==='meisterschaft'}
function tpIsInternalTournamentType(type){return tpNormalizeType(type)==='turnier intern'}
function tpIsTournamentType(type){const t=tpNormalizeType(type);return t==='turnier'||t==='turnier intern'||t==='turnier als ausrichter'}
function tpIsChampionshipType(type){return tpNormalizeType(type)==='meisterschaft'}
function tpIsGremlinsType(type){return tpNormalizeType(type)==='gremlins'}
function tpAllowsPlayers(type){const t=tpNormalizeType(type);return t==='turnier'||t==='meisterschaft'}
function tpTimeOptionsHtml(selected){const cur=tpNormalizeTime(selected);let html='<option value="">– keine –</option>';for(let i=0;i<48;i++){const v=String(Math.floor(i/2)).padStart(2,'0')+':'+(i%2?'30':'00');html+='<option value="'+v+'" '+(v===cur?'selected':'')+'>'+v+'</option>'}return html}
function tpNormalizeTime(value){const m=String(value||'').match(/^\s*(\d{1,2})\s*[:.]\s*(\d{1,2})/);if(!m)return '';const h=Math.max(0,Math.min(23,parseInt(m[1],10)||0));const min=(parseInt(m[2],10)||0)<30?'00':'30';return String(h).padStart(2,'0')+':'+min}
function tpTypes(){
  const saved=(data.tournamentPlannerTypes||[]).filter(Boolean);
  const used=(data.tournamentPlanner||[]).map(x=>x&&x.type).filter(Boolean);
  const seen=new Map();
  [...TP_DEFAULT_TYPES,...saved,...used].forEach(t=>{
    const c=tpCanonicalType(t);
    if(!c)return;
    const key=c.toLowerCase();
    if(!seen.has(key))seen.set(key,c);
  });
  return [...seen.values()];
}
function tpTypeOptionsHtml(selected){selected=tpCanonicalType(selected);return '<option value="">– keine –</option>'+tpTypes().map(t=>'<option value="'+esc(t)+'" '+(t===selected?'selected':'')+'>'+esc(t)+'</option>').join('')}
function tpCanEditPlanner(){return isPublicWhiteboardMode()||hasAppPermission('tp')}
function tpRequestLogin(){window.__adminPreviewMode=false;loginPurpose='planner';showView('login');}
function tpRequirePlannerEdit(){
  if(tpCanEditPlanner())return true;
  showToast('Anmeldung erforderlich – bitte über 🔐 Verwaltung anmelden',6000);
  tpRequestLogin();
  return false;
}
function tpFormAllowsPeople(){const t=tpCanonicalType(document.getElementById('tpType')?.value||'');return t==='Turnier'||t==='Meisterschaft'}
function tpUpdateFormPlayerState(){
  const enabled=tpFormAllowsPeople();
  const reported=document.getElementById('tpReportedBy');
  if(reported){reported.disabled=!enabled;if(!enabled)reported.value='';}
  [0,1,2,3].forEach(i=>{const el=document.getElementById('tpPlayer'+i);if(el){el.disabled=!enabled;if(!enabled)el.value='';}});
}
function tpAddNewType(){
  const raw=(prompt('Neue Veranstaltungsart eingeben:')||'').trim();
  if(!raw)return;
  const name=tpCanonicalType(raw);
  if(!data.tournamentPlannerTypes)data.tournamentPlannerTypes=[];
  const exists=data.tournamentPlannerTypes.some(t=>tpCanonicalType(t).toLowerCase()===name.toLowerCase());
  if(!exists){data.tournamentPlannerTypes.push(name);save();}
  const sel=document.getElementById('tpType');
  if(sel){
    sel.innerHTML=tpTypeOptionsHtml(name);
    sel.value=name;
    sel.dataset.manual='1';
    sel.dispatchEvent(new Event('change'));
  }
  const tf=document.getElementById('tpTypeFilter');
  if(tf){const prev=tf.value;tf.innerHTML='<option value="all">Alle Arten</option>'+tpTypes().map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');tf.value=prev;}
  showToast(exists?'Veranstaltungsart bereits vorhanden':'Veranstaltungsart hinzugefügt');
}
function tpAutoDetectType(){
  const nameEl=document.getElementById('tpName'),typeEl=document.getElementById('tpType');
  if(!nameEl||!typeEl||typeEl.dataset.manual==='1')return;
  const name=(nameEl.value||'').toLowerCase();
  const match=tpTypes().find(t=>name.includes(t.toLowerCase()));
  if(match)typeEl.value=match;
  tpUpdateFormPlayerState();
}
function tpExistingYears(){const s=new Set();(data.tournamentPlanner||[]).forEach(x=>{if(x&&x.date)s.add(x.date.slice(0,4))});return [...s].sort()}
function tpPeriodOptionsHtml(){
  const currentYear=String(new Date().getFullYear());
  const years=tpExistingYears();
  const pastYears=years.filter(y=>y<currentYear).sort((a,b)=>b.localeCompare(a));
  const currentFutureYears=years.filter(y=>y>=currentYear).sort();
  let html='<option value="all">Alle Termine</option><option value="upcoming">Termine in Zukunft</option>';
  html+='<option value="past">Vergangenheit – alle</option>';
  if(pastYears.length){
    html+='<optgroup label="Vergangenheit">';
    pastYears.forEach(y=>{html+='<option value="y'+y+'">'+y+'</option>'});
    html+='</optgroup>';
  }
  if(currentFutureYears.length){
    html+='<optgroup label="Aktuell / Zukunft">';
    currentFutureYears.forEach(y=>{html+='<option value="y'+y+'">'+y+'</option>'});
    html+='</optgroup>';
  }
  return html;
}
function tpPopulateTypeFilter(selectId){
  const sel=document.getElementById(selectId);if(!sel)return;
  const prev=sel.value;
  sel.innerHTML='<option value="all">Alle Arten</option>'+tpTypes().map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');
  const values=[...sel.options].map(o=>o.value);
  sel.value=(prev&&values.includes(prev))?prev:'all';
}
function tpFilterByType(items,typeFilter){
  if(!typeFilter||typeFilter==='all')return items;
  return items.filter(x=>x&&tpCanonicalType(x.type)===typeFilter);
}
function tpPopulatePeriodFilter(selectId,defaultValue){
  const sel=document.getElementById(selectId);if(!sel)return;
  const prev=sel.value;
  sel.innerHTML=tpPeriodOptionsHtml();
  const values=[...sel.options].map(o=>o.value);
  sel.value=(prev&&values.includes(prev))?prev:(values.includes(defaultValue)?defaultValue:'all');
}
function tpFilterByPeriod(items,period){
  const today=todayStr();
  if(period==='upcoming')return items.filter(x=>x&&tpEventDateStr(x)&&tpEventDateStr(x)>=today);
  if(period==='past')return items.filter(x=>x&&tpEventDateStr(x)&&tpEventDateStr(x)<today);
  if(period&&period.charAt(0)==='y')return items.filter(x=>x&&tpEventYear(x)===period.slice(1));
  return items;
}
function tpSortedEvents(){return (data.tournamentPlanner||[]).filter(Boolean).slice().sort((a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999'))||String(a.time||'').localeCompare(String(b.time||'')))}
function tpHistoryScope(){
  const period=document.getElementById('tpPeriodFilter')?.value||'upcoming';
  const today=todayStr();
  if(period==='past')return {period,label:'Vergangenheit – alle',filter:x=>{const d=tpEventDateStr(x);return !!d&&d<today}};
  if(period==='upcoming')return {period,label:'Zukunft',filter:x=>{const d=tpEventDateStr(x);return !!d&&d>=today}};
  if(period&&period.charAt(0)==='y'){
    const year=period.slice(1);
    return {period,label:year,filter:x=>tpEventYear(x)===year};
  }
  return {period:'all',label:'Alle Termine',filter:x=>true};
}
function tpPlayerHistoryData(){
  const scope=tpHistoryScope(),today=todayStr(),currentYear=String(new Date().getFullYear());
  const all=(data.tournamentPlanner||[]).filter(Boolean);
  const scoped=all.filter(scope.filter);
  const counts={};
  const ensure=n=>counts[n]||(counts[n]={name:n,tournaments:0,championships:0,plannedCurrentYear:0});

  // Bisherige Historienwerte für den ausgewählten Zeitraum beibehalten.
  scoped.forEach(x=>{
    if(!tpIsAnyTournamentEvent(x)&&!tpIsChampionshipEvent(x))return;
    (x.players||[]).forEach(p=>{
      const name=(p||'').trim();
      if(!name||name.toUpperCase()==='X')return;
      const row=ensure(name);
      if(tpIsAnyTournamentEvent(x))row.tournaments++;
      else row.championships++;
    });
  });

  // Zusätzlich: alle noch geplanten Spieler-Einsätze des aktuellen Jahres,
  // unabhängig vom gewählten Historien-Zeitraum. Turniere UND Meisterschaften zählen.
  all.forEach(x=>{
    if(!tpIsAnyTournamentEvent(x)&&!tpIsChampionshipEvent(x))return;
    const dateStr=tpEventDateStr(x);
    if(!dateStr||dateStr<today||tpEventYear(x)!==currentYear)return;
    (x.players||[]).forEach(p=>{
      const name=(p||'').trim();
      if(!name||name.toUpperCase()==='X')return;
      ensure(name).plannedCurrentYear++;
    });
  });

  return {
    scope,
    currentYear,
    rows:Object.values(counts)
      .map(r=>({...r,total:r.tournaments+r.championships}))
      .sort((a,b)=>b.total-a.total||b.plannedCurrentYear-a.plannedCurrentYear||a.name.localeCompare(b.name,'de'))
  };
}
function renderTpHistory(){
  const el=document.getElementById('tpHistoryList');if(!el)return;
  const result=tpPlayerHistoryData(),rows=result.rows,scope=result.scope;
  const yearEl=document.getElementById('tpHistoryYear');if(yearEl)yearEl.textContent=scope.label;
  if(!rows.length){el.innerHTML='<div class="tp-empty">Noch keine Teilnahmen für „'+esc(scope.label)+'“ erfasst.</div>';return}
  el.innerHTML=rows.map(r=>'<div class="tp-history-row"><div class="tp-history-name">'+esc(r.name)+'</div><div class="tp-history-counts">Turniere: '+r.tournaments+' · Meisterschaften: '+r.championships+'<br>Geplante Einsätze '+result.currentYear+': <b>'+r.plannedCurrentYear+'</b><br>Gesamt: <b>'+r.total+'</b></div></div>').join('');
}

/* ECW Jahresauswertung V2.9.42 TEST – öffentliche Leseschnittstelle: window.ECWAnnualReports */
const TP_ANNUAL_COLLECTION='tournamentPlannerAnnualReports';
const tpAnnualSnapshots={};
function tpAnnualSummary(year){
 const y=String(year), events=(data.tournamentPlanner||[]).filter(x=>x&&tpEventYear(x)===y);
 const types={tournaments:[],championships:[],hosted:[],internal:[]},playerMap=new Map();
 for(const x of events){
  const t=tpEffectiveNormalizeType(x);
  if(t==='turnier')types.tournaments.push(x);
  if(t==='meisterschaft')types.championships.push(x);
  if(t==='turnier als ausrichter')types.hosted.push(x);
  if(t==='turnier intern')types.internal.push(x);
  if(t!=='turnier'&&t!=='meisterschaft')continue;
  const seen=new Set();
  for(const raw of (Array.isArray(x.players)?x.players:[])){
   const name=String(raw||'').trim();if(!name||name.toUpperCase()==='X'||seen.has(name.toLocaleLowerCase('de')))continue;
   seen.add(name.toLocaleLowerCase('de'));
   if(!playerMap.has(name))playerMap.set(name,{name,tournaments:0,championships:0});
   playerMap.get(name)[t==='meisterschaft'?'championships':'tournaments']++;
  }
 }
 const entry=x=>({id:String(x.id||''),name:String(x.name||''),date:tpEventDateStr(x),type:tpEffectiveType(x)});
 return {schemaVersion:1,year:Number(y),source:'ECW Terminplaner',generatedAt:new Date().toISOString(),
  totals:{tournaments:types.tournaments.length,championships:types.championships.length,hosted:types.hosted.length,internal:types.internal.length,allEvents:events.length},
  players:[...playerMap.values()].map(x=>({...x,total:x.tournaments+x.championships})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'de')),
  hostedTournaments:types.hosted.map(entry),eventIds:events.map(x=>String(x.id||''))};
}
function tpAnnualKnownYears(){
 const years=new Set((data.tournamentPlanner||[]).map(tpEventYear).filter(Boolean));
 Object.keys(tpAnnualSnapshots).forEach(y=>years.add(y));years.add(String(new Date().getFullYear()));
 return [...years].sort((a,b)=>Number(b)-Number(a));
}
function tpAnnualData(year){return tpAnnualSnapshots[String(year)]||tpAnnualSummary(year)}
function tpAnnualEscape(s){return esc(String(s==null?'':s))}
function tpAnnualModalClose(){
 const modal=document.getElementById('tpAnnualModal');
 if(modal){modal.classList.remove('show');modal.style.display='none';modal.setAttribute('aria-hidden','true');}
}
function tpAnnualApplyAccess(){
 const admin=appPermissions.admin===true&&!isWhiteboardUser();
 document.querySelectorAll('[data-tp-annual-admin]').forEach(el=>{el.hidden=!admin;el.style.display=admin?'':'none';});
}

async function tpAnnualOpen(){
 const modal=document.getElementById('tpAnnualModal');
 if(modal){modal.style.display='flex';modal.classList.add('show');modal.setAttribute('aria-hidden','false');}
 tpAnnualApplyAccess();
 await tpAnnualLoadSnapshots();
 tpAnnualApplyAccess();
}
async function tpAnnualLoadSnapshots(){
 const status=document.getElementById('tpAnnualStatus');
 if(firebaseReady&&firestoreDb&&firebaseAuthUser){
  try{const snap=await firestoreDb.collection(TP_ANNUAL_COLLECTION).get();snap.forEach(doc=>{if(/^\d{4}$/.test(doc.id))tpAnnualSnapshots[doc.id]=doc.data()});}
  catch(e){if(status)status.textContent='Abgeschlossene Jahre konnten nicht aus Firebase gelesen werden: '+e.message;}
 }
 const sel=document.getElementById('tpAnnualYear');if(!sel)return;
 const old=sel.value||String(new Date().getFullYear());sel.innerHTML=tpAnnualKnownYears().map(y=>'<option value="'+y+'">'+y+'</option>').join('');
 sel.value=[...sel.options].some(o=>o.value===old)?old:sel.options[0]?.value;
 tpAnnualRender();
}
function tpAnnualRender(){
 const sel=document.getElementById('tpAnnualYear'),el=document.getElementById('tpAnnualContent');if(!sel||!el)return;
 tpAnnualApplyAccess();
 const y=sel.value,report=tpAnnualData(y),locked=!!tpAnnualSnapshots[y],t=report.totals||{};
 const status=document.getElementById('tpAnnualStatus');
 if(status)status.textContent=locked?'Gespeicherter Jahresabschluss vom '+(report.closedAt||report.generatedAt||'unbekannt')+' · unveränderlich':'Vorläufige Live-Auswertung – noch kein gespeicherter Jahresabschluss';
 const btn=document.getElementById('tpAnnualCloseButton');if(btn){btn.disabled=locked||Number(y)>new Date().getFullYear()||(Number(y)===new Date().getFullYear()&&new Date().getMonth()<11)||(Number(y)===new Date().getFullYear()&&new Date().getMonth()===11&&new Date().getDate()<31)||!firebaseReady||!firestoreDb||!firebaseAuthUser||isWhiteboardUser();btn.title='Nur am 31.12. oder für vergangene Jahre, mit Firebase-Anmeldung';}
 const cards=[['Turniere',t.tournaments],['Meisterschaften',t.championships],['Ausgerichtete Turniere',t.hosted],['Interne Turniere',t.internal],['Veranstaltungen gesamt',t.allEvents]];
 let html='<div style="display:flex;gap:10px;flex-wrap:wrap;margin:16px 0">'+cards.map(([n,v])=>'<div class="card" style="flex:1;min-width:135px;text-align:center"><b>'+tpAnnualEscape(n)+'</b><div style="font-size:28px">'+(v||0)+'</div></div>').join('')+'</div>';
 html+='<h3>Spielereinsätze '+y+'</h3><div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Spieler</th><th>Turniere</th><th>Meisterschaften</th><th>Gesamt</th></tr></thead><tbody>';
 html+=(report.players||[]).map(p=>'<tr><td>'+tpAnnualEscape(p.name)+'</td><td align="center">'+p.tournaments+'</td><td align="center">'+p.championships+'</td><td align="center">'+p.total+'</td></tr>').join('')||'<tr><td colspan="4">Keine Spielereinsätze vorhanden</td></tr>';
 html+='</tbody></table></div><h3>Ausgerichtete Turniere</h3>';
 html+=(report.hostedTournaments||[]).map(x=>'<div>'+tpAnnualEscape(x.date)+' · '+tpAnnualEscape(x.name)+'</div>').join('')||'<div>Keine erfasst</div>';
 html+='<h3>Jahresvergleich (vorhandene Daten)</h3><div style="overflow:auto"><table style="width:100%"><thead><tr><th>Jahr</th><th>Turniere</th><th>Meisterschaften</th><th>Ausgerichtet</th><th>Spieler</th><th>Status</th></tr></thead><tbody>';
 html+=tpAnnualKnownYears().map(yr=>{const r=tpAnnualData(yr),a=r.totals||{};return '<tr><td>'+yr+'</td><td align="center">'+(a.tournaments||0)+'</td><td align="center">'+(a.championships||0)+'</td><td align="center">'+(a.hosted||0)+'</td><td align="center">'+(r.players||[]).length+'</td><td>'+(tpAnnualSnapshots[yr]?'Abschluss':'vorläufig')+'</td></tr>'}).join('');
 html+='</tbody></table></div><p class="small">Gezählt werden erfasste Terminplaner-Einträge (Turnier / Meisterschaft / Turnier als Ausrichter). Eine Turnierteilnahme wird pro Spieler und Termin einmal gezählt. Ein fehlender Eintrag bedeutet nicht zwingend, dass kein Turnier stattgefunden hat. Historische PDF-Archive werden nicht verändert.</p>';
 el.innerHTML=html;
}
async function tpAnnualCloseYear(){
 if(appPermissions.admin!==true||isWhiteboardUser())return alert('Nur im Admin-Bereich möglich.');
 const y=document.getElementById('tpAnnualYear')?.value;
 if(!y||tpAnnualSnapshots[y])return;
 const now=new Date(),current=now.getFullYear();
 if(Number(y)>current||(Number(y)===current&&(now.getMonth()<11||(now.getMonth()===11&&now.getDate()<31))))return alert('Der Jahresabschluss ist erst ab dem 31.12. des jeweiligen Jahres möglich.');
 if(!firebaseReady||!firestoreDb||!firebaseAuthUser||isWhiteboardUser())return alert('Zum Speichern ist ein berechtigter Firebase-Benutzer erforderlich.');
 if(!confirm('Jahresabschluss '+y+' dauerhaft in Firebase speichern? Vorher alle Termine prüfen.'))return;
 const report={...tpAnnualSummary(y),closedAt:new Date().toISOString(),closedBy:firebaseAuthUser.uid};
 try{
  const ref=firestoreDb.collection(TP_ANNUAL_COLLECTION).doc(y);
  await firestoreDb.runTransaction(async tx=>{const existing=await tx.get(ref);if(existing.exists)throw new Error('Für '+y+' ist bereits ein Abschluss gespeichert.');tx.set(ref,report)});
  tpAnnualSnapshots[y]=report;tpAnnualRender();showToast('Jahresabschluss '+y+' gespeichert');
 }catch(e){alert('Jahresabschluss nicht gespeichert: '+e.message+'\nEventuell fehlen Firestore-Berechtigungen für '+TP_ANNUAL_COLLECTION+'.')}
}
function tpAnnualExportJson(){
 if(appPermissions.admin!==true||isWhiteboardUser())return alert('Nur im Admin-Bereich möglich.');
 const y=document.getElementById('tpAnnualYear')?.value;if(!y)return;
 const report=tpAnnualData(y),blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='ECW_Jahresauswertung_'+y+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
window.ECWAnnualReports={collection:TP_ANNUAL_COLLECTION,getYear:tpAnnualData,getStoredYear:y=>tpAnnualSnapshots[String(y)]||null,years:tpAnnualKnownYears,refresh:tpAnnualLoadSnapshots};

function openTpHistory(){renderTpHistory();document.getElementById('tpHistoryModal')?.classList.add('show');}
function closeTpHistory(){document.getElementById('tpHistoryModal')?.classList.remove('show');}
function tpEventYear(x){
  // Datum kann "YYYY-MM-DD" (ISO) oder "DD.MM.YYYY" (Anzeigeformat) sein.
  const d=String((x&&x.date)||'').trim();
  let m=d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m&&!isNaN(new Date(d+'T00:00:00')))return m[1];
  m=d.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if(m)return m[3];
  const t=Number(x&&x.dateTs);
  if(t){const dt=new Date(t);if(!isNaN(dt))return String(dt.getFullYear())}
  return '';
}
function tpEventDateStr(x){
  const d=String((x&&x.date)||'').trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(d))return d.slice(0,10);
  const m=d.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if(m)return m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
  return '';
}
function tpMigrateTypes(){
  let changed=false;
  (data.tournamentPlanner||[]).forEach(x=>{
    if(!x||!x.type)return;
    const c=tpCanonicalType(x.type);
    if(c&&c!==x.type){x.type=c;changed=true;}
    const wantInternal=(c==='Turnier intern');
    if(!!x.internal!==wantInternal){x.internal=wantInternal;changed=true;}
  });
  (data.tournamentPlannerTypes||[]).forEach((t,i,arr)=>{
    const c=tpCanonicalType(t);
    if(c&&c!==t){arr[i]=c;changed=true;}
  });
  if(changed)save();
  return changed;
}
function tpSelectedYear(){
  const filterVal=document.getElementById('tpPeriodFilter')?.value||'';
  return (filterVal&&filterVal.charAt(0)==='y')?filterVal.slice(1):String(new Date().getFullYear());
}
function tpStatsScope(){
  const period=document.getElementById('tpPeriodFilter')?.value||'upcoming';
  const today=todayStr();
  if(period==='past')return {period,label:'Vergangenheit',filter:x=>{const d=tpEventDateStr(x);return !!d&&d<today}};
  if(period==='upcoming')return {period,label:'Zukunft',filter:x=>{const d=tpEventDateStr(x);return !!d&&d>=today}};
  if(period&&period.charAt(0)==='y'){
    const year=period.slice(1);
    return {period,label:year,filter:x=>tpEventYear(x)===year};
  }
  return {period:'all',label:'Alle Termine',filter:x=>true};
}

function tpHasActualPlayer(x){
  return Array.isArray(x&&x.players) && x.players.some(p=>{
    const n=String(p||'').trim();
    return !!n && n.toUpperCase()!=='X';
  });
}
function tpWasVisited(x){
  const d=tpEventDateStr(x);
  return !!d && d<todayStr() && tpHasActualPlayer(x);
}

function tpEventNameKey(x){
  return String((x&&x.name)||'')
    .toLocaleLowerCase('de')
    .replace(/[–—]/g,'-')
    .replace(/\s+/g,' ')
    .trim();
}
function tpVisitKey(x){
  return [tpEventDateStr(x),tpEventNameKey(x)].join('|');
}
function tpUniqueVisitedExternal(items){
  const seen=new Set(),out=[];
  for(const x of (items||[])){
    if(!x||!tpIsExternalTournament(x)||!tpWasVisited(x))continue;
    const key=tpVisitKey(x);
    if(!key||seen.has(key))continue;
    seen.add(key);out.push(x);
  }
  return out;
}
function tpStatsCounts(){
  const all=(data.tournamentPlanner||[]).filter(Boolean);
  const year=String(new Date().getFullYear());
  const today=todayStr();
  const items=all.filter(x=>tpEventYear(x)===year);

  const typeOf=x=>tpCanonicalType(x&&x.type);

  const turniere=items.filter(x=>typeOf(x)==='Turnier');
  const interne=items.filter(x=>typeOf(x)==='Turnier intern');
  const ausgerichtete=items.filter(x=>typeOf(x)==='Turnier als Ausrichter');
  const meisterschaften=items.filter(x=>typeOf(x)==='Meisterschaft');

  const veranstaltungen=items.length;
  const turniereGemeldet=turniere.length;
  const turniereBesucht=turniere.filter(x=>{const d=tpEventDateStr(x);return !!d&&d<today}).length;
  const turniereOffen=turniere.filter(x=>{const d=tpEventDateStr(x);return !!d&&d>=today}).length;

  const ausgerichteteTurniere=ausgerichtete.length;
  const interneTurniere=interne.length;

  const meisterschaftenBesucht=meisterschaften.filter(x=>{const d=tpEventDateStr(x);return !!d&&d<today}).length;
  const meisterschaftenOffen=meisterschaften.filter(x=>{const d=tpEventDateStr(x);return !!d&&d>=today}).length;

  return {
    year,
    veranstaltungen,
    turniereGemeldet,
    turniereBesucht,
    turniereOffen,
    ausgerichteteTurniere,
    interneTurniere,
    meisterschaftenBesucht,
    meisterschaftenOffen
  };
}
function tpFindTodayIndex(){
  const today=todayStr();
  const items=tpSortedEvents();
  let idx=items.findIndex(x=>x&&x.date&&x.date>=today);
  if(idx<0)idx=items.length-1;
  return idx;
}
function tpScrollToCurrentEntry(){
  const el=document.getElementById('tpContent');if(!el)return;
  const cards=[...el.querySelectorAll('.tp-card')];if(!cards.length)return;
  const today=todayStr();
  const target=cards.find(card=>String(card.dataset.tpDate||'')>=today)||cards[cards.length-1];
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    target.scrollIntoView({behavior:'instant',block:'start',inline:'nearest'});
    const topGap=window.matchMedia('(max-width:800px)').matches?90:12;
    let n=target.parentElement,scrollParent=null;
    while(n&&n!==document.body){const st=getComputedStyle(n);if(/auto|scroll/.test(st.overflowY)&&n.scrollHeight>n.clientHeight+5){scrollParent=n;break}n=n.parentElement}
    if(scrollParent)scrollParent.scrollTop=Math.max(0,scrollParent.scrollTop-topGap);
    else window.scrollBy(0,-topGap);
  }));
}
function tpScrollToToday(){tpScrollToCurrentEntry();}

function tpSyncStatsAndPeriod(){
  const t=document.getElementById('tpTypeFilter')?.value||'all';
  const p=document.getElementById('tpPeriodFilter')?.value||'upcoming';
  tpRenderStats();
  renderTournamentPlanner();
  const tf=document.getElementById('tpTypeFilter');if(tf&&tf.value!==t)tf.value=t;
  const pf=document.getElementById('tpPeriodFilter');if(pf&&pf.value!==p)pf.value=p;
}
function tpRenderStats(){
  const el=document.getElementById('tpStats');if(!el)return;
  const s=tpStatsCounts(),y=s.year;
  el.innerHTML='<div class="tp-stat">Veranstaltungen '+y+'<b>'+s.veranstaltungen+'</b><span id="tpListNote" class="small tp-list-note" style="display:block;margin-top:5px;opacity:.85">Angezeigt: –</span></div>'
    +'<div class="tp-stat">Turniere gemeldet '+y+'<b>'+s.turniereGemeldet+'</b></div>'
    +'<div class="tp-stat">Turniere besucht '+y+'<b>'+s.turniereBesucht+'</b></div>'
    +'<div class="tp-stat">Turniere offen '+y+'<b>'+s.turniereOffen+'</b></div>'
    +'<div class="tp-stat">Ausgerichtete Turniere '+y+'<b>'+s.ausgerichteteTurniere+'</b></div>'
    +'<div class="tp-stat">Interne Turniere '+y+'<b>'+s.interneTurniere+'</b></div>'
    +'<div class="tp-stat">Meisterschaften besucht '+y+'<b>'+s.meisterschaftenBesucht+'</b></div>'
    +'<div class="tp-stat">Meisterschaften offen '+y+'<b>'+s.meisterschaftenOffen+'</b></div>';
}

let tpWhiteboardEditHold=null;
let tpWhiteboardEditHoldTimer=null;
let tpWhiteboardScrollGuardApplying=false;

function tpPlannerListEl(){
  return document.getElementById('tpContent');
}

function tpBeginWhiteboardEditHold(id,force=false){
  const sid=String(id||'');
  if(!sid)return;

  // Wichtig auf Samsung/Tizen:
  // pointerdown/focus passiert VOR dem Öffnen der nativen Select-Auswahl.
  // Ein späteres onchange darf diesen vorher gesicherten Wert NICHT mit der
  // möglicherweise bereits gesprungenen Position überschreiben.
  if(
    !force &&
    tpWhiteboardEditHold &&
    tpWhiteboardEditHold.id===sid &&
    Date.now()<=tpWhiteboardEditHold.until
  ){
    tpWhiteboardEditHold.until=Date.now()+12000;
    return;
  }

  clearTimeout(tpWhiteboardEditHoldTimer);

  const list=tpPlannerListEl();
  const card=list?[...list.querySelectorAll('.tp-card[data-tp-id]')].find(c=>String(c.dataset.tpId||'')===sid):null;
  tpWhiteboardEditHold={
    id:sid,
    scrollTop:list?list.scrollTop:0,
    cardTop:card?card.getBoundingClientRect().top:null,
    until:Date.now()+12000
  };
}

function tpWhiteboardEditHoldActive(){
  if(!tpWhiteboardEditHold)return false;
  if(Date.now()>tpWhiteboardEditHold.until){
    tpWhiteboardEditHold=null;
    return false;
  }
  return true;
}

function tpKeepWhiteboardEditPosition(){
  if(!tpWhiteboardEditHoldActive())return false;

  const keep={...tpWhiteboardEditHold};
  const restore=()=>{
    try{
      if(!tpWhiteboardEditHoldActive())return;
      const list=tpPlannerListEl();
      if(!list)return;
      tpWhiteboardScrollGuardApplying=true;
      list.scrollTop=Number(keep.scrollTop)||0;

      const card=[...list.querySelectorAll('.tp-card')]
        .find(c=>String(c.dataset.tpId||'')===keep.id);

      if(card && Number.isFinite(keep.cardTop)){
        const delta=card.getBoundingClientRect().top-keep.cardTop;
        if(Math.abs(delta)>1)list.scrollTop+=delta;
      }

      requestAnimationFrame(()=>{tpWhiteboardScrollGuardApplying=false;});

      if(card){
        card.style.outline='3px solid rgba(255,255,255,.75)';
        card.style.outlineOffset='2px';
        setTimeout(()=>{
          card.style.outline='';
          card.style.outlineOffset='';
        },700);
      }
    }catch(e){
      tpWhiteboardScrollGuardApplying=false;
    }
  };

  // Sofort + zwei Frames später: deckt die native Select-Rückkehr des
  // Samsung-Browsers und nachlaufende Layout-Berechnungen ab.
  restore();
  requestAnimationFrame(()=>requestAnimationFrame(restore));
  return true;
}

function tpReleaseWhiteboardEditHoldLater(id,delay=3500){
  const sid=String(id||'');
  clearTimeout(tpWhiteboardEditHoldTimer);
  tpWhiteboardEditHoldTimer=setTimeout(()=>{
    if(tpWhiteboardEditHold && tpWhiteboardEditHold.id===sid){
      tpKeepWhiteboardEditPosition();
      tpWhiteboardEditHold=null;
    }
  },delay);
}

function tpClearWhiteboardEditHold(){
  clearTimeout(tpWhiteboardEditHoldTimer);
  tpWhiteboardEditHoldTimer=null;
  tpWhiteboardEditHold=null;
}

function tpCaptureWhiteboardSelectBeforeOpen(target){
  if(!isWhiteboardUser())return;
  const sel=target?.closest?.('#tpContent select');
  if(!sel)return;
  const card=sel.closest('.tp-card[data-tp-id]');
  if(!card)return;
  tpBeginWhiteboardEditHold(card.dataset.tpId,false);
}

// Capture-Phase ist entscheidend: Position sichern, bevor der Browser sein
// natives Select öffnet. Auf dem WM65B kann der Scrollsprung bereits vor
// onchange stattfinden.

// Solange eine Whiteboard-Auswahl gespeichert wird, darf der Browser den
// Listencontainer nicht selbst auf 0 / "heute" zurücksetzen.
document.addEventListener('scroll',e=>{
  const list=tpPlannerListEl();
  if(!list || e.target!==list || !tpWhiteboardEditHoldActive() || tpWhiteboardScrollGuardApplying)return;

  const wanted=Number(tpWhiteboardEditHold?.scrollTop)||0;
  if(Math.abs(list.scrollTop-wanted)>3){
    tpWhiteboardScrollGuardApplying=true;
    requestAnimationFrame(()=>{
      try{list.scrollTop=wanted;}catch(_){}
      requestAnimationFrame(()=>{tpWhiteboardScrollGuardApplying=false;});
    });
  }
},true);


let tpWbPickerState=null;

function tpEnsureWhiteboardPlayerPicker(){
  let ov=document.getElementById('tpWbPlayerPicker');
  if(ov)return ov;

  ov=document.createElement('div');
  ov.id='tpWbPlayerPicker';
  ov.className='tp-wb-picker-overlay';
  ov.innerHTML=
    '<div class="tp-wb-picker-dialog" role="dialog" aria-modal="true">'+
      '<div class="tp-wb-picker-head">'+
        '<h3 id="tpWbPickerTitle">Spieler auswählen</h3>'+
        '<button type="button" class="tp-wb-picker-close" id="tpWbPickerClose">Schließen</button>'+
      '</div>'+
      '<div id="tpWbPickerCurrent" class="tp-wb-picker-current"></div>'+
      '<div id="tpWbPickerGrid" class="tp-wb-picker-grid"></div>'+
    '</div>';

  document.body.appendChild(ov);

  document.getElementById('tpWbPickerClose').addEventListener('click',tpCloseWhiteboardPlayerPicker);

  ov.addEventListener('click',e=>{
    if(e.target===ov)tpCloseWhiteboardPlayerPicker();
  });

  return ov;
}

function tpOpenWhiteboardPlayerPicker(id,field,idx,currentValue){
  if(!isWhiteboardUser())return;

  const list=tpPlannerListEl();
  const sid=String(id||'');

  tpWbPickerState={
    id:sid,
    field:String(field||''),
    idx:Number.isInteger(idx)?idx:null,
    current:String(currentValue||''),
    scrollTop:list?list.scrollTop:0
  };

  // Position vor dem Öffnen sichern. Ab hier gibt es KEIN natives <select>.
  tpBeginWhiteboardEditHold(sid,true);

  const ov=tpEnsureWhiteboardPlayerPicker();
  const title=document.getElementById('tpWbPickerTitle');
  const current=document.getElementById('tpWbPickerCurrent');
  const grid=document.getElementById('tpWbPickerGrid');

  if(title){
    title.textContent=field==='reportedBy'
      ? 'Gemeldet von auswählen'
      : 'Spieler '+((Number(idx)||0)+1)+' auswählen';
  }

  if(current){
    current.textContent='Aktuell: '+(tpWbPickerState.current||'– keine Auswahl –');
  }

  if(grid){
    grid.innerHTML='';

    const clear=document.createElement('button');
    clear.type='button';
    clear.className='clear-choice'+(!tpWbPickerState.current?' selected':'');
    clear.textContent='– Auswahl löschen –';
    clear.addEventListener('click',()=>tpChooseWhiteboardPlayer(''));
    grid.appendChild(clear);

    const names=tpPlayers()
      .filter(Boolean)
      .slice()
      .sort((a,b)=>String(a).localeCompare(String(b),'de'));

    names.forEach(name=>{
      const b=document.createElement('button');
      b.type='button';
      b.textContent=name;
      if(name===tpWbPickerState.current)b.classList.add('selected');
      b.addEventListener('click',()=>tpChooseWhiteboardPlayer(name));
      grid.appendChild(b);
    });

    grid.scrollTop=0;
  }

  ov.classList.add('show');

  // Den eigentlichen Turnierplaner unangetastet lassen.
  if(list)list.scrollTop=tpWbPickerState.scrollTop;
}

function tpCloseWhiteboardPlayerPicker(){
  const ov=document.getElementById('tpWbPlayerPicker');
  if(ov)ov.classList.remove('show');

  const list=tpPlannerListEl();
  if(list && tpWbPickerState){
    list.scrollTop=tpWbPickerState.scrollTop;
  }
}

async function tpChooseWhiteboardPlayer(name){
  const state=tpWbPickerState ? {...tpWbPickerState} : null;
  if(!state)return;

  tpCloseWhiteboardPlayerPicker();

  const list=tpPlannerListEl();
  if(list)list.scrollTop=state.scrollTop;

  // Sichtbaren Button sofort aktualisieren, ohne die Terminliste neu aufzubauen.
  const card=[...document.querySelectorAll('#tpContent .tp-card[data-tp-id]')]
    .find(c=>String(c.dataset.tpId||'')===state.id);

  if(card){
    let selector='';
    if(state.field==='reportedBy'){
      selector='button[data-tp-field="reportedBy"]';
    }else{
      selector='button[data-tp-field="players"][data-tp-player-index="'+state.idx+'"]';
    }
    const btn=card.querySelector(selector);
    if(btn){
      btn.textContent=name||'– auswählen –';
      btn.dataset.tpValue=name||'';
    }
  }

  const currentCard=list?[...list.querySelectorAll('.tp-card[data-tp-id]')].find(c=>String(c.dataset.tpId||'')===state.id):null;
  tpWhiteboardEditHold={
    id:state.id,
    scrollTop:state.scrollTop,
    cardTop:currentCard?currentCard.getBoundingClientRect().top:null,
    until:Date.now()+12000
  };

  await tpUpdateField(state.id,state.field,state.idx,name);

  if(list)list.scrollTop=state.scrollTop;
  tpKeepWhiteboardEditPosition();

  tpWbPickerState=null;
}

// V2.9.45: gemeinsame Namensauflösung und Alias-Verwaltung
const TP_PLAYER_ALIAS_DOC='playerList';
function tpPlayerAliases(){return data.tournamentPlannerPlayerAliases||(data.tournamentPlannerPlayerAliases={});}
function tpResolvePlayerName(name){
  let n=String(name||'').trim(), seen=new Set(), aliases=tpPlayerAliases();
  while(aliases[n]&&!seen.has(n)){seen.add(n);n=aliases[n];}
  return n;
}
function tpPlayers(){
  const list=(data.tournamentPlannerPlayers&&data.tournamentPlannerPlayers.length)?data.tournamentPlannerPlayers.slice():TP_PLAYER_NAMES.slice();
  const names=[...new Set(list.map(tpResolvePlayerName).filter(Boolean))];
  if(!names.includes('X'))names.push('X');
  return names.sort((a,b)=>a.localeCompare(b,'de'));
}
function tpPlayerOptionsHtml(selected){
  const chosen=tpResolvePlayerName(selected), opts=['<option value="">– auswählen –</option>'];
  const list=tpPlayers();
  if(chosen&&!list.includes(chosen))list.push(chosen);
  opts.push(list.map(n=>'<option value="'+esc(n)+'" '+(n===chosen?'selected':'')+'>'+esc(n)+'</option>').join(''));
  return opts.join('');
}
async function tpSaveCentralPlayerList(){
  if(!save())throw Error('Lokales Speichern fehlgeschlagen');
  if(!firebaseReady||!firestoreDb||!firebaseAuthUser)throw Error('Keine Firebase-Verbindung. Die Liste wurde nur lokal gespeichert.');
  const payload={players:tpPlayers().filter(n=>n!=='X'),aliases:{...tpPlayerAliases()},updatedAt:new Date().toISOString()};
  await fbTimeout(firestoreDb.collection('appSettings').doc(TP_PLAYER_ALIAS_DOC).set(payload),30000,'Spielerliste speichern');
  return true;
}
async function tpLoadCentralPlayerList(){
  if(!firebaseReady||!firestoreDb)return;
  try{
    const doc=await firestoreDb.collection('appSettings').doc(TP_PLAYER_ALIAS_DOC).get();
    if(doc.exists){
      const remote=doc.data()||{};
      if(Array.isArray(remote.players)&&remote.players.length)data.tournamentPlannerPlayers=remote.players;
      if(remote.aliases&&typeof remote.aliases==='object')data.tournamentPlannerPlayerAliases=remote.aliases;
      save();
      renderTpPlayersAdminList();
    }
  }catch(e){console.warn('Zentrale Spielerliste nicht geladen:',e);}
}
function renderTpPlayersAdminList(){
  const el=document.getElementById('tpPlayersAdminList');if(!el)return;
  const players=tpPlayers().filter(p=>p!=='X');
  const aliases=tpPlayerAliases();
  el.innerHTML=players.length?players.map(p=>{
    const old=Object.keys(aliases).filter(a=>tpResolvePlayerName(a)===p);
    return '<div class="list-item"><div><b>'+esc(p)+'</b>'+(old.length?'<div class="small">Frühere Namen: '+esc(old.join(', '))+'</div>':'')+'</div><div class="row"><button onclick="tpRenamePlayer('+jsArg(p)+')">Ändern</button><button onclick="tpAddPlayerAlias('+jsArg(p)+')">Alias hinzufügen</button><button class="danger" onclick="tpRemovePlayer('+jsArg(p)+')">Entfernen</button></div></div>';
  }).join(''):'<div class="small">Keine Spieler vorhanden.</div>';
}
async function tpAddPlayer(){
  if(isWhiteboardUser()){showToast('Keine Berechtigung');return;}
  const input=document.getElementById('tpNewPlayer'),name=(input?.value||'').trim();
  if(!name){showToast('Bitte Namen eingeben');return;}
  if(tpPlayers().includes(name)||tpPlayerAliases()[name]){showToast('Spieler oder Alias bereits vorhanden');return;}
  if(!Array.isArray(data.tournamentPlannerPlayers)||!data.tournamentPlannerPlayers.length)data.tournamentPlannerPlayers=TP_PLAYER_NAMES.slice();
  data.tournamentPlannerPlayers.push(name);
  try{await tpSaveCentralPlayerList();if(input)input.value='';showToast('Spieler zentral gespeichert');}
  catch(e){showToast('Achtung: '+e.message,8000);}
  renderTpPlayersAdminList();
}
async function tpAddPlayerAlias(player){
  if(isWhiteboardUser())return;
  const raw=prompt('Früherer Name / Alias für „'+player+'“:');
  if(raw===null)return;
  const alias=raw.trim();
  if(!alias||alias===player)return;
  if(tpPlayers().includes(alias)&&alias!==player){showToast('Dieser Name gehört bereits zu einem Spieler');return;}
  const previous=tpPlayerAliases()[alias];
  if(previous&&tpResolvePlayerName(alias)!==player){showToast('Alias ist bereits einem anderen Spieler zugeordnet');return;}
  tpPlayerAliases()[alias]=player;
  try{await tpSaveCentralPlayerList();showToast('Alias gespeichert');}
  catch(e){showToast('Alias nur lokal gespeichert: '+e.message,8000);}
  renderTpPlayersAdminList();
}
async function tpRenamePlayer(oldName){
  if(isWhiteboardUser()){showToast('Keine Berechtigung');return;}
  const raw=prompt('Neuer Name für „'+oldName+'“:',oldName);
  if(raw===null)return;
  const newName=raw.trim();
  if(!newName||newName===oldName)return;
  if(tpPlayers().includes(newName)&&newName!==oldName){showToast('Diesen Namen gibt es bereits');return;}
  if(!Array.isArray(data.tournamentPlannerPlayers)||!data.tournamentPlannerPlayers.length)data.tournamentPlannerPlayers=TP_PLAYER_NAMES.slice();
  data.tournamentPlannerPlayers=data.tournamentPlannerPlayers.map(p=>p===oldName?newName:p);
  const aliases=tpPlayerAliases();
  Object.keys(aliases).forEach(k=>{if(aliases[k]===oldName)aliases[k]=newName;});
  aliases[oldName]=newName;
  // Nur Veranstaltungen des aktuellen und vorangegangenen Kalenderjahres ändern;
  // ältere historische Einträge bleiben unverändert.
  const minYear=new Date().getFullYear()-1;
  const changed=[];
  (data.tournamentPlanner||[]).forEach(x=>{
    if(!x||!x.date||Number(String(x.date).slice(0,4))<minYear)return;
    let dirty=false;
    if(x.reportedBy===oldName){x.reportedBy=newName;dirty=true;}
    if(Array.isArray(x.players)&&x.players.includes(oldName)){x.players=x.players.map(p=>p===oldName?newName:p);dirty=true;}
    if(dirty){x.updatedAt=new Date().toISOString();changed.push(x);}
  });
  save();
  renderTpPlayersAdminList();
  renderTournamentPlannerAdminList();
  if(document.getElementById('tournamentPlanner')?.classList.contains('active'))renderTournamentPlanner();
  let errors=[];
  try{await tpSaveCentralPlayerList();}catch(e){errors.push('Spielerliste: '+e.message);}
  if(firebaseReady&&firestoreDb){
    for(const x of changed){
      try{
        await fbTimeout(firestoreDb.collection('tournamentPlanner').doc(String(x.id)).update({
          reportedBy:String(x.reportedBy||''),
          players:[0,1,2,3].map(i=>String((x.players||[])[i]||'')),
          updatedAt:x.updatedAt
        }),30000,'Turnier aktualisieren');
      }catch(e){errors.push(x.date+': '+(e.message||e));}
    }
  }else if(changed.length)errors.push('Termine nicht mit Firebase synchronisiert');
  if(errors.length){showToast('Umbenennung lokal erfolgt, Firebase prüfen: '+errors.slice(0,2).join('; '),10000);}
  else showToast('Name und Alias gespeichert; '+changed.length+' Termin(e) aktualisiert');
}
async function tpRemovePlayer(name){
  if(isWhiteboardUser())return;
  if(!confirm('Spieler „'+name+'“ aus der Auswahl entfernen? Bestehende Termine bleiben erhalten.'))return;
  if(!Array.isArray(data.tournamentPlannerPlayers)||!data.tournamentPlannerPlayers.length)data.tournamentPlannerPlayers=TP_PLAYER_NAMES.slice();
  data.tournamentPlannerPlayers=data.tournamentPlannerPlayers.filter(p=>p!==name);
  try{await tpSaveCentralPlayerList();showToast('Spieler entfernt');}
  catch(e){showToast('Nur lokal geändert: '+e.message,8000);}
  renderTpPlayersAdminList();
}
// Firebase-Liste nach erfolgreicher Anmeldung nachladen.
setTimeout(()=>{tpLoadCentralPlayerList();},2500);
function tpLocationOptionsHtml(){const locs=[...new Set((data.tournamentPlanner||[]).map(x=>x&&x.location).filter(Boolean))].sort();return locs.map(l=>'<option value="'+esc(l)+'">').join('')}
function renderTournamentPlanner(){
  const el=document.getElementById('tpContent');if(!el)return;

  // #tpContent ist der tatsächliche Scroll-Container (.tp-list {overflow:auto}).
  // Deshalb dessen scrollTop sichern – NICHT window.scrollY.
  const previousListScrollTop=el.scrollTop;

  const loginNote=document.getElementById('tpLoginNote');
  if(loginNote){
    if(tpCanEditPlanner()){loginNote.style.display='none';loginNote.textContent='';}
    else{loginNote.style.display='block';loginNote.innerHTML='🔒 Nur Ansicht – zum Bearbeiten bitte anmelden. <button type="button" onclick="tpRequestLogin()">Anmelden</button>';}
  }
  tpMigrateTypes();
  const tpDefaultPeriod=isWhiteboardUser()?'y'+String(new Date().getFullYear()):'upcoming';
  tpPopulatePeriodFilter('tpPeriodFilter',tpDefaultPeriod);
  tpPopulateTypeFilter('tpTypeFilter');
  tpRenderStats();
  const filter=document.getElementById('tpPeriodFilter')?.value||'upcoming';
  const typeFilter=document.getElementById('tpTypeFilter')?.value||'all';
  let items=tpFilterByType(tpFilterByPeriod(tpSortedEvents(),filter),typeFilter);
  if(!items.length){el.innerHTML='<div class="tp-empty">Keine Veranstaltungen in diesem Zeitraum.</div>';const ln=document.getElementById('tpListNote');if(ln)ln.textContent='Angezeigt: 0 Veranstaltungen';return}
  const totalItems=items.length;
  const listNote=document.getElementById('tpListNote');
  if(listNote)listNote.textContent='Angezeigt: '+totalItems+' Veranstaltungen';
  const today=todayStr();
  el.innerHTML=items.map(x=>{
    const players=(x.players&&x.players.length===4)?x.players:['','','',''];
    const isPast=x.date&&x.date<today;
    const canEdit=tpCanEditPlanner();
    const allowsPlayers=tpAllowsPlayers(x.type);
    const playersDisabled=!canEdit;
    const playerFields=allowsPlayers?[0,1,2,3].map(i=>{
      const label='<label>Spieler '+(i+1)+'</label>';
      if(isWhiteboardUser()){
        return '<div class="tp-row">'+label
          +'<button type="button" class="tp-wb-player-btn" data-tp-field="players" data-tp-player-index="'+i+'" data-tp-value="'+esc(players[i]||'')+'" onclick="tpOpenWhiteboardPlayerPicker('+jsArg(x.id)+',\'players\','+i+','+jsArg(players[i]||'')+')">'
          +esc(players[i]||'– auswählen –')+'</button></div>';
      }
      return '<div class="tp-row'+(playersDisabled?' tp-players-disabled':'')+'">'+label+'<select data-tp-field="players" data-tp-player-index="'+i+'" '+(playersDisabled?'disabled ':'')+'onchange="tpUpdateField('+jsArg(x.id)+',\'players\','+i+',this.value)">'+tpPlayerOptionsHtml(players[i])+'</select></div>';
    }).join(''):'';
    const nameWraps=x.name&&x.name.trim().split(/\s+/).filter(Boolean).length>=2;
    return '<div class="tp-card'+(isPast?' tp-past':'')+'" data-tp-id="'+esc(String(x.id))+'" data-tp-date="'+esc(String(x.date||''))+'">'
      +'<div class="tp-name'+(nameWraps?' tp-name-wrap':'')+'">'+esc(x.name)+'</div>'
      +'<div class="tp-meta">'
      +'<div class="tp-date"><div>'+(tpDayLabel(x.date)?esc(tpDayLabel(x.date))+' · ':'')+esc(tpFormatDate(x.date))+'</div>'+(x.time?'<div>'+esc(x.time)+' Uhr</div>':'<div>&nbsp;</div>')+'</div>'
      +'<span class="tp-type-locked-value">'+esc(tpCanonicalType(x.type)||'– keine –')+'</span>'
      +(x.location?'<div class="tp-loc">📍 '+esc(x.location)+'</div>':'')
      +'</div>'
      +(allowsPlayers?('<div class="tp-fields">'
      +'<div class="tp-fields-row">'
      +(isWhiteboardUser()
        ?'<div class="tp-row"><label>Gemeldet von</label><button type="button" class="tp-wb-player-btn" data-tp-field="reportedBy" data-tp-value="'+esc(x.reportedBy||'')+'" onclick="tpOpenWhiteboardPlayerPicker('+jsArg(x.id)+',\'reportedBy\',null,'+jsArg(x.reportedBy||'')+')">'+esc(x.reportedBy||'– auswählen –')+'</button></div>'
        :'<div class="tp-row'+(playersDisabled?' tp-players-disabled':'')+'"><label>Gemeldet von</label><select data-tp-field="reportedBy" '+(playersDisabled?'disabled ':'')+'onchange="tpUpdateField('+jsArg(x.id)+',\'reportedBy\',null,this.value)">'+tpPlayerOptionsHtml(x.reportedBy)+'</select></div>')
      +playerFields
      +'</div>'
      +'</div>'):'')
      +'</div>';
  }).join('');
  // renderTournamentPlanner() darf grundsätzlich NIE selbst zum aktuellen
  // Datum springen. Bei jedem Neuaufbau bleibt die bestehende Listenposition.
  el.scrollTop=previousListScrollTop;
  requestAnimationFrame(()=>{ el.scrollTop=previousListScrollTop; });

  if(isWhiteboardUser() && tpWhiteboardEditHoldActive()){
    tpKeepWhiteboardEditPosition();
  }
}
function tpTypeChanged(id,selectEl){if(isWhiteboardUser()){showToast('Whiteboard: nur Spielerauswahl und Gemeldet von sind bearbeitbar.');return;}
  if(!tpRequirePlannerEdit())return;
  const value=selectEl.value;
  tpUpdateField(id,'type',null,value);
  tpRenderStats();
  const tf=document.getElementById('tpTypeFilter');if(tf&&tf.value!=='all'&&tpCanonicalType(tf.value)!==tpCanonicalType(value))renderTournamentPlanner();
  const card=selectEl.closest('.tp-card');
  if(!card)return;
  const allow=tpAllowsPlayers(value);
  card.querySelectorAll('.tp-row').forEach(row=>{
    const label=row.querySelector('label');
    const sel=row.querySelector('select');
    if(!label||!sel)return;
    const text=(label.textContent||'').trim();
    if(!/^Spieler\s*\d+$/.test(text)&&text!=='Gemeldet von')return;
    row.classList.toggle('tp-players-disabled',!allow);
    sel.disabled=!allow;
    if(!allow)sel.value='';
  });
  if(!allow)tpUpdateField(id,'reportedBy',null,'');
}
async function tpUpdateField(id,field,idx,value){
  if(isWhiteboardUser()&&(!['players','reportedBy'].includes(field)||(field==='players'&&(!Number.isInteger(idx)||idx<0||idx>3)))){showToast('Dieses Feld ist für das Whiteboard gesperrt.');return;}
  if(!tpRequirePlannerEdit())return;
  const item=tpFindEvent(id);if(!item)return;

  // Die Position wurde im Capture-Event bereits VOR dem Öffnen des Selects
  // gesichert. Falls die Änderung z. B. per Tastatur kam, hier nur ergänzen.
  if(isWhiteboardUser()){
    tpBeginWhiteboardEditHold(id,false);
    tpKeepWhiteboardEditPosition();
  }
  const oldPlayers=Array.isArray(item.players)?item.players.slice():['','','',''];
  const oldReportedBy=String(item.reportedBy||'');
  if(field==='players'){item.players=(item.players&&item.players.length===4)?item.players:['','','',''];item.players[idx]=value}
  else{item[field]=value}
  save();
  // Spieler/Gemeldet-von verändern die Termin-Statistikkarten nicht.
  // Am Whiteboard deshalb KEIN Neuaufbau oberhalb der Liste.
  if(!isWhiteboardUser())tpRenderStats();
  tpRefreshHistoryIfOpen();
  const status=document.getElementById('tpFirebaseStatus');
  if(status)status.textContent='Änderung wird in Firebase gespeichert …';
  const ok=await tpSyncEventToFirebase(item);
  if(ok){
    if(status)status.textContent='✓ Änderung in Firebase gespeichert · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
    if(isWhiteboardUser()){
      tpPatchVisiblePlannerValues();
      tpKeepWhiteboardEditPosition();
      tpReleaseWhiteboardEditHoldLater(id,3000);
    }
    showToast('✓ In Firebase gespeichert');
    if(!isWhiteboardUser()&&!isPublicWhiteboardMode()&&item.googleEventId&&tpCalendarSettings().clientId){
      const result=await tpCalendarAutoAfterSave(item,false,null);
      if(!result.ok)showToast('Firebase gespeichert; Google Kalender noch nicht aktualisiert. Bitte Google-Verbindung prüfen.',10000);
    }
  }else{
    // Bei fehlgeschlagenem Whiteboard-Speichern lokalen Wert zurücksetzen,
    // damit nicht der Eindruck entsteht, die Änderung sei zentral gespeichert.
    if(isWhiteboardUser()){
      item.players=oldPlayers;
      item.reportedBy=oldReportedBy;
      save();
      renderTournamentPlanner();
      tpReleaseWhiteboardEditHoldLater(id,2500);
    }
  }
}
function tpRefreshHistoryIfOpen(){
  if(document.getElementById('tpHistoryModal')?.classList.contains('show'))renderTpHistory();
}
async function tpSyncEventToFirebase(item){
  if(!firebaseReady||!firestoreDb){
    showToast('Firebase ist nicht verbunden',5000);
    return false;
  }
  if(isWhiteboardUser()){
    const status=document.getElementById('tpFirebaseStatus');
    if(status)status.textContent='☁ Whiteboard: Änderung wird in Firebase gespeichert …';
    try{
      await fbTimeout(
        firestoreDb.collection('tournamentPlanner').doc(String(item.id)).update({
          reportedBy:String(item.reportedBy||''),
          players:[0,1,2,3].map(i=>String((item.players||[])[i]||'')),
          updatedAt:new Date().toISOString()
        }),
        30000,
        'Turnierplaner speichern'
      );
      if(status)status.textContent='✓ Whiteboard: in Firebase gespeichert · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
      return true;
    }catch(e){
      console.error('Whiteboard-Turnierplaner:',e);
      const msg=(typeof firebaseErrorText==='function')?firebaseErrorText(e):(e.code||e.message||String(e));
      if(status)status.textContent='✗ Whiteboard: Firebase-Speicherung fehlgeschlagen: '+msg;
      showToast('Änderung konnte nicht in Firebase gespeichert werden: '+msg,7000);
      return false;
    }
  }

  try{
    await fbTimeout(firestoreDb.collection('tournamentPlanner').doc(String(item.id)).set({
      id:String(item.id),name:String(item.name||''),date:String(item.date||''),time:String(item.time||''),
      reportedBy:String(item.reportedBy||''),players:[0,1,2,3].map(i=>String((item.players||[])[i]||'')),
      location:String(item.location||''),type:String(item.type||''),internal:!!item.internal,calendarExported:!!item.calendarExported,googleEventId:String(item.googleEventId||''),googleEventCalendarId:String(item.googleEventCalendarId||''),calendarExportedBeforeChange:!!item.calendarExportedBeforeChange,googleEventUpdated:String(item.googleEventUpdated||''),googleSyncedFields:tpGoogleStoredFields(item.googleSyncedFields),updatedAt:String(item.updatedAt||new Date().toISOString())
    },{merge:true}),20000,'Firebase');
    return true;
  }catch(e){
    console.error('Firebase Turnierplaner:',e);
    showToast('Änderung nur lokal gespeichert – Firebase nicht erreichbar',4500);
    return false;
  }
}
function tpPad(n){return String(n).padStart(2,'0')}
function tpIcsEscape(s){return String(s||'').replace(/[\\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n')}
function tpCalendarSettings(){
  const s=data.settings||{};
  return {
    orgName:s.tpCalendarOrgName||'EC Wegscheid',
    durationHours:Number(s.tpCalendarDurationHours)>0?Number(s.tpCalendarDurationHours):2,
    calendarId:(s.tpGoogleCalendarId||'').trim()||'primary',
    clientId:(s.tpGoogleClientId||'').trim()
  };
}
function tpBuildIcs(x){
  const dateStr=(x.date||'').replace(/-/g,'');
  if(!dateStr)return null;
  const cfg=tpCalendarSettings();
  let dtStart,dtEnd,allDay=false;
  if(x.time&&/^\d{2}:\d{2}$/.test(x.time)){
    const hh=x.time.slice(0,2),mm=x.time.slice(3,5);
    dtStart=dateStr+'T'+hh+mm+'00';
    const endDate=new Date(x.date+'T'+x.time+':00');endDate.setHours(endDate.getHours()+cfg.durationHours);
    dtEnd=endDate.getFullYear()+tpPad(endDate.getMonth()+1)+tpPad(endDate.getDate())+'T'+tpPad(endDate.getHours())+tpPad(endDate.getMinutes())+'00';
  }else{
    allDay=true;dtStart=dateStr;
    const d=new Date(x.date+'T00:00:00');d.setDate(d.getDate()+1);
    dtEnd=d.getFullYear()+tpPad(d.getMonth()+1)+tpPad(d.getDate());
  }
  const players=(x.players||[]).filter(Boolean).join(', ');
  const descParts=[];
  if(x.reportedBy)descParts.push('Gemeldet von: '+x.reportedBy);
  if(players)descParts.push('Spieler: '+players);
  const desc=descParts.join('\\n');
  const orgId=cfg.orgName.toLowerCase().replace(/[^a-z0-9]+/g,'')||'verein';
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//'+cfg.orgName+'//Turnierplaner//DE','BEGIN:VEVENT',
    'UID:'+String(x.id)+'@'+orgId,
    'DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z',
    (allDay?'DTSTART;VALUE=DATE:'+dtStart:'DTSTART:'+dtStart),
    (allDay?'DTEND;VALUE=DATE:'+dtEnd:'DTEND:'+dtEnd),
    'SUMMARY:'+tpIcsEscape(x.name),
    (x.location?'LOCATION:'+tpIcsEscape(x.location):''),
    (desc?'DESCRIPTION:'+tpIcsEscape(desc):''),
    'END:VEVENT','END:VCALENDAR'];
  return lines.filter(Boolean).join('\r\n');
}
let tpGToken=null,tpGTokenExp=0;
function tpLoadGis(){return new Promise((res,rej)=>{if(window.google&&google.accounts&&google.accounts.oauth2)return res();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=res;s.onerror=()=>rej(new Error('Google-Anmeldung konnte nicht geladen werden (Internet?)'));document.head.appendChild(s)})}
async function tpGoogleToken(){
  if(tpGToken&&Date.now()<tpGTokenExp)return tpGToken;
  const cfg=tpCalendarSettings();if(!cfg.clientId)throw new Error('Keine Google Client-ID eingetragen');
  await tpLoadGis();
  return new Promise((res,rej)=>{
    google.accounts.oauth2.initTokenClient({client_id:cfg.clientId,scope:'https://www.googleapis.com/auth/calendar.events',
      callback:r=>{if(r.error)return rej(new Error(r.error_description||r.error));tpGToken=r.access_token;tpGTokenExp=Date.now()+(Number(r.expires_in)||3000)*1000-60000;res(tpGToken)},
      error_callback:e=>rej(new Error(e&&e.type==='popup_closed'?'Anmeldung abgebrochen':(e&&e.type)||'Anmeldung fehlgeschlagen'))
    }).requestAccessToken();
  });
}
async function tpGoogleConnect(){
  try{await tpGoogleToken();showToast('Mit Google verbunden');await tpGooglePullLinkedChanges(true)}catch(e){showToast('Google-Verbindung fehlgeschlagen: '+(e?.message||e),8000)}
}
function tpGoogleEvent(x){
  const cfg=tpCalendarSettings(),tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Vienna';
  const fmt=d=>d.getFullYear()+'-'+tpPad(d.getMonth()+1)+'-'+tpPad(d.getDate());
  let start,end;
  if(/^\d{2}:\d{2}$/.test(x.time||'')){
    const e=new Date(x.date+'T'+x.time+':00');e.setHours(e.getHours()+cfg.durationHours);
    start={dateTime:x.date+'T'+x.time+':00',timeZone:tz};end={dateTime:fmt(e)+'T'+tpPad(e.getHours())+':'+tpPad(e.getMinutes())+':00',timeZone:tz};
  }else{
    const d=new Date(x.date+'T00:00:00');d.setDate(d.getDate()+1);
    start={date:x.date};end={date:fmt(d)};
  }
  const players=(x.players||[]).filter(Boolean).join(', ');
  const desc=[x.reportedBy?'Gemeldet von: '+x.reportedBy:'',players?'Spieler: '+players:''].filter(Boolean).join('\n');
  return {summary:x.name||'Termin',location:x.location||'',description:desc,start,end};
}
async function tpGoogleInsert(x){
  const cfg=tpCalendarSettings();
  const tok=await tpGoogleToken();
  const r=await fetch('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(cfg.calendarId)+'/events',{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify(tpGoogleEvent(x))});
  if(!r.ok){if(r.status===401)tpGToken=null;let m='';try{m=(await r.json()).error.message}catch(e){}throw new Error(m||('Fehler '+r.status))}
  const created=await r.json();
  if(!created.id)throw new Error('Google hat keine Kalender-Ereignis-ID geliefert');
  return {id:String(created.id),calendarId:cfg.calendarId,updated:String(created.updated||'')};
}
async function tpGoogleUpdate(x){
  const cfg=tpCalendarSettings();
  if(!x.googleEventId)throw new Error('Für diesen älteren Kalendereintrag ist keine Google-Ereignis-ID gespeichert. Bitte den bisherigen Termin im Google Kalender manuell entfernen; erst danach einen neuen Export durchführen.');
  const calId=x.googleEventCalendarId||cfg.calendarId;
  if(calId!==cfg.calendarId)throw new Error('Der ursprüngliche Google Kalender ist nicht der aktuell ausgewählte. Bitte zuerst die ursprüngliche Kalender-ID einstellen.');
  const tok=await tpGoogleToken();
  const url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calId)+'/events/'+encodeURIComponent(x.googleEventId);
  const latest=await tpGoogleFetchLinked(x,tok);
  if(!latest||latest.status==='cancelled')throw new Error('Der verknüpfte Google-Termin existiert nicht mehr. Kein neuer Termin angelegt.');
  if(tpCalendarRemoteChanged(x,latest)){
    throw new Error('Google-Termin wurde inzwischen verändert. Bitte in Kalendereinstellungen → Jetzt abgleichen den Konflikt lösen (Google übernehmen / Programm übernehmen). Keine Überschreibung durchgeführt.');
  }
  const r=await fetch(url,{method:'PATCH',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify(tpGoogleEvent(x))});
  if(!r.ok){if(r.status===401)tpGToken=null;let m='';try{m=(await r.json()).error.message}catch(e){}throw new Error(m||('Fehler '+r.status))}
  const body=await r.json();return {updated:String(body.updated||'')};
}
// V2.9.12: bidirektionaler Abgleich nur für eindeutig verknüpfte Ereignisse.
// Ohne gespeicherte Google-ID wird NIEMALS automatisch ein Termin importiert oder erzeugt.
let tpGooglePullRunning=false;
function tpGoogleRemoteFields(e){
  const description=String(e.description||'');
  const findLine=label=>{
    const line=description.split(/\r?\n/).find(v=>v.toLowerCase().startsWith(label.toLowerCase()+':'));
    return line?line.slice(label.length+1).trim():'';
  };
  const rawPlayers=findLine('Spieler');
  return {name:String(e.summary||''),date:tpCalendarGoogleDate(e),time:tpCalendarGoogleTime(e),location:String(e.location||''),reportedBy:findLine('Gemeldet von'),players:rawPlayers?rawPlayers.split(',').map(v=>v.trim()).slice(0,4):[]};
}
const TP_GOOGLE_FIELDS=['name','date','time','location','reportedBy','players'];
function tpGoogleFieldValue(v,k){
  if(k==='players')return JSON.stringify(Array.from({length:4},(_,i)=>String((Array.isArray(v?.players)?v.players:[])[i]||'').trim()));
  return String(v?.[k]||'');
}
function tpGoogleStoredFields(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const result={};TP_GOOGLE_FIELDS.forEach(k=>result[k]=k==='players'?(Array.isArray(value.players)?value.players.slice(0,4):[]):String(value[k]||''));return result;
}
function tpGoogleCurrentFields(x){
  const f={};TP_GOOGLE_FIELDS.forEach(k=>f[k]=k==='players'?(Array.isArray(x.players)?x.players.slice(0,4):[]):String(x[k]||''));return f;
}
function tpGoogleEqualFields(a,b){return !!a&&!!b&&TP_GOOGLE_FIELDS.every(k=>tpGoogleFieldValue(a,k)===tpGoogleFieldValue(b,k));}
function tpGoogleLocalChangedSinceSync(x){
  const synced=tpGoogleStoredFields(x.googleSyncedFields);
  if(synced)return !tpGoogleEqualFields(tpGoogleCurrentFields(x),synced);
  // Alte V2.9.13-Einträge besitzen noch keinen Kalender-Snapshot.
  // Beim Google-Export lag der Google-Zeitstempel i.d.R. nach updatedAt.
  // Falls danach im Programm gespeichert wurde, ist eine Bestätigung nötig.
  const local=Date.parse(x.updatedAt||'')||0;
  const baseline=Date.parse(x.googleEventUpdated||'')||0;
  return !baseline||!local||local>baseline;
}
function tpGoogleMarkSynced(x,remoteUpdated){
  x.googleEventUpdated=String(remoteUpdated||'');
  x.googleSyncedFields=tpGoogleCurrentFields(x);
  x.calendarExported=true;
  x.calendarExportedBeforeChange=false;
}
function tpGoogleFieldsDiffer(x,e){
  const f=tpGoogleRemoteFields(e);
  return TP_GOOGLE_FIELDS.some(k=>tpGoogleFieldValue(x,k)!==tpGoogleFieldValue(f,k));
}
function tpCalendarRemoteChanged(x,e){
  if(!tpGoogleFieldsDiffer(x,e))return false;
  const remote=Date.parse(e.updated||'')||0;
  const baseline=Date.parse(x.googleEventUpdated||'')||0;
  // Ein abweichender Google-Stand darf nie ohne Bestätigung überschrieben werden.
  // Auch wenn der alte Zeitstempel unvollständig ist, bleibt der Schutz aktiv.
  return !baseline||!remote||remote>baseline||!tpGoogleEqualFields(tpGoogleCurrentFields(x),tpGoogleRemoteFields(e));
}
async function tpGoogleFetchLinked(x,token){
  const cfg=tpCalendarSettings();
  const calId=x.googleEventCalendarId||cfg.calendarId;
  if(calId!==cfg.calendarId)throw new Error('Andere Kalender-ID: '+calId);
  const url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calId)+'/events/'+encodeURIComponent(x.googleEventId);
  const r=await fetch(url,{headers:{Authorization:'Bearer '+token}});
  if(r.status===404||r.status===410)return null;
  if(!r.ok){if(r.status===401)tpGToken=null;let message='';try{message=(await r.json()).error?.message||''}catch(e){}throw new Error(message||'Google Kalender: '+r.status)}
  return r.json();
}
function tpGooglePullStatus(msg){
  const el=document.getElementById('tpGooglePullStatus');if(el)el.textContent=msg;
}
// Konflikte werden bewusst NICHT automatisch aufgelöst.
const tpGoogleConflicts=new Map();
function tpGoogleConflictPrompt(){
  if(!tpGoogleConflicts.size||isWhiteboardUser()||isPublicWhiteboardMode())return;
  let overlay=document.getElementById('tpGoogleStartupOverlay');
  if(!overlay){
    overlay=document.createElement('div');overlay.id='tpGoogleStartupOverlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML='<div style="background:#fff;color:#222;max-width:800px;width:100%;max-height:88vh;overflow:auto;padding:22px;border-radius:12px"><h2>Änderungen im Google Kalender gefunden</h2><p>Bitte entscheide je Termin, ob Google oder das Programm gelten soll. Ohne Bestätigung wird nichts überschrieben.</p><div id="tpGoogleStartupItems"></div><button type="button" id="tpGoogleLaterBtn">Später entscheiden</button></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#tpGoogleLaterBtn').onclick=()=>{overlay.style.display='none'};
  }
  overlay.style.display='flex';
  const target=document.getElementById('tpGoogleStartupItems');
  if(target)target.innerHTML=document.getElementById('tpGoogleConflictList')?.innerHTML||'';
}
function tpGoogleConflictRender(){
  const el=document.getElementById('tpGoogleConflictList');if(!el)return;
  if(!tpGoogleConflicts.size){el.innerHTML='';const popup=document.getElementById('tpGoogleStartupOverlay');if(popup)popup.style.display='none';return;}
  let html='<div class="card" style="margin-top:10px;border:1px solid #d58d4b"><b>Kalender-Konflikte – bitte entscheiden</b>';
  for(const [id,c] of tpGoogleConflicts){
    const local=c.local,remote=c.remote;
    const fmt=x=>esc((x.date||'')+' '+(x.time||'ganztägig')+' · '+(x.location||'ohne Ort')+' · Spieler: '+(x.players||[]).filter(Boolean).join(', ')+' · Gemeldet von: '+(x.reportedBy||'—'));
    html+='<div style="padding:12px 0;border-bottom:1px solid #7775"><b>'+esc(local.name||id)+'</b>'+
      '<div class="small">Programm: '+fmt(local)+'</div><div class="small">Google: '+fmt(remote)+'</div>'+
      '<div class="row" style="margin-top:8px;flex-wrap:wrap">'+
      '<button type="button" onclick="tpGoogleResolveConflict('+jsArg(id)+',&quot;google&quot;)">Google übernehmen</button>'+
      '<button type="button" onclick="tpGoogleResolveConflict('+jsArg(id)+',&quot;program&quot;)">Programm übernehmen</button>'+
      '<button type="button" onclick="tpGoogleResolveConflict('+jsArg(id)+',&quot;cancel&quot;)">Abbrechen</button></div></div>';
  }
  el.innerHTML=html+'</div>';
}
function tpGoogleConflictAdd(x,google){
  tpGoogleConflicts.set(String(x.id),{
    local:{...x,googleSyncedFields:tpGoogleStoredFields(x.googleSyncedFields)},
    remote:tpGoogleRemoteFields(google),
    remoteUpdated:String(google.updated||''),remoteEtag:String(google.etag||'')
  });
}
async function tpGoogleResolveConflict(id,decision){
  const key=String(id),c=tpGoogleConflicts.get(key);
  if(!c)return;
  if(decision==='cancel'){
    tpGoogleConflicts.delete(key);tpGoogleConflictRender();
    tpGooglePullStatus('Konflikt zurückgestellt. Beim nächsten Abgleich wird er erneut geprüft.');return;
  }
  if(decision!=='google'&&decision!=='program')return;
  if(!firebaseReady||!firestoreDb||!firebaseAuthUser||!appPermissions.admin||isWhiteboardUser()||isPublicWhiteboardMode())return;
  const label=decision==='google'?'Google übernehmen':'Programm übernehmen';
  if(!confirm('Für „'+c.local.name+'“ wirklich „'+label+'“ ausführen?\nName, Datum, Uhrzeit, Ort, Spieler und „Gemeldet von“ werden abgeglichen.'))return;
  try{
    const token=await tpGoogleToken();
    const docRef=firestoreDb.collection('tournamentPlanner').doc(key);
    const currentSnap=await docRef.get({source:'server'});
    if(!currentSnap.exists)throw new Error('Termin wurde zwischenzeitlich gelöscht. Bitte neu abgleichen.');
    const current=currentSnap.data()||{};
    if(String(current.updatedAt||'')!==String(c.local.updatedAt||'')||
       String(current.googleEventUpdated||'')!==String(c.local.googleEventUpdated||'')||
       String(current.googleEventId||'')!==String(c.local.googleEventId||'')||
       !tpGoogleEqualFields(tpGoogleCurrentFields(current),tpGoogleCurrentFields(c.local)))
      throw new Error('Termin wurde inzwischen im Programm geändert. Bitte neu abgleichen.');
    const latest=await tpGoogleFetchLinked(c.local,token);
    if(!latest||latest.status==='cancelled')throw new Error('Google-Termin fehlt. Keine Daten geändert.');
    if(String(latest.updated||'')!==c.remoteUpdated||
       (c.remoteEtag&&String(latest.etag||'')!==c.remoteEtag))
      throw new Error('Google-Termin wurde erneut geändert. Bitte neu abgleichen.');
    if(decision==='google'){
      const fields=tpGoogleRemoteFields(latest);
      if(!fields.date)throw new Error('Ungültiges Google-Datum.');
      await firestoreDb.runTransaction(async tx=>{
        const snap=await tx.get(docRef);if(!snap.exists)throw new Error('Termin gelöscht');
        const v=snap.data()||{};
        if(String(v.updatedAt||'')!==String(c.local.updatedAt||'')||
           String(v.googleEventUpdated||'')!==String(c.local.googleEventUpdated||'')||
           !tpGoogleEqualFields(tpGoogleCurrentFields(v),tpGoogleCurrentFields(c.local)))
          throw new Error('Zwischenzeitliche Änderung in Firebase – bitte neu abgleichen');
        tx.set(docRef,{...fields,googleEventUpdated:String(latest.updated||''),googleSyncedFields:fields,calendarExported:true,calendarExportedBeforeChange:false},{merge:true});
      });
    }else{
      const calId=c.local.googleEventCalendarId||tpCalendarSettings().calendarId;
      const url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calId)+'/events/'+encodeURIComponent(c.local.googleEventId);
      const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
      if(latest.etag)headers['If-Match']=String(latest.etag);
      const response=await fetch(url,{method:'PATCH',headers,body:JSON.stringify(tpGoogleEvent(current))});
      if(!response.ok){if(response.status===401)tpGToken=null;throw new Error(response.status===412?'Google-Termin wurde während des Abgleichs geändert. Bitte erneut abgleichen.':'Google Kalender: Fehler '+response.status)}
      const written=await response.json();
      // Google wurde bestätigt. Das Firestore-Dokument darf bei einem Fehler
      // keinesfalls stillschweigend als erfolgreich synchronisiert gelten.
      await firestoreDb.runTransaction(async tx=>{
        const snap=await tx.get(docRef);if(!snap.exists)throw new Error('Termin in Firebase gelöscht; Google bereits aktualisiert');
        const v=snap.data()||{};
        if(String(v.updatedAt||'')!==String(c.local.updatedAt||'')||
           !tpGoogleEqualFields(tpGoogleCurrentFields(v),tpGoogleCurrentFields(c.local)))
          throw new Error('Termin zwischenzeitlich in Firebase geändert; Google bereits aktualisiert');
        tx.set(docRef,{googleEventUpdated:String(written.updated||''),googleSyncedFields:tpGoogleCurrentFields(v),calendarExported:true,calendarExportedBeforeChange:false},{merge:true});
      });
    }
    tpGoogleConflicts.delete(key);tpGoogleConflictRender();
    if(!await loadTournamentPlannerFromFirebase(true))throw new Error('Abgleich gespeichert, aber Firebase konnte nicht neu geladen werden. Bitte Seite neu laden.');
    renderTournamentPlannerAdminList();
    if(document.getElementById('tournamentPlanner')?.classList.contains('active'))renderTournamentPlanner();
    tpGooglePullStatus('Konflikt für „'+c.local.name+'“ gelöst: '+label+'.');
    showToast('Google-Konflikt erfolgreich gelöst: '+label,7000);
  }catch(e){
    const message=e?.message||String(e);
    tpGooglePullStatus('Konflikt nicht gelöst: '+message);
    showToast('Konflikt nicht gelöst: '+message,12000);
  }
}
async function tpGooglePullLinkedChanges(interactive=false){
  if(tpGooglePullRunning||isWhiteboardUser()||isPublicWhiteboardMode()||!firebaseAuthUser||!appPermissions.admin)return;
  if(!tpCalendarSettings().clientId||!firebaseReady||!firestoreDb)return;
  if(!interactive&&(!tpGToken||Date.now()>=tpGTokenExp)){
    tpGooglePullStatus('Für den Google-Abgleich bitte einmal „Mit Google verbinden“ wählen.');return;
  }
  tpGooglePullRunning=true;
  tpGoogleConflicts.clear();tpGoogleConflictRender();
  let updated=0,checked=0,conflicts=0,missing=0,errors=[];
  try{
    const token=interactive?await tpGoogleToken():tpGToken;
    const snap=await firestoreDb.collection('tournamentPlanner').get({source:'server'});
    const linked=[];
    snap.forEach(doc=>{const x=doc.data()||{};if(x.googleEventId)linked.push({id:doc.id,...x})});
    const LIMIT=200;
    for(const x of linked.slice(0,LIMIT)){
      checked++;
      try{
        const google=await tpGoogleFetchLinked(x,token);
        if(!google||google.status==='cancelled'){missing++;continue;}
        const fields=tpGoogleRemoteFields(google);
        if(!fields.date){conflicts++;tpGoogleConflictAdd(x,google);continue;}
        const differs=!tpGoogleEqualFields(tpGoogleCurrentFields(x),fields);
        const remoteMs=Date.parse(google.updated||'')||0;
        const baselineMs=Date.parse(x.googleEventUpdated||'')||0;
        const changedGoogle=!!remoteMs&&(!baselineMs||remoteMs>baselineMs);
        const changedLocal=tpGoogleLocalChangedSinceSync(x);
        if(differs){
          // Nur echte Abweichungen als Konflikt zeigen; keine Daten verwerfen.
          conflicts++;tpGoogleConflictAdd(x,google);continue;
        }
        if(!differs&&String(x.googleEventUpdated||'')===String(google.updated||'')&&
           tpGoogleEqualFields(tpGoogleStoredFields(x.googleSyncedFields),fields))continue;
        // Falls nur im Programm bearbeitet wurde, niemals durch unveränderte
        // Google-Daten ersetzen. Das erledigt der normale Programm→Google-Weg.
        if(differs&&!changedGoogle)continue;
        const docRef=firestoreDb.collection('tournamentPlanner').doc(String(x.id));
        await firestoreDb.runTransaction(async tx=>{
          const current=await tx.get(docRef);
          if(!current.exists)throw new Error('Veranstaltung inzwischen gelöscht');
          const v=current.data()||{};
          if(String(v.updatedAt||'')!==String(x.updatedAt||'')||
             String(v.googleEventId||'')!==String(x.googleEventId||'')||
             String(v.googleEventUpdated||'')!==String(x.googleEventUpdated||'')||
             !tpGoogleEqualFields(tpGoogleCurrentFields(v),tpGoogleCurrentFields(x)))
            throw new Error('Zwischenzeitliche Änderung – bitte erneut abgleichen');
          tx.set(docRef,{...(differs?fields:{}),googleEventUpdated:String(google.updated||''),
            googleSyncedFields:fields,calendarExported:true,calendarExportedBeforeChange:false},{merge:true});
        });
        const local=tpFindEvent(x.id);
        if(local){if(differs)Object.assign(local,fields);tpGoogleMarkSynced(local,google.updated||'');}
        if(differs)updated++;
      }catch(e){errors.push(String(x.name||x.id)+': '+(e?.message||e));}
    }
    // Auch reine Metadaten-Aktualisierungen lokal behalten.
    if(updated||checked)save();
    if(updated){renderTournamentPlannerAdminList();if(document.getElementById('tournamentPlanner')?.classList.contains('active'))renderTournamentPlanner();}
    let msg='Google-Abgleich: '+checked+' verknüpfte Termine geprüft, '+updated+' Änderung(en) übernommen.';
    if(conflicts)msg+=' '+conflicts+' Konflikt(e) – bitte unten entscheiden.';
    if(missing)msg+=' '+missing+' fehlende/gelöschte Google-Termine – im Programm beibehalten.';
    if(linked.length>LIMIT)msg+=' '+(linked.length-LIMIT)+' weitere Termine noch nicht geprüft.';
    if(errors.length)msg+=' '+errors.length+' Fehler: '+errors.slice(0,2).join('; ');
    tpGooglePullStatus(msg);tpGoogleConflictRender();if(conflicts)tpGoogleConflictPrompt();
    if(interactive||updated||conflicts||errors.length)showToast(msg,12000);
    return {checked,updated,conflicts,missing,errors};
  }catch(e){tpGooglePullStatus('Google-Abgleich nicht möglich: '+(e?.message||e));if(interactive)showToast('Google-Abgleich: '+(e?.message||e),8000);return {error:e?.message||String(e)};}
  finally{tpGooglePullRunning=false;}
}

// Löscht nur einen eindeutig zugeordneten Google-Kalendereintrag.
// Fehler beim Google-Löschen verhindern bewusst das Löschen im Turnierplaner.
async function tpGoogleDelete(x){
  if(!x.googleEventId)throw new Error('Keine gespeicherte Google-Ereignis-ID vorhanden');
  const cfg=tpCalendarSettings();
  if(!cfg.clientId)throw new Error('Google Client-ID fehlt in den Kalendereinstellungen');
  const calId=x.googleEventCalendarId||cfg.calendarId;
  if(calId!==cfg.calendarId)throw new Error('Dieser Termin gehört zu einem anderen Google Kalender. Bitte zuerst die ursprüngliche Kalender-ID einstellen.');
  const tok=await tpGoogleToken();
  const url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calId)+'/events/'+encodeURIComponent(x.googleEventId);
  const r=await fetch(url,{method:'DELETE',headers:{Authorization:'Bearer '+tok}});
  // 404/410: Google bestätigt, dass kein Eintrag mehr vorhanden ist.
  if(r.ok||r.status===404||r.status===410)return true;
  if(r.status===401)tpGToken=null;
  let message='';try{const body=await r.json();message=body?.error?.message||''}catch(e){}
  throw new Error(message||('Google Kalender: Fehler '+r.status));
}
// Kalenderabgleich V2.8.3: Vor einem neuen Google-Eintrag zunächst vorhandene
// Termine prüfen. Keine automatische Löschung und kein POST bei unklarer Zuordnung.
function tpCalendarNorm(v){
  return String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de-DE')
    .replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function tpCalendarIcsUid(x){
  const orgId=tpCalendarSettings().orgName.toLowerCase().replace(/[^a-z0-9]+/g,'')||'verein';
  return String(x.id)+'@'+orgId;
}
function tpCalendarGoogleDate(e){return String(e?.start?.date||e?.start?.dateTime||'').slice(0,10)}
function tpCalendarGoogleTime(e){return e?.start?.date?'':String(e?.start?.dateTime||'').slice(11,16)}
function tpCalendarMatch(x,e){
  const sameName=tpCalendarNorm(x.name)===tpCalendarNorm(e.summary);
  const sameDate=String(x.date||'')===tpCalendarGoogleDate(e);
  const sameTime=String(x.time||'')===tpCalendarGoogleTime(e);
  const sameUid=String(e.iCalUID||'')===tpCalendarIcsUid(x);
  return {sameName,sameDate,sameTime,sameUid,exact:sameName&&sameDate&&sameTime};
}
function tpCalendarEventLabel(e){
  return (e.summary||'(Ohne Titel)')+' · '+tpCalendarGoogleDate(e)
    +(tpCalendarGoogleTime(e)?' · '+tpCalendarGoogleTime(e)+' Uhr':' · ganztägig')
    +(e.location?' · '+e.location:'');
}
async function tpGoogleListNearby(x){
  const cfg=tpCalendarSettings();
  const tok=await tpGoogleToken();
  const day=new Date(String(x.date)+'T12:00:00Z');
  if(!Number.isFinite(day.getTime()))throw new Error('Ungültiges Veranstaltungsdatum');
  const min=new Date(day);min.setUTCDate(min.getUTCDate()-15);
  const max=new Date(day);max.setUTCDate(max.getUTCDate()+16);
  let page='',pages=0,all=[];
  // Zuerst die eindeutige ICS-UID prüfen: damit werden auch ältere importierte
  // Termine gefunden, deren Datum oder Titel nachträglich geändert wurde.
  const uidUrl=new URL('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(cfg.calendarId)+'/events');
  uidUrl.searchParams.set('iCalUID',tpCalendarIcsUid(x));
  const uidResponse=await fetch(uidUrl.toString(),{headers:{Authorization:'Bearer '+tok}});
  if(!uidResponse.ok)throw new Error('Google Kalender: ICS-UID-Abfrage fehlgeschlagen ('+uidResponse.status+')');
  const uidData=await uidResponse.json();
  all.push(...(uidData.items||[]).filter(e=>e&&e.id&&e.status!=='cancelled'));
  do{
    const url=new URL('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(cfg.calendarId)+'/events');
    url.searchParams.set('timeMin',min.toISOString());
    url.searchParams.set('timeMax',max.toISOString());
    url.searchParams.set('singleEvents','true');
    url.searchParams.set('maxResults','2500');
    if(page)url.searchParams.set('pageToken',page);
    const r=await fetch(url.toString(),{headers:{Authorization:'Bearer '+tok}});
    if(!r.ok){if(r.status===401)tpGToken=null;let m='';try{m=(await r.json()).error?.message||''}catch(e){}throw new Error(m||('Google Kalender: Fehler '+r.status))}
    const body=await r.json();
    all.push(...(body.items||[]).filter(e=>e&&e.id&&e.status!=='cancelled'));
    page=body.nextPageToken||'';
    if(++pages>=10&&page)throw new Error('Zu viele Google-Termine im Suchzeitraum. Abgleich aus Sicherheitsgründen abgebrochen.');
  }while(page);
  // Auch Termine mit inzwischen geändertem Datum finden, wenn der Titel gleich ist.
  const seen=new Set();
  return all.filter(e=>{
      const q=tpCalendarMatch(x,e);
      if(!(q.sameUid||q.sameName||q.sameDate)||seen.has(String(e.id)))return false;
      seen.add(String(e.id));return true;
    }).sort((a,b)=>{
      const m=e=>{const q=tpCalendarMatch(x,e);return (q.sameUid?1000:0)+(q.exact?100:0)+(q.sameName?10:0)+(q.sameDate?5:0)+(q.sameTime?1:0)};
      return m(b)-m(a);
    });
}
let tpCalendarReview=null;
function tpCalendarReviewClose(){
  document.getElementById('tpCalendarReviewOverlay')?.remove();
  tpCalendarReview=null;
}
function tpCalendarReviewRender(){
  const ctx=tpCalendarReview;if(!ctx)return;
  const x=tpFindEvent(ctx.id);if(!x){tpCalendarReviewClose();return;}
  document.getElementById('tpCalendarReviewOverlay')?.remove();
  const overlay=document.createElement('div');overlay.id='tpCalendarReviewOverlay';
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box';
  const panel=document.createElement('section');
  panel.style.cssText='width:min(780px,100%);max-height:90vh;overflow:auto;background:#211f22;color:#fff;border:2px solid #bd3636;border-radius:12px;padding:20px;box-sizing:border-box;font-size:15px;line-height:1.5';
  const title=document.createElement('h2');title.textContent='Google Kalender · Vorhandene Termine abgleichen';title.style.margin='0 0 10px';panel.appendChild(title);
  const info=document.createElement('p');info.textContent='Turnierplaner: '+x.name+' · '+x.date+(x.time?' · '+x.time+' Uhr':'');panel.appendChild(info);
  const status=document.createElement('p');status.style.cssText='padding:9px;border-radius:6px;background:#363038';
  status.textContent=x.googleEventId?'Verknüpfter Google-Eintrag: '+x.googleEventId:'Noch keine Google-Ereignis-ID gespeichert. Es wird NICHT automatisch ein neuer Termin angelegt.';
  panel.appendChild(status);
  const list=ctx.events.slice(0,80);
  if(ctx.events.length>80){const warn=document.createElement('p');warn.textContent='Mehr als 80 mögliche Termine gefunden. Es werden nur die ersten 80 angezeigt.';panel.appendChild(warn)}
  if(!list.length){const p=document.createElement('p');p.textContent='Im Zeitraum von 15 Tagen vor bis 16 Tagen nach dem Turnier wurde kein Termin mit gleichem Namen oder gleichem Datum gefunden. Bitte den Google Kalender auch außerhalb dieses Zeitraums prüfen.';panel.appendChild(p)}
  for(const e of list){
    const m=tpCalendarMatch(x,e);
    const linked=String(x.googleEventId||'')===String(e.id);
    const used=(data.tournamentPlanner||[]).some(y=>y&&String(y.id)!==String(x.id)&&String(y.googleEventId||'')===String(e.id));
    const box=document.createElement('div');box.style.cssText='padding:11px;margin:8px 0;border:1px solid #66575b;border-radius:7px;background:#2c292d';
    const name=document.createElement('div');name.textContent=(m.sameUid?'✓ Gleiche ursprüngliche ICS-ID · ':m.exact?'✓ Genaue Übereinstimmung · ':m.sameName?'Ähnlicher Termin · ':'Gleiches Datum · ')+tpCalendarEventLabel(e);
    name.style.cssText='font-weight:600;overflow-wrap:anywhere';box.appendChild(name);
    const btns=document.createElement('div');btns.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:8px';
    if(linked){const b=document.createElement('span');b.textContent='✓ Dieser Termin ist verknüpft';btns.appendChild(b)}
    else if(used){const b=document.createElement('span');b.textContent='Bereits einem anderen Turnier zugeordnet – gesperrt';btns.appendChild(b)}
    else {
      const b=document.createElement('button');b.type='button';b.textContent='Diesen Termin verknüpfen';
      b.onclick=()=>tpCalendarReviewLink(e.id);btns.appendChild(b);
      if(x.googleEventId&&m.exact){
        const del=document.createElement('button');del.type='button';del.textContent='Doppelten Eintrag löschen';
        del.style.cssText='background:#8c2222;color:white';del.onclick=()=>tpCalendarReviewDelete(e.id);btns.appendChild(del);
      }
    }
    box.appendChild(btns);panel.appendChild(box);
  }
  const foot=document.createElement('div');foot.style.cssText='display:flex;flex-wrap:wrap;gap:10px;margin-top:18px';
  if(!x.googleEventId){
    const create=document.createElement('button');create.type='button';create.textContent='Nach Prüfung neuen Termin erstellen';
    create.onclick=tpCalendarReviewCreate;foot.appendChild(create);
  }
  const close=document.createElement('button');close.type='button';close.textContent='Schließen (ohne Änderung)';close.onclick=tpCalendarReviewClose;foot.appendChild(close);
  panel.appendChild(foot);overlay.appendChild(panel);document.body.appendChild(overlay);
}
async function tpCalendarReviewOpen(id){
  if(isWhiteboardUser()){showToast('Kalenderabgleich nur für Administratoren.');return;}
  const x=tpFindEvent(id);if(!x||!x.date){showToast('Turnier oder Datum fehlt');return;}
  const sid=String(x.id);
  if(tpCalendarExportInFlight.has(sid))return;
  if(!tpCalendarSettings().clientId){showToast('Bitte zuerst die Google Client-ID in den Kalendereinstellungen hinterlegen.');return;}
  tpCalendarExportInFlight.add(sid);renderTournamentPlannerAdminList();
  try{
    const events=await tpGoogleListNearby(x);
    tpCalendarReview={id:sid,events,calendarId:tpCalendarSettings().calendarId};
    tpCalendarReviewRender();
  }catch(e){console.error('Google-Kalender-Abgleich:',e);showToast('Kalenderabgleich fehlgeschlagen: '+(e?.message||e),12000)}
  finally{tpCalendarExportInFlight.delete(sid);renderTournamentPlannerAdminList()}
}
async function tpCalendarReviewLink(googleId){
  const ctx=tpCalendarReview;if(!ctx)return;
  const x=tpFindEvent(ctx.id),e=ctx.events.find(v=>String(v.id)===String(googleId));
  if(!x||!e)return;
  if(ctx.calendarId!==tpCalendarSettings().calendarId){alert('Kalender-ID wurde während der Prüfung geändert. Bitte erneut prüfen.');return;}
  if((data.tournamentPlanner||[]).some(y=>y&&String(y.id)!==String(x.id)&&String(y.googleEventId||'')===String(googleId))){alert('Dieser Google-Termin ist bereits einem anderen Turnier zugeordnet.');return;}
  if(!confirm('Vorhandenen Google-Termin mit diesem Turnier verknüpfen?\n\n'+tpCalendarEventLabel(e)+'\n\nDer Google-Termin wird dabei nicht verändert.'))return;
  x.googleEventId=String(e.id);x.googleEventCalendarId=ctx.calendarId;tpGoogleMarkSynced(x,e.updated||'');
  x.calendarExported=true;x.calendarExportedBeforeChange=false;
  if(!save()){alert('Verknüpfung lokal nicht speicherbar. Bitte nicht erneut exportieren.');return;}
  const fb=await tpSyncEventToFirebase(x);
  renderTournamentPlannerAdminList();tpCalendarReviewRender();
  if(fb)showToast('Bestehender Google-Termin verknüpft. Kein neuer Eintrag erstellt.',8000);
  else alert('Google-Termin lokal verknüpft, aber Firebase-Speicherung fehlgeschlagen. Bitte vor weiteren Änderungen Firebase prüfen.');
}
async function tpCalendarReviewDelete(googleId){
  const ctx=tpCalendarReview;if(!ctx)return;
  const x=tpFindEvent(ctx.id),e=ctx.events.find(v=>String(v.id)===String(googleId));
  if(!x||!e||!x.googleEventId||String(x.googleEventId)===String(googleId))return;
  if(ctx.calendarId!==tpCalendarSettings().calendarId)return;
  if(!tpCalendarMatch(x,e).exact){alert('Nur exakt passende Duplikate können hier gelöscht werden.');return;}
  if((data.tournamentPlanner||[]).some(y=>y&&String(y.googleEventId||'')===String(googleId))){alert('Dieser Termin ist bereits verknüpft und darf hier nicht gelöscht werden.');return;}
  const confirmText=prompt('ACHTUNG: Dieser Eintrag wird endgültig aus dem Google Kalender gelöscht.\n\n'+tpCalendarEventLabel(e)+'\n\nZum Bestätigen LÖSCHEN eingeben:');
  if(confirmText!=='LÖSCHEN')return;
  if(!confirm('Diesen doppelten Google-Kalendereintrag wirklich löschen?'))return;
  try{
    const tok=await tpGoogleToken();
    const url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(ctx.calendarId)+'/events/'+encodeURIComponent(e.id);
    const r=await fetch(url,{method:'DELETE',headers:{Authorization:'Bearer '+tok}});
    if(!(r.ok||r.status===404||r.status===410))throw new Error('Google Kalender: Löschfehler '+r.status);
    ctx.events=ctx.events.filter(v=>String(v.id)!==String(googleId));
    tpCalendarReviewRender();showToast('Doppelter Google-Eintrag gelöscht.',7000);
  }catch(err){showToast('Nicht gelöscht: '+(err?.message||err),10000)}
}
async function tpCalendarReviewCreate(){
  const ctx=tpCalendarReview;if(!ctx)return;
  const x=tpFindEvent(ctx.id);if(!x||x.googleEventId)return;
  if(ctx.calendarId!==tpCalendarSettings().calendarId){alert('Kalender-ID geändert. Bitte erneut prüfen.');return;}
  const code=prompt('Nur wenn du im Google Kalender geprüft hast, dass der Termin nicht bereits existiert:\n\nZum Erstellen eines NEUEN Eintrags NEU eingeben:');
  if(code!=='NEU')return;
  const sid=String(x.id);
  if(tpCalendarExportInFlight.has(sid))return;
  tpCalendarExportInFlight.add(sid);
  try{
    const created=await tpGoogleInsert(x);
    x.googleEventId=created.id;x.googleEventCalendarId=created.calendarId;tpGoogleMarkSynced(x,created.updated);
    x.calendarExported=true;x.calendarExportedBeforeChange=false;
    if(!save())throw new Error('Google-Eintrag erstellt, aber lokale ID-Speicherung fehlgeschlagen. Bitte NICHT erneut exportieren.');
    const fb=await tpSyncEventToFirebase(x);
    tpCalendarReviewClose();renderTournamentPlannerAdminList();
    if(fb)showToast('Neuer Google-Termin erstellt und ID in Firebase gespeichert.',8000);
    else alert('Google-Eintrag erstellt, aber Firebase-Speicherung fehlgeschlagen. Bitte NICHT erneut exportieren.');
  }catch(e){console.error('Kalender neu erstellen:',e);alert(e?.message||String(e))}
  finally{tpCalendarExportInFlight.delete(sid);renderTournamentPlannerAdminList()}
}

const tpCalendarExportInFlight=new Set();
async function tpAddToCalendar(id){
  if(isWhiteboardUser()){showToast('Whiteboard: Kalenderexport nur für Administratoren.');return;}
  const x=tpFindEvent(id);
  if(!x){showToast('Veranstaltung nicht gefunden');return;}
  if(!x.date){showToast('Kein Datum hinterlegt');return;}
  const sid=String(x.id);
  if(tpCalendarExportInFlight.has(sid)){showToast('Kalenderübertragung läuft bereits. Bitte warten.');return;}
  const cfg=tpCalendarSettings();
  if(cfg.clientId){
    // Ohne verknüpfte ID niemals direkt POST: zuerst den Kalender abgleichen.
    if(!x.googleEventId){await tpCalendarReviewOpen(id);return;}
    // Exportiert ist ein Status, kein Grund, eine bestehende Google-ID zu blockieren.
    // Ohne Ereignis-ID ist ein erneutes POST möglicherweise ein Duplikat: erst klären.
    if(x.calendarExported&&!x.googleEventId){
      await tpCalendarReviewOpen(id);
      return;
    }
    if(!x.googleEventId&&x.calendarExportedBeforeChange){
      await tpCalendarReviewOpen(id);
      return;
    }
    tpCalendarExportInFlight.add(sid);
    renderTournamentPlannerAdminList();
    const isUpdate=!!x.googleEventId;
    try{
      if(isUpdate){
        const result=await tpGoogleUpdate(x);tpGoogleMarkSynced(x,result.updated);
      }else{
        const created=await tpGoogleInsert(x);
        // Die von Google bestätigte ID sofort sichern; bei Firebase-Ausfall
        // keinesfalls einen zweiten Termin erzeugen.
        x.googleEventId=created.id;
        x.googleEventCalendarId=created.calendarId;tpGoogleMarkSynced(x,created.updated);
      }
      x.calendarExported=true;
      x.calendarExportedBeforeChange=false;
      const locallySaved=save();
      renderTournamentPlannerAdminList();
      showToast(isUpdate?'Google Kalender: bestehender Termin erfolgreich aktualisiert.':'Google Kalender: neuer Termin erfolgreich erstellt.',7000);
      // Der API-Erfolg ist unabhängig von der nachfolgenden Firebase-Speicherung.
      if(!locallySaved){
        alert('Google Kalender wurde geändert, aber die lokale Speicherung ist fehlgeschlagen. Bitte keinen zweiten Export auslösen.');
        return;
      }
      const fbSaved=await tpSyncEventToFirebase(x);
      if(!fbSaved){
        showToast('Google Kalender erfolgreich, aber Firebase-Speicherung fehlgeschlagen. Bitte den Termin nicht neu anlegen.',10000);
      }
    }catch(e){
      console.error('Google-Kalender-Export:',e);
      showToast('Google Kalender: '+(e?.message||e),12000);
    }finally{
      tpCalendarExportInFlight.delete(sid);
      renderTournamentPlannerAdminList();
    }
    return;
  }
  if(x.calendarExportedBeforeChange&&!confirm('Ein früherer .ics-Import kann nicht automatisch aus einem externen Kalender gelöscht werden. Bitte den alten Kalendereintrag dort manuell entfernen. Trotzdem neue .ics-Datei herunterladen?'))return;
  const ics=tpBuildIcs(x);if(!ics){showToast('Kein Datum hinterlegt');return;}
  const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=(x.name||'Termin').replace(/[^a-z0-9äöüß _-]/gi,'_')+'.ics';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  x.calendarExported=true;x.calendarExportedBeforeChange=false;
  save();tpSyncEventToFirebase(x);renderTournamentPlannerAdminList();
  showToast('Kalendereintrag heruntergeladen');
}

function tpResetCalendarExport(id){if(isWhiteboardUser()){showToast('Whiteboard: nur Spielerauswahl und Gemeldet von sind bearbeitbar.');return;}
  const x=tpFindEvent(id);if(!x)return;
  if(x.googleEventId){showToast('Dieser Termin ist bereits mit Google verknüpft. Der Exportstatus darf nicht zurückgesetzt werden.');return;}
  if(!confirm('Exportstatus zurücksetzen? Nur fortfahren, wenn du den bestehenden Google-Eintrag geprüft hast.'))return;
  x.calendarExported=false;x.calendarExportedBeforeChange=false;
  save();
  tpSyncEventToFirebase(x);
  renderTournamentPlannerAdminList();
  showToast('Exportstatus zurückgesetzt – vor erneutem Export Google Kalender auf vorhandene Einträge prüfen');
}
function tpAdminFormHtml(){if(isWhiteboardUser()){showToast('Whiteboard: nur Spielerauswahl und Gemeldet von sind bearbeitbar.');return;}
  return '<div class="card"><input id="tpEditId" type="hidden">'
    +'<label>Veranstaltungsname</label><input id="tpName" type="text" placeholder="z. B. Turnier Hochwinkl" oninput="tpAutoDetectType()">'
    +'<div class="row"><div style="flex:1"><label>Datum (Pflichtfeld)</label><input id="tpDate" type="date"></div><div style="flex:1"><label>Uhrzeit (optional)</label><select id="tpTime">'+tpTimeOptionsHtml('')+'</select></div></div>'
    +'<div class="row"><div style="flex:1"><label>Veranstaltungsart (Pflichtfeld)</label><select id="tpType" onchange="this.dataset.manual=\'1\';tpUpdateFormPlayerState();tpUpdateTwOption()">'+tpTypeOptionsHtml('')+'</select></div><div style="flex:none;display:flex;align-items:flex-end"><button type="button" onclick="tpAddNewType()">+ Neue Art</button></div></div>'
    +'<div id="tpTwOption" style="display:none;margin:12px 0;padding:10px;border:1px solid #a94455;border-radius:8px"><label><input type="checkbox" id="tpAddToTw"> Zur Turnierwirtschaftlichkeit hinzufügen</label><small>Nur bei „Turnier als Ausrichter“. Vorhandene Finanzdaten bleiben erhalten.</small></div>'
    +'<label>Gemeldet von</label><select id="tpReportedBy" disabled>'+tpPlayerOptionsHtml('')+'</select>'
    +'<div class="tp-players" style="margin-top:6px">'+[0,1,2,3].map(i=>'<div><label>Spieler '+(i+1)+'</label><select id="tpPlayer'+i+'" disabled>'+tpPlayerOptionsHtml('')+'</select></div>').join('')+'</div>'
    +'<label>Veranstaltungsort</label><input id="tpLocation" type="text" list="tpLocationList" placeholder="z. B. Waldkirchen Eishalle"><datalist id="tpLocationList">'+tpLocationOptionsHtml()+'</datalist>'
    +'<div class="row" style="margin-top:14px"><button id="tpCancelBtn" style="display:none" onclick="tpCancelEdit()">Bearbeitung abbrechen</button></div>'
    +'<div class="row" style="margin-top:10px"><button class="primary" style="width:100%" onclick="this.disabled=true;Promise.resolve(saveAllTournamentPlannerChanges()).finally(()=>{this.disabled=false})">Veranstaltung speichern</button></div>'
    +'<div class="small" style="margin-top:8px">Neue Veranstaltungen werden beim Speichern automatisch mit Google Kalender synchronisiert (bei bestehender Google-Verbindung). Bereits vorhandene Termine werden vor dem Erstellen geprüft.</div>'
    +'<div id="firebaseTpInfo" class="small" style="margin-top:10px"></div>'
    +'</div>';
}
function tpUpdateTwOption(){const option=document.getElementById('tpTwOption'),sel=document.getElementById('tpType');if(!option)return;const allowed=tpCanonicalType(sel?.value||'')==='Turnier als Ausrichter';option.style.display=allowed?'block':'none';if(!allowed&&document.getElementById('tpAddToTw'))document.getElementById('tpAddToTw').checked=false;}
function tpCommitFormIfFilled(){if(isWhiteboardUser()){showToast('Whiteboard: nur Spielerauswahl und Gemeldet von sind bearbeitbar.');return;}
  const nameEl=document.getElementById('tpName');if(!nameEl)return;
  const name=(nameEl.value||'').trim();
  if(!name)return; // Formular leer – nichts zu übernehmen, einfach normal weiter speichern
  // Pflichtfelder: Datum und Veranstaltungsart
  const dateEl=document.getElementById('tpDate');
  const typeEl=document.getElementById('tpType');
  const missing=[];
  if(!(dateEl&&dateEl.value))missing.push('Datum');
  if(!(typeEl&&String(typeEl.value||'').trim()))missing.push('Veranstaltungsart');
  if(missing.length){
    const text='Pflichtfeld fehlt: '+missing.join(' und ');
    const i=document.getElementById('firebaseTpInfo');if(i)i.textContent=text;
    showToast(text,6000);
    (dateEl&&!dateEl.value?dateEl:typeEl).focus();
    return false;
  }
  const date=dateEl.value;
  const time=tpNormalizeTime(document.getElementById('tpTime')?.value||'');
  const type=tpCanonicalType(typeEl.value||'');
  const allowPeople=(type==='Turnier'||type==='Meisterschaft');
  const reportedBy=allowPeople?(document.getElementById('tpReportedBy').value||''):'';
  const players=allowPeople?[0,1,2,3].map(i=>document.getElementById('tpPlayer'+i).value||''):['','','',''];
  const location=(document.getElementById('tpLocation').value||'').trim();
  const editId=document.getElementById('tpEditId').value;
  const addToTw=type==='Turnier als Ausrichter'&&!!document.getElementById('tpAddToTw')?.checked;
  if(editId){
    const item=tpFindEvent(editId);
    if(item){
      const changed=item.name!==name||item.date!==date||item.time!==time||item.location!==location||item.type!==type||item.reportedBy!==reportedBy||JSON.stringify(item.players||[])!==JSON.stringify(players);
      if(changed&&item.calendarExported){
        const mode=item.googleEventId?'Google Kalender: Beim nächsten Export wird derselbe Kalendereintrag aktualisiert.':'Ohne gespeicherte Google-Ereignis-ID oder bei .ics-Import muss der alte Kalendereintrag gegebenenfalls manuell entfernt werden.';
        if(!confirm('Dieser Termin wurde bereits in einen Kalender exportiert.\n\n'+mode+'\n\nÄnderungen speichern und für die Kalender-Aktualisierung freigeben?'))return false;
        item.calendarExportedBeforeChange=true;
        item.calendarExported=false;
      }
      if(changed)item.updatedAt=new Date().toISOString();
      item.name=name;item.date=date;item.time=time;item.reportedBy=reportedBy;item.players=players;item.location=location;item.type=type;item.internal=(type==='Turnier intern');item.addToTurnierWirtschaftlichkeit=addToTw;
    }
  }else{
    data.tournamentPlanner.push({id:'tp_'+Date.now()+'_'+Math.random().toString(36).slice(2),name,date,time,reportedBy,players,location,type,internal:(type==='Turnier intern'),addToTurnierWirtschaftlichkeit:addToTw,updatedAt:new Date().toISOString()});
  }
  tpCancelEdit();
  renderTournamentPlannerAdminList();
  if(typeof renderTournamentPlannerAdminPreview==='function')renderTournamentPlannerAdminPreview();
  tpRenderStats();
  setTimeout(tpUpdateFormPlayerState,0);
}
let tpReturnToList=false,tpReturnScroll=0;
function tpReturnToEventList(){
  tpReturnToList=false;
  tpAdminSubSection('events');
  renderTournamentPlannerAdminList();
  const am=document.getElementById('adminMain');
  if(am)am.scrollTop=tpReturnScroll;
}
function tpEditEvent(id){if(isWhiteboardUser()){showToast('Whiteboard: nur Spielerauswahl und Gemeldet von sind bearbeitbar.');return;}
  const x=tpFindEvent(id);if(!x)return;
  const listEl=document.getElementById('tpSub-events');
  const amEl=document.getElementById('adminMain');
  if(listEl&&listEl.style.display!=='none'){tpReturnToList=true;tpReturnScroll=amEl?amEl.scrollTop:0}
  // Formular sichtbar machen: der Plan-Bereich ist beim Bearbeiten aus der Liste ausgeblendet.
  if(typeof tpAdminSubSection==='function')tpAdminSubSection('plan');
  const nameEl=document.getElementById('tpName');
  const dateEl=document.getElementById('tpDate');
  if(!nameEl||!dateEl){showToast('Bitte zuerst den Bereich „Termin- und Turnierplaner" öffnen',6000);return}
  document.getElementById('tpEditId').value=x.id;
  nameEl.value=x.name||'';
  dateEl.value=x.date||'';
  const timeSel=document.getElementById('tpTime');
  if(timeSel)timeSel.innerHTML=tpTimeOptionsHtml(x.time||'');
  const reportedEl=document.getElementById('tpReportedBy');
  if(reportedEl)reportedEl.value=x.reportedBy||'';
  [0,1,2,3].forEach(i=>{const el=document.getElementById('tpPlayer'+i);if(el)el.value=(x.players||[])[i]||''});
  const locEl=document.getElementById('tpLocation');if(locEl)locEl.value=x.location||'';
  const typeSel=document.getElementById('tpType');
  if(typeSel){
    const current=tpCanonicalType(x.type||'');
    const list=tpTypes();
    if(current&&!list.some(t=>tpCanonicalType(t).toLowerCase()===current.toLowerCase()))list.push(current);
    typeSel.innerHTML='<option value="">– keine –</option>'+list.map(t=>'<option value="'+esc(t)+'" '+(tpCanonicalType(t)===current?'selected':'')+'>'+esc(t)+'</option>').join('');
    typeSel.value=current;
    typeSel.dataset.manual='1';
  }
  const cancelBtn=document.getElementById('tpCancelBtn');if(cancelBtn)cancelBtn.style.display='inline-block';
  tpUpdateFormPlayerState();
  if(document.getElementById('tpAddToTw'))document.getElementById('tpAddToTw').checked=!!x.addToTurnierWirtschaftlichkeit;
  tpUpdateTwOption();
  const info=document.getElementById('firebaseTpInfo');
  if(info)info.textContent='Bearbeitung: '+String(x.name||'')+' – Änderungen mit „Veranstaltung speichern" übernehmen.';
  if(nameEl.scrollIntoView)nameEl.scrollIntoView({block:'center'});
  nameEl.focus();
}
function tpCancelEdit(){
  document.getElementById('tpEditId').value='';
  document.getElementById('tpName').value='';
  document.getElementById('tpDate').value='';
  const timeSelReset=document.getElementById('tpTime');if(timeSelReset)timeSelReset.innerHTML=tpTimeOptionsHtml('');
  document.getElementById('tpReportedBy').value='';
  [0,1,2,3].forEach(i=>{const el=document.getElementById('tpPlayer'+i);if(el)el.value=''});
  document.getElementById('tpLocation').value='';
  const typeSel=document.getElementById('tpType');if(typeSel){typeSel.innerHTML=tpTypeOptionsHtml('');typeSel.value='';typeSel.dataset.manual='';}
  document.getElementById('tpCancelBtn').style.display='none';
  const info=document.getElementById('firebaseTpInfo');if(info)info.textContent='';
  tpUpdateFormPlayerState();
}
async function tpDeleteEvent(id){if(isWhiteboardUser()){showToast('Whiteboard: nur Spielerauswahl und Gemeldet von sind bearbeitbar.');return;}
  const sid=String(id),event=tpFindEvent(sid);
  if(!event){showToast('Veranstaltung nicht gefunden');return}
  if(event.googleEventId){
    const yes=confirm('Diese Veranstaltung ist im Google Kalender veröffentlicht.\n\nSoll sie im Google Kalender UND im Turnier-/Terminplaner gelöscht werden?\n\nAbbrechen = nichts löschen.');
    if(!yes)return;
    try{await tpGoogleDelete(event)}catch(e){
      console.error('Google-Kalender-Löschen fehlgeschlagen:',e);
      showToast('Nicht gelöscht: Google Kalender: '+(e?.message||e),12000);
      return;
    }
  }else if(event.calendarExported||event.calendarExportedBeforeChange){
    if(!confirm('Für diesen älteren Kalenderexport ist keine Google-Ereignis-ID gespeichert.\n\nDer alte Eintrag kann nicht automatisch aus Google Kalender entfernt werden. Bitte dort manuell löschen.\n\nVeranstaltung trotzdem NUR im Turnierplaner löschen?'))return;
  }else if(!confirm('Veranstaltung wirklich löschen?'))return;
  data.tournamentPlanner=(data.tournamentPlanner||[]).filter(x=>x&&String(x.id)!==sid);
  if(!save()){showToast('Löschen fehlgeschlagen: lokales Speichern nicht möglich',6000);return}
  renderTournamentPlannerAdminList();
  tpRenderStats();
  tpRefreshHistoryIfOpen();
  if(document.getElementById('tournamentPlanner')?.classList.contains('active'))renderTournamentPlanner();
  if(firebaseReady&&firestoreDb){
    try{
      await fbTimeout(firestoreDb.collection('tournamentPlanner').doc(sid).delete(),60000,'Firebase');
      showToast(event.googleEventId?'Veranstaltung in Google Kalender und Turnierplaner gelöscht':'Veranstaltung gelöscht und gespeichert');
    }catch(e){
      console.error(e);
      showToast('Lokal gelöscht - Firebase: '+firebaseErrorText(e),8000);
    }
  }else{
    showToast(event.googleEventId?'In Google Kalender gelöscht; Turnierplaner lokal gespeichert':'Veranstaltung gelöscht und lokal gespeichert');
  }
}

function renderTournamentPlannerAdminList(){if(isWhiteboardUser()){showToast('Whiteboard: nur Spielerauswahl und Gemeldet von sind bearbeitbar.');return;}
  const el=document.getElementById('tpAdminList');if(!el)return;
  tpPopulatePeriodFilter('tpAdminPeriodFilter','upcoming');
  const filter=document.getElementById('tpAdminPeriodFilter')?.value||'upcoming';
  const items=tpFilterByPeriod(tpSortedEvents(),filter);
  if(!items.length){el.innerHTML='<div class="small">Keine Veranstaltungen in diesem Zeitraum.</div>';return}
  const today=todayStr();
  let curMonth='',html='';
  items.forEach(x=>{
    const mk=tpMonthKey(x.date);
    if(mk!==curMonth){curMonth=mk;html+='<h4 style="margin-top:14px">'+(x.date?monthLabel(mk):'Ohne Datum')+'</h4>'}
    const players=(x.players||[]).filter(Boolean).join(', ');
    const isPast=x.date&&x.date<today;
    html+='<div class="list-item"'+(isPast?' style="opacity:.45"':'')+'><div><b>'+esc(x.name)+'</b>'+(x.type?' <span class="tp-type-badge">'+esc(x.type)+'</span>':'')+'<div class="small">'+esc(tpFormatDate(x.date))+(x.time?' · '+esc(x.time)+' Uhr':'')+(x.location?' · '+esc(x.location):'')+'</div><div class="small">'+(x.reportedBy?'Gemeldet von '+esc(x.reportedBy)+' · ':'')+(players||'keine Spieler eingetragen')+'</div></div><div class="row"><button onclick="tpEditEvent('+jsArg(x.id)+')">Bearbeiten</button><button class="danger" onclick="tpDeleteEvent('+jsArg(x.id)+')">Löschen</button></div></div>';
  });
  el.innerHTML=html;
}
async function syncTournamentPlannerToFirebase(){if(isWhiteboardUser()){showToast('Whiteboard: nur Spielerauswahl und Gemeldet von sind bearbeitbar.');return;}
  if(!ecwRequireCentralSave('Turnierplaner speichern'))return {ok:false,error:'Firebase ist nicht verfügbar'};
  try{await ecwSafetyPreflight('tournamentPlanner',(data.tournamentPlanner||[]).filter(x=>x&&x.id).length,'Turnierplaner');}
  catch(e){const msg=e?.message||String(e);showToast(msg,8000);return {ok:false,error:msg}}
  const info=document.getElementById('firebaseTpInfo');
  if(info)info.textContent='Übertragung wird vorbereitet …';
  try{
    let count=0;
    for(const x of (data.tournamentPlanner||[])){
      if(!x||!x.id)continue;
      const payload={id:String(x.id),name:String(x.name||''),date:String(x.date||''),time:String(x.time||''),reportedBy:String(x.reportedBy||''),players:[0,1,2,3].map(i=>String((x.players||[])[i]||'')),location:String(x.location||''),type:String(x.type||''),internal:!!x.internal,calendarExported:!!x.calendarExported,googleEventId:String(x.googleEventId||''),googleEventCalendarId:String(x.googleEventCalendarId||''),calendarExportedBeforeChange:!!x.calendarExportedBeforeChange,googleEventUpdated:String(x.googleEventUpdated||''),googleSyncedFields:tpGoogleStoredFields(x.googleSyncedFields),updatedAt:String(x.updatedAt||new Date().toISOString())};
      await fbTimeout(firestoreDb.collection('tournamentPlanner').doc(String(x.id)).set(payload),60000,'Firebase');
      count++;
    }
    await removeFirebaseDocsNotInSet('tournamentPlanner', new Set((data.tournamentPlanner||[]).filter(x=>x&&x.id).map(x=>String(x.id))));
    const message=count+' Veranstaltung(en) zu Firebase übertragen.';
    if(info)info.textContent=message;
    return {ok:true,count,message};
  }catch(e){
    console.error(e);
    const error=firebaseErrorText(e);
    if(info)info.textContent='Fehler: '+error;
    return {ok:false,error};
  }
}
async function loadTournamentPlannerFromFirebase(forceServer=false){
  if(!firebaseReady||!firestoreDb||(!firebaseAuthUser&&!isPublicWhiteboardMode()))return false;
  try{
    let snap;
    if(forceServer){
      try{snap=await firestoreDb.collection('tournamentPlanner').get({source:'server'});}
      catch(serverErr){
        console.warn('Firebase Server-Abruf nicht möglich, Fallback:',serverErr);
        snap=await firestoreDb.collection('tournamentPlanner').get();
      }
    }else{
      snap=await firestoreDb.collection('tournamentPlanner').get();
    }
    const list=[];
    snap.forEach(doc=>{const x=doc.data()||{};list.push({
      id:String(x.id||doc.id),name:String(x.name||''),date:String(x.date||''),time:String(x.time||''),
      reportedBy:String(x.reportedBy||''),players:[0,1,2,3].map(i=>String((x.players||[])[i]||'')),
      location:String(x.location||''),type:String(x.type||''),internal:!!x.internal,
      calendarExported:!!x.calendarExported,googleEventId:String(x.googleEventId||''),googleEventCalendarId:String(x.googleEventCalendarId||''),calendarExportedBeforeChange:!!x.calendarExportedBeforeChange,googleEventUpdated:String(x.googleEventUpdated||''),googleSyncedFields:tpGoogleStoredFields(x.googleSyncedFields),updatedAt:String(x.updatedAt||'')
    })});
    // Firebase ist für die Whiteboard-Ansicht die führende Quelle – auch eine leere Liste wird übernommen.
    data.tournamentPlanner=list;
    save();
    return true;
  }catch(e){
    console.warn('Firebase Turnierplaner:',e);
    return false;
  }
}
async function tpRefreshFromFirebase(showMessage=true){
  const btn=document.getElementById('tpRefreshBtn');
  const status=document.getElementById('tpFirebaseStatus');
  const listEl=tpPlannerListEl();
  const keepListScrollTop=listEl?listEl.scrollTop:0;
  if(btn)btn.disabled=true;
  if(status)status.textContent='Turnierliste wird frisch aus Firebase geladen …';
  try{
    const ok=await loadTournamentPlannerFromFirebase(true);
    if(ok){
      renderTournamentPlanner();
      requestAnimationFrame(()=>{
        const list=tpPlannerListEl();
        if(list)list.scrollTop=keepListScrollTop;
      });
      if(status)status.textContent='✓ Turnierliste aktuell · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
      if(showMessage)showToast('Turnierliste aus Firebase aktualisiert ✓',3000);
      return true;
    }
    if(status)status.textContent='Turnierliste konnte nicht aus Firebase geladen werden.';
    if(showMessage)showToast('Firebase-Laden fehlgeschlagen',5000);
    return false;
  }finally{
    if(btn)btn.disabled=false;
  }
}
function tpSaveCalendarSettings(){if(isWhiteboardUser()){showToast('Whiteboard: nur Spielerauswahl und Gemeldet von sind bearbeitbar.');return;}
  if(!data.settings)data.settings={};
  const org=(document.getElementById('tpCalOrgName')?.value||'').trim()||'EC Wegscheid';
  const dur=Number(document.getElementById('tpCalDuration')?.value)||2;
  data.settings.tpCalendarOrgName=org;
  data.settings.tpCalendarDurationHours=dur;
  data.settings.tpGoogleCalendarId=(document.getElementById('tpCalGoogleId')?.value||'').trim();
  data.settings.tpGoogleClientId=(document.getElementById('tpCalGoogleClient')?.value||'').trim();
  if(tpGToken&&Date.now()>=tpGTokenExp)tpGToken=null;
  if(data.settings.tpGoogleClientId)tpLoadGis().catch(()=>{});
  save();
  showToast('Kalendereinstellungen gespeichert');
}
// V2.8.4: Neue Termine unmittelbar beim Speichern nach Google übertragen.
// Es wird niemals blind ein zweites Ereignis erzeugt: zunächst nach bereits
// vorhandenen Einträgen suchen. Bei Treffern ist eine manuelle Zuordnung nötig.
async function tpCalendarAutoAfterSave(item,isNew,authPromise){
  const info=document.getElementById('firebaseTpInfo');
  const setInfo=msg=>{if(info)info.textContent=msg;};
  const sid=String(item.id);
  if(tpCalendarExportInFlight.has(sid))return {ok:false,reason:'Kalenderübertragung läuft bereits'};
  tpCalendarExportInFlight.add(sid);
  renderTournamentPlannerAdminList();
  setInfo('✓ In Firebase gespeichert. Google Kalender: vorhandene Termine werden geprüft …');
  try{
    if(authPromise)await authPromise;
    if(isNew&&!item.googleEventId){
      const nearby=await tpGoogleListNearby(item);
      const possible=nearby.filter(e=>{
        const m=tpCalendarMatch(item,e);
        return m.sameUid||(m.sameName&&m.sameDate);
      });
      if(possible.length){
        const message='Termin in Firebase gespeichert. Im Google Kalender gibt es '+possible.length+' mögliche Übereinstimmung(en). Bitte die Verknüpfung in den Kalendereinstellungen prüfen. Es wurde KEIN neuer Google-Termin angelegt.';
        setInfo('⚠ '+message);showToast(message,14000);
        return {ok:false,reason:'possible-duplicate'};
      }
      setInfo('✓ Firebase gespeichert. Google Kalender: neuer Termin wird erstellt …');
      const created=await tpGoogleInsert(item);
      // Die Google-ID sofort lokal sichern. Selbst wenn Firebase danach ausfällt,
      // darf der Benutzer nicht versehentlich einen zweiten Termin erzeugen.
      item.googleEventId=created.id;
      item.googleEventCalendarId=created.calendarId;
      tpGoogleMarkSynced(item,created.updated);
    }else if(item.googleEventId){
      setInfo('✓ Firebase gespeichert. Google Kalender: bestehender Termin wird aktualisiert …');
      const googleResult=await tpGoogleUpdate(item);
      tpGoogleMarkSynced(item,googleResult.updated);
    }else return {ok:false,reason:'no-google-id'};
    item.calendarExported=true;
    item.calendarExportedBeforeChange=false;
    if(!save()){
      const message='Google-Termin erfolgreich übertragen, aber lokale Ereignis-ID konnte nicht gespeichert werden. Bitte KEINEN neuen Export starten!';
      setInfo('⚠ '+message);alert(message);return {ok:false,reason:'local-save'};
    }
    setInfo('✓ Google Kalender bestätigt. Speichere Google-Ereignis-ID in Firebase …');
    const saved=await tpSyncEventToFirebase(item);
    renderTournamentPlannerAdminList();
    if(!saved){
      const message='Google-Termin übertragen, aber Google-Ereignis-ID nicht in Firebase gespeichert. Bitte KEINEN zweiten Termin anlegen!';
      setInfo('⚠ '+message);alert(message);return {ok:false,reason:'firebase-id'};
    }
    const message=isNew?'✓ Veranstaltung und Google-Kalendereintrag erstellt und gespeichert.':'✓ Bestehender Google-Kalendereintrag aktualisiert und gespeichert.';
    setInfo(message);showToast(message,8000);
    return {ok:true};
  }catch(e){
    console.error('Automatische Google-Kalender-Synchronisierung:',e);
    const message='Veranstaltung in Firebase gespeichert, Google-Kalender jedoch nicht bestätigt: '+(e?.message||e)+'. Bitte die Google-Verbindung und den Kalenderstatus prüfen.';
    setInfo('⚠ '+message);showToast(message,14000);
    return {ok:false,reason:e?.message||String(e)};
  }finally{
    tpCalendarExportInFlight.delete(sid);
    renderTournamentPlannerAdminList();
  }
}

async function tpSyncTwEvent(item){
 if(!firestoreDb||!firebaseReady||item.type!=='Turnier als Ausrichter'||!item.addToTurnierWirtschaftlichkeit)return;
 const ref=firestoreDb.collection('turnierWirtschaftlichkeit').doc('state');
 await firestoreDb.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists)throw Error('Turnierwirtschaftlichkeit ist noch nicht zentral eingerichtet. Bitte zuerst dort die private Ersteinrichtung abschließen.');
  const raw=snap.data()||{};
  // Turnierwirtschaftlichkeit speichert unter data, nicht direkt unter events.
  const state=raw.data;
  if(!state||!state.events||!state.sponsors||!state.extra)throw Error('Unbekanntes Format der Turnierwirtschaftlichkeit – keine Änderung vorgenommen.');
  const year=String(item.date||'').slice(0,4);if(!/^20\d{2}$/.test(year))throw Error('Ungültiges Turnierdatum');
  const events=Object.fromEntries(Object.entries(state.events).map(([y,arr])=>[y,Array.isArray(arr)?arr.slice():[]]));
  let previous=null;
  for(const [y,arr] of Object.entries(events)){
   const ix=arr.findIndex(e=>e&&String(e.calendarPlannerId)===String(item.id));
   if(ix>=0){previous=arr.splice(ix,1)[0];break;}
  }
  const record={...(previous||{}),calendarPlannerId:item.id,title:item.name,date:item.date,type:'Turnier',expenses:previous?.expenses||[]};
  events[year]=events[year]||[];events[year].push(record);
  events[year].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  tx.update(ref,{data:{...state,events},revision:(Number(raw.revision)||0)+1,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:firebaseAuthUser?.uid||'calendar'});
 });
}
async function saveAllTournamentPlannerChanges(){if(isWhiteboardUser()){showToast('Whiteboard: nur Spielerauswahl und Gemeldet von sind bearbeitbar.');return;}
  if(!ecwRequireCentralSave('Turnierplaner speichern'))return {ok:false,error:'Firebase ist nicht verfügbar'};
  const editId=String(document.getElementById('tpEditId')?.value||'');
  const wasEditing=!!editId;
  const beforeIds=new Set((data.tournamentPlanner||[]).filter(x=>x&&x.id).map(x=>String(x.id)));
  if(tpCommitFormIfFilled()===false)return {ok:false,error:'Pflichtfeld fehlt'};
  const newItems=(data.tournamentPlanner||[]).filter(x=>x&&x.id&&!beforeIds.has(String(x.id)));
  const editedItem=editId?tpFindEvent(editId):null;
  // Beim normalen Formularspeichern nur das eine betroffene Dokument schreiben.
  // Die vollständige Synchronisierung ist für separate Massen-/Importvorgänge reserviert.
  const firebaseTarget=newItems[0]||editedItem||null;
  const calendarTarget=newItems[0]||((editedItem&&editedItem.googleEventId&&editedItem.calendarExportedBeforeChange)?editedItem:null);
  const calendarIsNew=!!newItems.length;
  // OAuth möglichst innerhalb der unmittelbaren Benutzeraktion anstoßen;
  // nach einem langen Firebase-Speichervorgang können Browser Popups sperren.
  const calendarAuth=calendarTarget&&tpCalendarSettings().clientId?tpGoogleToken():null;
  if(calendarAuth)calendarAuth.catch(()=>{}); // unhandled rejection bis zur Auswertung vermeiden
  if(!save()){const i=document.getElementById('firebaseTpInfo');if(i)i.textContent='Fehler: lokales Speichern fehlgeschlagen';return {ok:false,error:'Lokales Speichern fehlgeschlagen'}}
  if(wasEditing&&tpReturnToList)tpReturnToEventList();
  tpRenderStats();
  tpRefreshHistoryIfOpen();
  const info=document.getElementById('firebaseTpInfo');
  if(info)info.textContent=firebaseTarget?'Speichere Veranstaltung in Firebase …':'Turnierplaner wird in Firebase abgeglichen …';
  try{
    let fb=null;
    if(firebaseTarget){
      // Wichtig: KEIN ecwSafetyPreflight / KEINE erneute Speicherung aller
      // Veranstaltungen / KEIN Abgleich mit möglicher Massenlöschung.
      const singleOk=await tpSyncEventToFirebase(firebaseTarget);
      fb=singleOk?{ok:true,count:1}:{ok:false,error:'Firebase-Speicherung der Veranstaltung fehlgeschlagen'};
    }else if(firebaseReady&&firestoreDb){
      fb=await syncTournamentPlannerToFirebase();
    }
    renderTournamentPlannerAdminList();
    if(document.getElementById('tournamentPlanner')?.classList.contains('active'))renderTournamentPlanner();
    if(fb&&fb.ok&&firebaseTarget?.addToTurnierWirtschaftlichkeit){try{await tpSyncTwEvent(firebaseTarget)}catch(e){console.error('Turnierwirtschaftlichkeit:',e);showToast('Termin gespeichert, Wirtschaftlichkeit nicht übernommen: '+(e?.message||e),12000)}}
    if(fb&&!fb.ok){if(info)info.textContent='⚠ Lokal gespeichert, aber Firebase-Speicherung fehlgeschlagen.';showToast('Lokal gespeichert - aber Firebase: '+(fb.error||fb.message),8000);return {ok:false,error:fb.error||fb.message}}
    if(calendarTarget){
      if(!tpCalendarSettings().clientId){
        const message='Termin gespeichert, aber nicht in Google übertragen: Google Client-ID fehlt.';
        if(info)info.textContent='⚠ '+message;
        showToast(message,12000);
        return {ok:true,fb,calendarOk:false};
      }
      const calendarResult=await tpCalendarAutoAfterSave(calendarTarget,calendarIsNew,calendarAuth);
      if(!calendarResult.ok)return {ok:true,fb,calendarOk:false,calendarReason:calendarResult.reason};
      return {ok:true,fb,calendarOk:true};
    }
    if(info)info.textContent='✓ Veranstaltung in Firebase gespeichert.';
    showToast('Veranstaltung in Firebase gespeichert ✓');
    return {ok:true,fb};
  }catch(e){console.error(e);showToast('Speichern des Turnierplaners fehlgeschlagen: '+(e?.message||e),6000);return {ok:false,error:e?.message||String(e)}}
}

function tpImportNorm(s){return String(s||'').toLocaleLowerCase('de').replace(/\s+/g,' ').trim()}
function tpExcelDuplicateKey(x){return [String(x.date||''),tpImportNorm(x.name),String(x.time||'')].join('|')}

const TP_EXCEL_PERSON_NAME_MAP={};

function tpExcelNormalizePerson(name){
  const s=String(name||'').trim();
  return TP_EXCEL_PERSON_NAME_MAP[s]||s;
}
function tpExcelNormalizedPlayers(x){
  return [0,1,2,3].map(i=>tpExcelNormalizePerson((x.players||[])[i]||''));
}
const TP_EXCEL_TYPE_OPTIONS=['Turnier','Meisterschaft','Turnier intern','Turnier als Ausrichter','Gremlins','Sitzung','Feier'];
let tpExcelSelectedIds=new Set();
function tpExcelLoadTypeOverrides(){try{return JSON.parse(localStorage.getItem('ecw-tp-excel-type-overrides-v1')||'{}')||{}}catch{return {}}}
function tpExcelSaveTypeOverrides(map){localStorage.setItem('ecw-tp-excel-type-overrides-v1',JSON.stringify(map||{}))}
function tpExcelGetType(x){const map=tpExcelLoadTypeOverrides();return map[String(x.id)]||x.type||'Turnier'}
function tpExcelSetType(id,type){if(!TP_EXCEL_TYPE_OPTIONS.includes(type))return;const map=tpExcelLoadTypeOverrides();map[String(id)]=type;tpExcelSaveTypeOverrides(map);tpRenderExcelImportPreview()}
function tpExcelToggleSelected(id,checked){checked?tpExcelSelectedIds.add(String(id)):tpExcelSelectedIds.delete(String(id))}
function tpExcelVisibleRows(){const year=document.getElementById('tpExcelPreviewYear')?.value||'all',type=document.getElementById('tpExcelPreviewType')?.value||'all';return TP_EXCEL_IMPORT_2023_2025.filter(x=>(year==='all'||String(x.sourceYear)===year)&&(type==='all'||tpExcelGetType(x)===type))}
function tpExcelSelectVisible(on){for(const x of tpExcelVisibleRows())on?tpExcelSelectedIds.add(String(x.id)):tpExcelSelectedIds.delete(String(x.id));tpRenderExcelImportPreview()}
function tpExcelApplyBulkType(){const type=document.getElementById('tpExcelBulkType')?.value||'';if(!type){showToast('Bitte zuerst eine Veranstaltungsart auswählen.');return}if(!tpExcelSelectedIds.size){showToast('Bitte mindestens einen Termin markieren.');return}const map=tpExcelLoadTypeOverrides();let changed=0;for(const id of tpExcelSelectedIds){map[id]=type;changed++}tpExcelSaveTypeOverrides(map);tpExcelSelectedIds.clear();tpRenderExcelImportPreview();showToast(changed+' Termine auf „'+type+'“ geändert.')}
function tpExcelResetTypes(){if(!confirm('Alle manuellen Änderungen der Veranstaltungsart zurücksetzen?'))return;localStorage.removeItem('ecw-tp-excel-type-overrides-v1');tpExcelSelectedIds.clear();tpRenderExcelImportPreview();showToast('Automatische Zuordnung wiederhergestellt.')}
function tpExcelImportState(){
  const existing=(data.tournamentPlanner||[]).filter(Boolean),ids=new Set(existing.map(x=>String(x.id||''))),keys=new Set(existing.map(tpExcelDuplicateKey));
  const missing=[],duplicates=[];
  for(const x of TP_EXCEL_IMPORT_2023_2025){(ids.has(String(x.id))||keys.has(tpExcelDuplicateKey(x))?duplicates:missing).push(x)}
  return {existing,missing,duplicates};
}
function tpRenderExcelImportPreview(){
  const sum=document.getElementById('tpExcelImportSummary'),list=document.getElementById('tpExcelImportList');if(!sum||!list)return;
  const state=tpExcelImportState(),counts={2023:0,2024:0,2025:0};TP_EXCEL_IMPORT_2023_2025.forEach(x=>counts[x.sourceYear]=(counts[x.sourceYear]||0)+1);
  sum.innerHTML='<div class="tp-import-summary"><div class="tp-import-kpi"><b>'+TP_EXCEL_IMPORT_2023_2025.length+'</b>Termine gesamt</div><div class="tp-import-kpi"><b>'+counts[2023]+'</b>2023</div><div class="tp-import-kpi"><b>'+counts[2024]+'</b>2024</div><div class="tp-import-kpi"><b>'+counts[2025]+'</b>2025</div><div class="tp-import-kpi"><b>'+state.missing.length+'</b>noch zu importieren</div><div class="tp-import-kpi"><b>'+state.duplicates.length+'</b>bereits vorhanden</div><div class="tp-import-kpi"><b>127</b>Namenskorrekturen</div></div>';
  const typeSel=document.getElementById('tpExcelPreviewType');if(typeSel&&typeSel.options.length===1){TP_EXCEL_TYPE_OPTIONS.forEach(t=>typeSel.add(new Option(t,t)))}
  const year=document.getElementById('tpExcelPreviewYear')?.value||'all',type=typeSel?.value||'all',existingKeys=new Set(state.existing.map(tpExcelDuplicateKey)),existingIds=new Set(state.existing.map(x=>String(x.id||'')));
  const rows=TP_EXCEL_IMPORT_2023_2025.filter(x=>(year==='all'||String(x.sourceYear)===year)&&(type==='all'||tpExcelGetType(x)===type));
  list.innerHTML=rows.map(x=>{
    const exists=existingIds.has(String(x.id))||existingKeys.has(tpExcelDuplicateKey(x)),currentType=tpExcelGetType(x);
    const options=TP_EXCEL_TYPE_OPTIONS.map(t=>'<option value="'+esc(t)+'"'+(t===currentType?' selected':'')+'>'+esc(t)+'</option>').join('');
    return '<div class="tp-import-row" style="'+(exists?'opacity:.45':'')+'">'
      +'<div><input type="checkbox" '+(tpExcelSelectedIds.has(String(x.id))?'checked ':'')+'onchange="tpExcelToggleSelected(\''+esc(String(x.id))+'\',this.checked)"></div>'
      +'<div><b>'+esc(tpFormatDate(x.date))+'</b><br><small>'+esc(x.time||'ganztägig')+'</small></div>'
      +'<div><b>'+esc(x.name)+'</b><br><small>'+(exists?'bereits vorhanden':'wird importiert')+'</small><br><small><b>Gemeldet von:</b> '+esc(tpExcelNormalizePerson(x.reportedBy)||'–')+' · <b>Spieler:</b> '+esc(tpExcelNormalizedPlayers(x).map(p=>p||'–').join(' | '))+'</small>'+(tpExcelNormalizePerson(x.reportedBy)!==String(x.reportedBy||'').trim()||tpExcelNormalizedPlayers(x).some((p,i)=>p!==String((x.players||[])[i]||'').trim())?'<br><small style="opacity:.7">Schreibweise automatisch vereinheitlicht</small>':'')+'</div>'
      +'<div class="tp-import-loc">'+esc(x.location||'')+'</div>'
      +'<div class="tp-import-type"><select onchange="tpExcelSetType(\''+esc(String(x.id))+'\',this.value)">'+options+'</select></div>'
      +'</div>';
  }).join('')||'<div class="tp-empty">Keine Einträge für diesen Filter.</div>';

}
async function tpImportExcel2023to2025(){
  if(!tpRequirePlannerEdit())return;if(!ecwRequireCentralSave('Excel-Termine importieren'))return;
  const state=tpExcelImportState();if(!state.missing.length){showToast('Alle Excel-Termine sind bereits vorhanden.');tpRenderExcelImportPreview();return}
  if(!confirm(state.missing.length+' fehlende Termine aus 2023–2025 in den Turnierplaner und Firebase importieren? Bestehende Termine werden nicht überschrieben.'))return;
  const status=document.getElementById('tpExcelImportStatus');
  try{
    if(status)status.textContent='Import läuft … 0 / '+state.missing.length;let added=0,skipped=0;
    for(const src of state.missing){
      const x={id:String(src.id),name:String(src.name||''),date:String(src.date||''),time:String(src.time||''),reportedBy:tpExcelNormalizePerson(src.reportedBy),players:tpExcelNormalizedPlayers(src),location:String(src.location||''),type:String(tpExcelGetType(src)||''),internal:tpExcelGetType(src)==='Turnier intern',calendarExported:!!src.calendarExported,updatedAt:new Date().toISOString()};
      const ref=firestoreDb.collection('tournamentPlanner').doc(x.id),remote=await fbTimeout(ref.get(),30000,'Excel-Import prüfen');if(remote.exists){skipped++;continue}
      const keys=new Set((data.tournamentPlanner||[]).filter(Boolean).map(tpExcelDuplicateKey));if(keys.has(tpExcelDuplicateKey(x))){skipped++;continue}
      await fbTimeout(ref.set(x),60000,'Excel-Termin importieren');data.tournamentPlanner.push(x);added++;
      if(status&&(added+skipped)%10===0)status.textContent='Import läuft … '+(added+skipped)+' / '+state.missing.length;
    }
    save();await loadTournamentPlannerFromFirebase(true);renderTournamentPlannerAdminList();if(document.getElementById('tournamentPlanner')?.classList.contains('active'))renderTournamentPlanner();tpRenderStats();tpRefreshHistoryIfOpen();tpRenderExcelImportPreview();
    if(status)status.textContent='✓ Import abgeschlossen: '+added+' neu, '+skipped+' übersprungen.';showToast('Excel-Import abgeschlossen: '+added+' Termine übernommen.',6000);
  }catch(e){console.error('Excel-Turnierplan-Import:',e);if(status)status.textContent='Fehler: '+firebaseErrorText(e);showToast('Excel-Import fehlgeschlagen: '+firebaseErrorText(e),8000)}
}


function tpEvalTournamentOnly(x){
  return !!x && tpIsExternalTournament(x);
}
function tpEvalScopeFromValue(period){
  const today=todayStr();
  if(period==='past')return {label:'Vergangenheit – alle',filter:x=>{const d=tpEventDateStr(x);return !!d&&d<today}};
  if(period==='upcoming')return {label:'Zukunft',filter:x=>{const d=tpEventDateStr(x);return !!d&&d>=today}};
  if(period&&period.charAt(0)==='y'){
    const year=period.slice(1);
    return {label:year,filter:x=>tpEventYear(x)===year};
  }
  return {label:'Alle Termine',filter:x=>true};
}
function tpEvalPeriodOptionsHtml(){
  const currentYear=String(new Date().getFullYear());
  const years=tpExistingYears();
  const pastYears=years.filter(y=>y<currentYear).sort((a,b)=>b.localeCompare(a));
  const currentFutureYears=years.filter(y=>y>=currentYear).sort();
  let html='<option value="past">Vergangenheit – alle</option><option value="upcoming">Zukunft</option>';
  if(pastYears.length){
    html+='<optgroup label="Vergangenheit">';
    pastYears.forEach(y=>{html+='<option value="y'+y+'">'+y+'</option>'});
    html+='</optgroup>';
  }
  if(currentFutureYears.length){
    html+='<optgroup label="Aktuell / Zukunft">';
    currentFutureYears.forEach(y=>{html+='<option value="y'+y+'">'+y+'</option>'});
    html+='</optgroup>';
  }
  html+='<option value="all">Alle Jahre</option>';
  return html;
}
function tpEvalClubKey(x){
  return String((x&&x.name)||'').trim()||'Ohne Bezeichnung';
}
function tpEvalTournamentKey(x){
  return String(x.name||'').trim()||'Ohne Bezeichnung';
}


let tpEvalExcludedNames={};
let tpEvalExclusionsLoaded=false;
let tpEvalExclusionsDirty=false;

function tpEvalLoadLocalExclusions(){
  try{return JSON.parse(localStorage.getItem('ecw-tp-eval-exclusions-v1')||'{}')||{}}catch{return {}}
}
function tpEvalIsKreiscup(name){
  return /kreis[\s-]*cup/i.test(String(name||''));
}
function tpEvalIsExcluded(name){
  return !!tpEvalExcludedNames[tpEvalNameKey(name)];
}
async function tpLoadEvalExclusions(){
  if(tpEvalExclusionsLoaded)return;
  tpEvalExclusionsLoaded=true;

  const local=tpEvalLoadLocalExclusions();
  let remote={};
  if(firebaseReady&&firestoreDb&&(firebaseAuthUser||isPublicWhiteboardMode())){
    try{
      const snap=await firestoreDb.collection('appSettings').doc('turnierAuswertungAusschluesse').get();
      if(snap.exists)remote=((snap.data()||{}).names||{});
    }catch(e){console.warn('Auswertungsausschlüsse laden:',e);}
  }

  // Lokale Sicherung hat Vorrang, damit bereits bearbeitete Listen nach einem Update nicht verloren gehen.
  tpEvalExcludedNames={...remote,...local};
  const localJson=JSON.stringify(local||{});
  const remoteJson=JSON.stringify(remote||{});
  tpEvalExclusionsDirty=Object.keys(local||{}).length>0 && localJson!==remoteJson;

  if(tpEvalExclusionsDirty){
    const st=document.getElementById('tpEvalSaveStatus');
    if(st)st.textContent='Lokale Änderungen erkannt – bitte „Änderungen speichern“ drücken.';
  }
}
async function tpSaveEvalExclusions(){
  if(!isAdminNow()){showToast('Diese Funktion ist nur im Admin-Modus verfügbar.');return false;}
  const btn=document.getElementById('tpEvalSaveBtn');
  const status=document.getElementById('tpEvalSaveStatus');
  if(btn)btn.disabled=true;

  // ZUERST lokal sichern. Damit gehen Änderungen auch bei einem Firebase-Fehler nicht verloren.
  try{
    localStorage.setItem('ecw-tp-eval-exclusions-v1',JSON.stringify(tpEvalExcludedNames||{}));
    localStorage.setItem('ecw-tp-eval-name-aliases-v1',JSON.stringify(tpEvalNameAliases||{}));
  }catch(e){console.warn('Lokale Sicherung:',e);}

  if(status)status.textContent='Lokal gesichert · Firebase wird aktualisiert …';

  try{
    if(!(firebaseReady&&firestoreDb&&firebaseAuthUser))throw new Error('Firebase ist nicht verbunden.');

    await firestoreDb.collection('appSettings').doc('turnierAuswertungAusschluesse').set({
      names:tpEvalExcludedNames||{},
      updatedAt:new Date().toISOString(),
      updatedBy:firebaseAuthUser.email||firebaseAuthUser.uid||''
    },{merge:false});

    await firestoreDb.collection('appSettings').doc('turnierAuswertungNamen').set({
      aliases:tpEvalNameAliases||{},
      updatedAt:new Date().toISOString(),
      updatedBy:firebaseAuthUser.email||firebaseAuthUser.uid||''
    },{merge:false});

    tpEvalExclusionsDirty=false;
    if(status)status.textContent='Gespeichert ✓ lokal und in Firebase';
    showToast('Besuchte Turniere gespeichert.');
    tpUpdateEvaluationRights();
    return true;
  }catch(e){
    console.error('Besuchte Turniere speichern:',e);
    tpEvalExclusionsDirty=true;
    if(status)status.textContent='Lokal gesichert ✓ · Firebase-Speicherung fehlgeschlagen.';
    showToast('Lokal gesichert. Firebase konnte nicht aktualisiert werden: '+(e?.message||e),8000);
    tpUpdateEvaluationRights();
    return false;
  }finally{
    if(btn)btn.disabled=!tpEvalExclusionsDirty;
  }
}
async function tpExcludeEvaluationName(raw){
  if(!isAdminNow()){showToast('Diese Funktion ist nur im Admin-Modus verfügbar.');return;}
  if(!confirm('„'+raw+'“ nur aus der Turnier-Auswertung ausblenden? Der Termin bleibt im Termin-/Turnierplaner unverändert erhalten.'))return;
  tpEvalExcludedNames[tpEvalNameKey(raw)]=true;
  tpEvalExclusionsDirty=true;
  try{localStorage.setItem('ecw-tp-eval-exclusions-v1',JSON.stringify(tpEvalExcludedNames));}catch(e){}
  renderTpTournamentEvaluation();
  const st=document.getElementById('tpEvalSaveStatus');if(st)st.textContent='Lokal gesichert ✓ · noch nicht in Firebase gespeichert.';
  showToast('Ausgeblendet und lokal gesichert. Für alle Geräte bitte „Änderungen speichern“ drücken.');
}
async function tpRestoreExcludedEvaluationNames(){
  if(!isAdminNow()){showToast('Diese Funktion ist nur im Admin-Modus verfügbar.');return;}
  const count=Object.keys(tpEvalExcludedNames||{}).length;
  if(!count){showToast('Keine ausgeblendeten Namen vorhanden.');return}
  if(!confirm(count+' ausgeblendete Einträge wieder in der Turnier-Auswertung anzeigen?'))return;
  tpEvalExcludedNames={};
  tpEvalExclusionsDirty=true;
  try{localStorage.setItem('ecw-tp-eval-exclusions-v1',JSON.stringify(tpEvalExcludedNames));}catch(e){}
  renderTpTournamentEvaluation();
  const st=document.getElementById('tpEvalSaveStatus');if(st)st.textContent='Lokal gesichert ✓ · noch nicht in Firebase gespeichert.';
  showToast('Einträge wieder eingeblendet und lokal gesichert.');
}
let tpEvalNameAliases={};
let tpEvalAliasesLoaded=false;

function tpEvalNameKey(name){
  return String(name||'').toLocaleLowerCase('de').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
}
function tpEvalIsSimpleName(name){
  const n=String(name||'').trim();
  if(!n)return true;
  return n.split(/\s+/).length===1;
}

function tpEvalAutoClubName(raw){
  let n=String(raw||'').trim();
  if(!n)return 'Ohne Bezeichnung';

  n=n
    .replace(/\b(herren|damen|mixed|mix|senioren|jugend|u\d{2}|ü\d{2})?turnier\b/gi,' ')
    .replace(/\b(herren|damen|mixed|mix|senioren|jugend|u\d{2}|ü\d{2})\b/gi,' ')
    .replace(/\b(eis|stock)?turnier\b/gi,' ')
    .replace(/\b(cup|pokalturnier|freundschaftsturnier|einladungsturnier|nachtturnier|frühjahrsturnier|sommerturnier|herbstturnier|winterturnier)\b/gi,' ')
    .replace(/\b(duo|trio|solo|quattro)\b/gi,' ')
    .replace(/\b(ec|esv|ev|ssc|sc|fc|tsv|djk|sv|tc)\b/gi,' ')
    .replace(/\b(1\.|2\.|3\.|4\.)\b/gi,' ')
    .replace(/\b(in|bei|beim|vom|von|des|der)\b/gi,' ')
    .replace(/\s+/g,' ')
    .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g,' ')
    .trim();

  n=n
    .replace(/\s+(halle|eishalle|stocksporthalle|stockhalle)$/i,'')
    .replace(/^(halle|eishalle|stocksporthalle|stockhalle)\s+/i,'')
    .replace(/\s+/g,' ')
    .trim();

  return n||String(raw||'').trim()||'Ohne Bezeichnung';
}
function tpEvalDisplayName(raw){
  const key=tpEvalNameKey(raw);
  if(tpEvalNameAliases[key])return String(tpEvalNameAliases[key]).trim();
  return tpEvalAutoClubName(raw);
}
async function tpLoadNameAliases(){
  if(tpEvalAliasesLoaded)return;
  tpEvalAliasesLoaded=true;
  try{
    const local=JSON.parse(localStorage.getItem('ecw-tp-eval-name-aliases-v1')||'{}')||{};
    tpEvalNameAliases={...local};
  }catch{tpEvalNameAliases={};}
  if(firebaseReady&&firestoreDb&&(firebaseAuthUser||isPublicWhiteboardMode())){
    try{
      const snap=await firestoreDb.collection('appSettings').doc('turnierAuswertungNamen').get();
      if(snap.exists){
        const remote=snap.data()||{};
        tpEvalNameAliases={...tpEvalNameAliases,...(remote.aliases||{})};
        localStorage.setItem('ecw-tp-eval-name-aliases-v1',JSON.stringify(tpEvalNameAliases));
      }
    }catch(e){console.warn('Auswertungsnamen laden:',e);}
  }
}
async function tpEditEvaluationName(raw){
  if(!isAdminNow()){showToast('Diese Funktion ist nur im Admin-Modus verfügbar.');return;}
  const current=tpEvalDisplayName(raw);
  const input=prompt('Anzeigename nur für die Turnierauswertung:',current);
  if(input===null)return;
  const value=input.trim();
  if(!value)return;
  const key=tpEvalNameKey(raw);
  tpEvalNameAliases[key]=value;
  localStorage.setItem('ecw-tp-eval-name-aliases-v1',JSON.stringify(tpEvalNameAliases));
  tpEvalExclusionsDirty=true;
  const saveState=document.getElementById('tpEvalSaveStatus');if(saveState)saveState.textContent='Lokal gesichert ✓ · noch nicht vollständig in Firebase gespeichert.';
  if(firebaseReady&&firestoreDb&&firebaseAuthUser&&isAdminNow()){
    try{
      await firestoreDb.collection('appSettings').doc('turnierAuswertungNamen').set({
        aliases:tpEvalNameAliases,
        updatedAt:new Date().toISOString()
      },{merge:true});
      showToast('Anzeigename für die Turnierauswertung gespeichert.');
    }catch(e){
      console.error(e);
      showToast('Anzeigename lokal gespeichert. Firebase-Speicherung nicht möglich: '+firebaseErrorText(e),7000);
    }
  }else{
    showToast('Anzeigename für die Turnierauswertung lokal gespeichert.');
  }
  renderTpTournamentEvaluation();
}
async function tpDeleteEvaluationName(raw){
  if(!isAdminNow()){showToast('Diese Funktion ist nur im Admin-Modus verfügbar.');return;}
  const key=tpEvalNameKey(raw);
  if(!Object.prototype.hasOwnProperty.call(tpEvalNameAliases,key)){
    showToast('Für diese Bezeichnung gibt es keine manuelle Zuordnung.');
    return;
  }
  if(!confirm('Anzeigename für „'+raw+'“ löschen? Danach wird in der Turnierauswertung wieder der automatische Anzeigename verwendet.'))return;

  delete tpEvalNameAliases[key];
  localStorage.setItem('ecw-tp-eval-name-aliases-v1',JSON.stringify(tpEvalNameAliases));
  tpEvalExclusionsDirty=true;
  const saveState=document.getElementById('tpEvalSaveStatus');if(saveState)saveState.textContent='Lokal gesichert ✓ · noch nicht vollständig in Firebase gespeichert.';

  if(firebaseReady&&firestoreDb&&firebaseAuthUser&&isAdminNow()){
    try{
      await firestoreDb.collection('appSettings').doc('turnierAuswertungNamen').set({
        aliases:tpEvalNameAliases,
        updatedAt:new Date().toISOString()
      },{merge:false});
      showToast('Manuelle Zuordnung gelöscht.');
    }catch(e){
      console.error(e);
      showToast('Lokal gelöscht. Firebase-Speicherung nicht möglich: '+firebaseErrorText(e),7000);
    }
  }else{
    showToast('Manuelle Zuordnung lokal gelöscht.');
  }
  renderTpTournamentEvaluation();
}


// Lesezugriff für den Mannschaften-Gegenbesuchsvergleich der eingebetteten Turnierverwaltung.
// Jeder externe Turnierplaner-Eintrag entspricht einer Mannschaft; nur vergangene Termine.
window.ecwHistoryPlannerSnapshot=function(){
  const today=todayStr();
  return (data.tournamentPlanner||[]).filter(Boolean)
    .filter(x=>tpIsExternalTournament(x))
    .filter(x=>{const d=tpEventDateStr(x);return !!d&&d<today})
    .filter(x=>!tpEvalIsExcluded(String(x.name||'')))
    .map(x=>({date:tpEventDateStr(x),name:String(x.name||''),club:tpEvalDisplayName(String(x.name||''))}));
};

function tpTournamentEvaluationRows(){
  const period=document.getElementById('tpEvalPeriod')?.value||'past';
  const sort=document.getElementById('tpEvalSort')?.value||'count';
  const scope=tpEvalScopeFromValue(period);

  const items=(data.tournamentPlanner||[])
    .filter(Boolean)
    .filter(scope.filter)
    .filter(x=>tpCanonicalType(x.type)==='Turnier')
    .filter(x=>!tpEvalIsExcluded(String(x.name||'')));

  const groups=new Map();
  for(const x of items){
    const raw=String(x.name||'').trim()||'Ohne Bezeichnung';
    const display=tpEvalDisplayName(raw);
    const key=tpEvalNameKey(display);

    if(!groups.has(key))groups.set(key,{name:display,count:0,rawNames:new Map()});
    const g=groups.get(key);
    g.count++;
    g.rawNames.set(raw,(g.rawNames.get(raw)||0)+1);
  }

  let rows=[...groups.values()].map(g=>({
    name:g.name,
    count:g.count,
    rawNames:[...g.rawNames.entries()].map(([name,count])=>({name,count}))
  }));

  if(sort==='name')rows.sort((a,b)=>a.name.localeCompare(b.name,'de'));
  else rows.sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'de'));

  return {rows,scope,total:items.length};
}
async function openTpTournamentEvaluation(){
  const modal=document.getElementById('tpTournamentEvalModal');
  if(!modal)return;
  if(modal.parentElement!==document.body)document.body.appendChild(modal);
  const p=document.getElementById('tpEvalPeriod');
  if(p){
    p.innerHTML=tpEvalPeriodOptionsHtml();
    p.value='past';
  }
  modal.classList.remove('hidden');
  modal.classList.add('show');
  document.body.style.overflow='hidden';
  await tpLoadNameAliases();
  await tpLoadEvalExclusions();
  tpUpdateEvaluationRights();
  renderTpTournamentEvaluation();
}
function closeTpTournamentEvaluation(){
  if(isAdminNow()&&tpEvalExclusionsDirty){
    if(!confirm('Es gibt noch nicht gespeicherte Ausblendungen. Fenster trotzdem schließen?'))return;
  }
  const modal=document.getElementById('tpTournamentEvalModal');
  if(modal){modal.classList.remove('show');modal.classList.add('hidden');}
  document.body.style.overflow='';
}

function tpUpdateEvaluationRights(){
  const admin=isAdminNow();
  const restore=document.getElementById('tpEvalRestoreBtn');
  if(restore)restore.style.display=admin?'':'none';
  const save=document.getElementById('tpEvalSaveBtn');
  if(save){save.style.display=admin?'':'none';save.disabled=!admin||!tpEvalExclusionsDirty;}
  const saveStatus=document.getElementById('tpEvalSaveStatus');
  if(saveStatus)saveStatus.style.display=admin?'':'none';
  const originalHead=document.getElementById('tpEvalOriginalHead');
  if(originalHead)originalHead.style.display=admin?'':'none';
  const note=document.getElementById('tpEvalRightsNote');
  if(note)note.textContent=admin
    ?'Admin-Modus: Änderungen werden sofort lokal gesichert. Mit „Änderungen speichern“ zusätzlich zentral in Firebase sichern.'
    :'Ansicht: Zeitraum und Sortierung können gewählt werden.';
}
function renderTpTournamentEvaluation(){
  const body=document.getElementById('tpTournamentEvalBody');
  const summary=document.getElementById('tpTournamentEvalSummary');
  if(!body||!summary)return;

  tpUpdateEvaluationRights();
  const admin=isAdminNow();
  const result=tpTournamentEvaluationRows();
  document.getElementById('tpEvalHeadName').textContent='Verein / Anzeigename';

  const excludedCount=Object.keys(tpEvalExcludedNames||{}).length;
  summary.textContent=result.total+' Turnier-Einträge · '
    +result.rows.length+' Vereine / Anzeigenamen · '
    +result.scope.label
    +(admin&&excludedCount?' · '+excludedCount+' nur aus Auswertung ausgeblendet':'');

  body.innerHTML=result.rows.map((r,i)=>{
    if(!admin){
      return '<tr><td>'+(i+1)+'. <b>'+esc(r.name)+'</b></td><td style="display:none"></td><td><b>'+r.count+'×</b></td></tr>';
    }

    const variants=r.rawNames.map(v=>{
      const key=tpEvalNameKey(v.name);
      const manual=Object.prototype.hasOwnProperty.call(tpEvalNameAliases,key);
      const autoName=tpEvalAutoClubName(v.name);
      const controls=
        ' <button type="button" style="padding:3px 7px;margin-left:5px" onclick="tpEditEvaluationName('+jsArg(v.name)+')">Anzeigename ändern</button>'
        +(manual?' <button type="button" style="padding:3px 7px;margin-left:4px" onclick="tpDeleteEvaluationName('+jsArg(v.name)+')">Anzeigename löschen</button>':'')
        +' <button type="button" style="padding:3px 7px;margin-left:4px" onclick="tpExcludeEvaluationName('+jsArg(v.name)+')">Ausblenden</button>';

      return '<div style="margin:4px 0">'
        +esc(v.name)+(v.count>1?' <small>('+v.count+'×)</small>':'')
        +(autoName!==v.name?'<br><small style="opacity:.7">Anzeigename: '+esc(tpEvalDisplayName(v.name))+'</small>':'')
        +controls
        +'</div>';
    }).join('');

    return '<tr><td>'+(i+1)+'. <b>'+esc(r.name)+'</b></td><td>'+variants+'</td><td><b>'+r.count+'×</b></td></tr>';
  }).join('')||'<tr><td colspan="'+(admin?3:2)+'">Keine Turniere in diesem Zeitraum.</td></tr>';
}

/* ===== Ende Turnierplaner ===== */

function tpAdminSubSection(sub){if(isWhiteboardUser()){showToast('Whiteboard: nur Spielerauswahl und Gemeldet von sind bearbeitbar.');return;}
 ['plan','cal','players','events'].forEach(k=>{
  const el=document.getElementById('tpSub-'+k);
  if(el)el.style.display=(k===sub?'':'none');
  const b=document.getElementById('tpSubBtn-'+k);
  if(b)b.className=(k===sub?'primary':'');
 });
}

function renderAdminMenuLanding(){
 document.getElementById("admin")?.classList.remove("meeting-wide");
 document.getElementById("adminMain")?.classList.remove("meeting-mode");
  const a=document.getElementById('adminMain');
  if(!a)return;
  try{a.classList.remove('mv-mode')}catch(e){}
  a.innerHTML='<h2>Verwaltung</h2><div class="card"><h3>Bereich auswählen</h3><p class="small">Bitte links im Verwaltungsmenü den gewünschten Bereich auswählen.</p></div>';
}


async function pressRecoverOrphanedLocalMedia(){
  try{
    const all=await mediaAll();
    const used=new Set();
    Object.values(data.pressReports||{}).forEach(arr=>(arr||[]).forEach(x=>{
      if(!x)return;
      if(x.mediaId)used.add(x.mediaId);
      if(x.mediaId2)used.add(x.mediaId2);
    }));
    const orphan=all.filter(x=>String(x.id||'').startsWith('media_zr_')&&!used.has(x.id));
    if(!orphan.length){
      showToast('Keine zusätzlichen lokalen Zeitungsberichte zur Wiederherstellung gefunden.',5000);
      return;
    }
    if(!confirm(orphan.length+' lokal gespeicherte Zeitungsseite(n) wurden gefunden. Diese wieder in die Zeitungsberichte übernehmen?'))return;

    const folder=pressEnsureFolder();
    const arr=data.pressReports[folder]||(data.pressReports[folder]=[]);
    orphan.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    for(const row of orphan){
      const blob=row.blob;
      if(!blob)continue;
      const url=URL.createObjectURL(blob);
      mediaObjectUrls.push(url);
      arr.push({
        id:String(row.id).replace(/^media_zr_/,''),
        name:'Wiederhergestellter Zeitungsbericht',
        mediaId:row.id,
        data:url
      });
    }
    currentMonth=folder;
    save();
    renderTournamentAdminList();
    renderTournamentAdminPreview();
    showToast(orphan.length+' Zeitungsseite(n) lokal wiederhergestellt. Bitte prüfen und anschließend zentral speichern.',8000);
  }catch(e){
    console.error('Zeitungsberichte Wiederherstellung:',e);
    showToast('Wiederherstellung fehlgeschlagen: '+(e?.message||e),7000);
  }
}
function pressFolderOptions(selected=''){
 const folders=pressFolderList();
 if(!folders.length)return '<option value="">Bitte zuerst Ordner erstellen</option>';
 return folders.map(f=>'<option value="'+esc(f)+'" '+(f===selected?'selected':'')+'>'+esc(f)+'</option>').join('');
}
function pressRefreshAdminFolderSelects(selected=''){
 const folders=pressFolderList();
 const sel=selected||currentMonth||folders[0]||'';
 ['zrFolderSelect','tadminmonth'].forEach(id=>{
   const el=document.getElementById(id);if(!el)return;
   el.innerHTML=pressFolderOptions(sel);el.value=sel;
 });
 currentMonth=sel;
 renderTournamentAdminPreview();renderTournamentAdminList();
}
function pressCreateFolder(){
 const inp=document.getElementById('zrNewFolder'),name=String(inp?.value||'').trim();
 if(!name){showToast('Bitte einen Ordnernamen eingeben.');return;}
 pressEnsureFolder(name);currentMonth=name;if(inp)inp.value='';save();
 pressRefreshAdminFolderSelects(name);
 showToast('Ordner „'+name+'“ erstellt.');
}
async function pressDeleteSelectedFolder(){
 const folder=PRESS_REPORTS_GROUP;
 if(!folder)return;
 const arr=(data.pressReports&&data.pressReports[folder])||[];
 if(!confirm('Ordner „'+folder+'“ mit '+arr.filter(Boolean).length+' Bericht(en) löschen?'))return;
 for(const item of arr){
   if(!item)continue;
   try{if(item.mediaId)await mediaDelete(item.mediaId)}catch(e){}
   try{if(item.mediaId2)await mediaDelete(item.mediaId2)}catch(e){}
 }
 delete data.pressReports[folder];
 data.settings.pressReportFolders=pressFolderList().filter(x=>x!==folder);
 currentMonth=pressFolderList()[0]||'';
 save();pressRefreshAdminFolderSelects(currentMonth);
 showToast('Ordner gelöscht. Bitte „Zeitungsberichte speichern“ drücken, um Firebase zu aktualisieren.');
}
function renderTurnierWirtschaftlichkeitAdmin(){
  // Die Seite überprüft die Firebase-Anmeldung und Firestore-Berechtigung zusätzlich selbst.
  const a=document.getElementById('adminMain');
  if(!a)return;
  a.innerHTML='<div class="row" style="align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap">'
    +'<h2 style="margin:0">Turnierwirtschaftlichkeit und Helfer</h2>'
    +'<button type="button" onclick="renderAdminMenuLanding()">← Zurück zur Verwaltung</button></div>'
    +'<iframe id="twAdminFrame" title="Turnierwirtschaftlichkeit und Helfer EC Wegscheid" src="turnierwirtschaftlichkeit.html?v=2.9.54" '
    +'style="width:100%;height:calc(100vh - 185px);min-height:690px;border:1px solid rgba(255,255,255,.28);border-radius:12px;background:#16080b" '
    +'loading="eager" referrerpolicy="same-origin"></iframe>';
}

function adminSection(s){
 if(isWhiteboardUser()){showToast('Bearbeitungsverwaltung für Whiteboard gesperrt.');return;}
 if(s==='password'){openUserPassword();return;}
 const permKey=(s==='zr'?'t':s==='docs'||s==='ergebnisse'?'sh':s==='players'?'tp':s);
 const adminOnly=['u','backup','wb','solo','ic','sysconfig','reservadmin'];
 if((adminOnly.includes(s) && appPermissions.admin!==true) || (!adminOnly.includes(s) && !hasAppPermission(permKey))){showToast('Dieser Bereich ist für Sie nicht freigegeben.',4000);return;}
 window.__adminBack=null;
 try{unloadMvAdmin()}catch(e){}
 try{document.getElementById('adminMain').classList.remove('mv-mode')}catch(e){}
 if(s==='reservadmin'){ecwReservationAdmin();return}
 if(s==='players'){adminSection('tp');tpAdminSubSection('players');return}
 if(s==='docs'){ecwDocsAdmin();return}
 if(s==='ergebnisse'){ecwResults.admin();return}
 if(s==='sysconfig'){ECWConfig.open();return}
 if(s==='backup'){renderBackupAdmin();return}
 if(s==='u'){openUserRightsAdmin();return}
 if(s==='wb'){renderWhiteboardPermissionsAdmin();return}
 if(s==='solo'){openSoloPyramideAdmin();return}
 if(s==='ic'){renderInternalCupAdmin();return}
 if(s==='vs'){renderVersammlungenAdmin();return}
 if(s==='tw'){renderTurnierWirtschaftlichkeitAdmin();return}
 if(s==='mv'){renderMemberAdmin();return}
 if(s==='ov'){renderOverviewAdmin();return}
 if(s==='tv'){adminPreviewOpen('tv');return}
 if(s==='m'){renderTeamsAdmin();return}
 if(s==='lk'){renderLinksAdmin();return}
  if(s==='sh'){renderStartseiteAdmin();return}
 const a=document.getElementById('adminMain');
 if(s==='t'){
  tCollection='tournaments';
  const tmonths=existingMonths(); const selectedAdminMonth=tmonths.includes(currentMonth)?currentMonth:(tmonths[0]||monthKey());
  a.innerHTML='<h2>'+tCfg().label+'</h2><div class="card"><label>Monat</label><select id="tm">'+tournamentMonthOptions().map(m=>'<option value="'+m+'" '+(m===selectedAdminMonth?'selected':'')+'>'+monthLabel(m)+'</option>').join('')+'</select><label style="margin-top:10px">Einladungen hinzufügen (PDF, PNG, JPG oder BMP)</label><input id="tfiles" type="file" multiple accept="application/pdf,.pdf,.png,.bmp,.jpg,.jpeg,image/png,image/bmp,image/jpeg"><div id="firebaseTournamentInfo" class="small" style="margin-top:10px"></div><p class="small" style="margin-top:10px">Die ausgewählten Dateien werden automatisch im Programm und in Firebase gespeichert. PDF-Dateien werden automatisch seitenweise übernommen.</p></div><h3>Vorhandene Einladungen</h3><div class="card"><label>Monat auswählen</label><select id="tadminmonth">'+(tmonths.length?tmonths.map(m=>'<option value="'+m+'" '+(m===selectedAdminMonth?'selected':'')+'>'+monthLabel(m)+'</option>').join(''):'<option value="'+monthKey()+'">'+monthLabel(monthKey())+'</option>')+'</select><div id="tAdminPreview" class="admin-preview"></div><div id="tAdminList" style="margin-top:10px"></div></div><div class="card" style="margin-top:16px"><button class="primary" style="width:100%" onclick="saveTournamentFiles()">Speichern</button></div>';
  renderTournamentAdminList(); renderTournamentAdminPreview();
  document.getElementById('tm').onchange=()=>{currentMonth=document.getElementById('tm').value};
  document.getElementById('tadminmonth').onchange=()=>{currentMonth=document.getElementById('tadminmonth').value;currentPage=0;adminTournamentPage=0;renderTournamentAdminPreview();renderTournamentAdminList();};
 }else if(s==='zr'){
  tCollection='pressReports';
  normalizePressReportsFlat();
  currentMonth=PRESS_REPORTS_GROUP;
  const directUrl=getBaseUrl()+'#zeitungsberichte';
  a.innerHTML='<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px"><h2 style="margin:0">Zeitungsberichte EC Wegscheid</h2><button type="button" onclick="returnToAdminManagementView()">← Zurück zum Verwaltungsmenü</button></div>'
   +'<div class="card"><label>Direktlink</label><div class="row"><input type="text" readonly value="'+esc(directUrl)+'" onclick="this.select()" style="flex:1"><button type="button" onclick="navigator.clipboard?.writeText('+jsArg(directUrl)+');showToast(\'Link kopiert\')">Link kopieren</button></div></div>'
   +'<div class="card"><label>Zeitungsberichte hinzufügen (PDF, PNG, JPG oder BMP)</label><input id="zrfiles" type="file" multiple accept="application/pdf,.pdf,.png,.bmp,.jpg,.jpeg,image/png,image/bmp,image/jpeg">'
   +'<label class="checkbox-row" style="margin-top:12px"><input id="zrPairPages" type="checkbox"><span>Aktuellen Upload paarweise zusammenfassen (1+2, 3+4, …)</span></label>'
   +'<div class="small" style="margin-top:6px">Alle Berichte werden gemeinsam gespeichert. Standard: jede Seite einzeln. Wenn aktiviert, werden die Seiten dieses Uploads paarweise zusammengefasst: 1+2, 3+4 usw.</div>'
   +'<div class="row" style="margin-top:10px"><button type="button" onclick="pressRecoverOrphanedLocalMedia()">Lokale Berichte wiederherstellen</button></div>'
   +'<div id="firebasePressReportInfo" class="small" style="margin-top:10px"></div></div>'
   +'<h3>Vorhandene Zeitungsberichte</h3><div class="card"><div id="tAdminPreview" class="admin-preview"></div><div id="tAdminList" style="margin-top:10px"></div></div>'
   +'<div class="card" style="margin-top:16px"><button class="primary" style="width:100%" onclick="savePressReportFiles()">Zeitungsberichte speichern</button></div>';
  renderTournamentAdminList();renderTournamentAdminPreview();
 }else if(s==='o'){
  tCollection='ownTournaments';
  a.innerHTML='<h2>Eigene Turniereinladungen</h2><div class="card"><label>Einladungen hinzufügen (PDF, PNG, JPG oder BMP)</label><input id="ofiles" type="file" multiple accept="application/pdf,.pdf,.png,.bmp,.jpg,.jpeg,image/png,image/bmp,image/jpeg"><button class="primary" style="width:100%;margin-top:10px" onclick="saveOwnTournamentFiles()">Speichern</button><div id="firebaseOwnTournamentInfo" class="small" style="margin-top:10px"></div><p class="small" style="margin-top:10px">Es werden maximal 6 Einladungen gleichzeitig angezeigt – zuerst die mit dem nächsten Enddatum. PDF-Dateien werden automatisch seitenweise übernommen.</p></div><h3>Vorhandene Einladungen</h3><div id="oAdminList"></div>';
  renderOwnTournamentAdminList();
 }else if(s==='tp'){
  a.innerHTML='<h2>Termin- und Turnierplaner</h2>'
   +'<div class="tp-toolbar" style="margin:0 0 16px">'
    +'<button type="button" id="tpSubBtn-plan" onclick="tpAdminSubSection(\'plan\')">Termin- und Turnierplaner</button>'
    +'<button type="button" id="tpSubBtn-cal" onclick="tpAdminSubSection(\'cal\')">Kalendereinstellungen</button>'
    +'<button type="button" id="tpSubBtn-players" onclick="tpAdminSubSection(\'players\')">Spielerliste</button>'
    +'<button type="button" id="tpSubBtn-events" onclick="tpAdminSubSection(\'events\')">Vorhandene Veranstaltungen</button>'
   +'</div>'
   +'<div id="tpSub-plan">'+tpAdminFormHtml()+'</div>'
   +'<div id="tpSub-cal"><h3>Kalendereinstellungen</h3><div class="card"><label>Vereinsname (für Kalendereinträge)</label><input id="tpCalOrgName" type="text" value="'+esc((data.settings&&data.settings.tpCalendarOrgName)||'EC Wegscheid')+'" onchange="tpSaveCalendarSettings()"><label style="margin-top:8px">Standarddauer bei Veranstaltungen mit Uhrzeit (Stunden)</label><input id="tpCalDuration" type="number" min="1" max="24" value="'+esc(String((data.settings&&data.settings.tpCalendarDurationHours)||2))+'" onchange="tpSaveCalendarSettings()"><h4 style="margin-top:16px">Google Kalender</h4><label>Google Kalender-ID</label><input id="tpCalGoogleId" type="text" placeholder="primary oder abc123@group.calendar.google.com" value="'+esc((data.settings&&data.settings.tpGoogleCalendarId)||'')+'" onchange="tpSaveCalendarSettings()"><label style="margin-top:8px">Google Client-ID (OAuth, Web-Anwendung)</label><input id="tpCalGoogleClient" type="text" placeholder="1234567890-xxxx.apps.googleusercontent.com" value="'+esc((data.settings&&data.settings.tpGoogleClientId)||'')+'" onchange="tpSaveCalendarSettings()"><div class="row" style="margin-top:10px"><button type="button" onclick="tpSaveCalendarSettings();tpGoogleConnect()">Mit Google verbinden und abgleichen</button><button type="button" onclick="tpGooglePullLinkedChanges(true)">Jetzt abgleichen</button></div><div id="tpGooglePullStatus" class="small" style="margin-top:8px">Google → Programm: Änderungen werden beim Öffnen angezeigt und erst nach deiner Bestätigung übernommen. Nach Ablauf der Google-Anmeldung bitte erneut verbinden.</div><div id="tpGoogleConflictList"></div><div class="small" style="margin-top:8px">Ist eine Client-ID eingetragen, trägt 📅 Exportieren den Termin direkt in den Google Kalender ein (Kalender-ID leer = Hauptkalender). Ohne Client-ID wird wie bisher eine .ics-Datei heruntergeladen. Einrichtung: In der Google Cloud Console die „Google Calendar API“ aktivieren, eine OAuth-Client-ID (Typ Web) anlegen und die Adresse dieser Seite als „Autorisierten JavaScript-Ursprung“ eintragen.</div><div class="small" style="margin-top:8px">Neue Termine werden beim Speichern automatisch in Google Kalender angelegt, sofern die Verbindung eingerichtet ist und keine mögliche Dublette gefunden wird. Bei einer Änderung eines bereits verknüpften Termins wird derselbe Kalendereintrag aktualisiert. Der automatische Rückabgleich berücksichtigt ausschließlich eindeutig mit Google verknüpfte Termine. Unverknüpfte ältere Exporte werden nicht automatisch geändert. Bei Konflikten oder gelöschten Google-Terminen werden keine Daten stillschweigend überschrieben oder gelöscht.</div></div></div>'
   +'<div id="tpSub-players"><h3>Spielerliste (Auswahl für Turniere/Meisterschaften)</h3><div class="card"><div class="row"><input id="tpNewPlayer" type="text" placeholder="Name, z. B. Mustermann Max" style="flex:1" onkeydown="if(event.key===\'Enter\')tpAddPlayer()"><button type="button" onclick="tpAddPlayer()">Hinzufügen</button></div><div id="tpPlayersAdminList" style="margin-top:10px"></div></div></div>'
   +'<div id="tpSub-events"><h3>Vorhandene Veranstaltungen</h3><div class="tp-toolbar" style="margin:0 0 10px"><label style="margin:0">Zeitraum</label><select id="tpAdminPeriodFilter" onchange="renderTournamentPlannerAdminList()"></select></div><div id="tpAdminList"></div></div>';
  renderTpPlayersAdminList();
  renderTournamentPlannerAdminList();
  tpAdminSubSection('plan');
  Promise.resolve().then(()=>tpGooglePullLinkedChanges(false)).catch(e=>console.warn('Google-Abgleich:',e));
 }else if(s==='n'){
  a.innerHTML='<h2>Vereinsnachrichten</h2><div class="card"><input id="neditid" type="hidden"><label>Überschrift</label><input id="ntitle" type="text" placeholder="z. B. Vereinsmeisterschaft"><label style="margin-top:8px"><input id="nshowtitle" type="checkbox" style="width:auto;margin-right:8px"> Überschrift oben</label><label>Nachricht</label><textarea id="ntext" placeholder="Text der Nachricht..."></textarea><label>Anzeigeart</label><select id="nmode" onchange="updateNewsModeFields()"><option value="static">Feststehend</option><option value="fade">Ein-/Ausblenden</option><option value="ticker">Lauftext</option></select><div id="ndurWrap"><label>Anzeigedauer pro Nachricht (Sekunden)</label><input id="ndur" type="number" min="1" max="180" value="18"><div class="small">Bei „Lauftext“ bestimmt dieser Wert die Dauer eines kompletten Durchlaufs.</div></div><div id="ngapWrap"><label>Zeit zwischen den jeweiligen Texten (Sekunden)</label><input id="ngap" type="number" min="0" max="180" value="2"><div class="small">Diese Pause wird beim Wechsel zwischen mehreren Nachrichten verwendet.</div></div><div class="row"><div style="flex:1"><label>Startdatum</label><input id="nstart" type="date"></div><div style="flex:1"><label>Enddatum</label><input id="nend" type="date"></div></div><div class="small">Ohne Start- oder Enddatum ist die Nachricht zeitlich unbegrenzt aktiv.</div><div class="row" style="margin-top:14px"><button id="newsCancelBtn" style="display:none" onclick="cancelNewsEdit()">Bearbeitung abbrechen</button></div></div><h3>Gespeicherte Nachrichten</h3><p class="small">Nach Ablauf des Enddatums werden Nachrichten automatisch ausgeblendet. Sie bleiben zur Nachvollziehbarkeit gespeichert, bis du sie ausdrücklich löschst. „Löschen“ entfernt die Nachricht sofort aus Firebase.</p><div id="newsAdminList"></div><div class="card" style="margin-top:16px"><div id="firebaseNewsInfo" class="small" style="margin-bottom:10px"></div><button class="primary" style="width:100%" onclick="saveAllNewsChanges()">Speichern</button></div>';renderNewsAdminList();updateNewsModeFields();
 }else if(s==='s'){
  a.innerHTML='<h2>Speicher verwalten</h2>'+renderStorageAdminHtml();showStorageInfo();
 }else if(s==='u'){
  a.innerHTML='<h2>Anmeldung & Benutzerrechte</h2><div class="card"><p>Angemeldet als: <b>'+esc(firebaseAuthUser?.email||'')+'</b></p><p class="small">Eine einzige Firebase-Anmeldung gilt für die gesamte Verwaltung. Kennwörter werden ausschließlich von Firebase Authentication verwaltet.</p><button class="primary" onclick="sendOwnPasswordReset()">Eigenes Kennwort per E-Mail zurücksetzen</button></div><div class="card" style="margin-top:12px"><button class="primary" onclick="openUserRightsAdmin()" '+(appPermissions.admin?'':'disabled')+'>Benutzer & Rechte verwalten</button><div id="authInfo" class="small" style="margin-top:10px"></div></div>';

 }else if(s==='p'||s==='sp'){
  pCollection=(s==='sp')?'sponsorPhotos':'photos';
  a.innerHTML='<h2>'+pCfg().label+'</h2><div class="card"><label>Fotos hinzufügen</label><input id="pfiles" type="file" multiple accept=".png,.bmp,.jpg,.jpeg,.webp"><label>Ordner / Monat</label><input id="pmonth" type="month" value="'+monthKey()+'"><label>Ordnername</label><input id="palbum" type="text" placeholder="z. B. Sommerfest 2026"><label>Darstellung</label><select id="pmode"><option value="slideshow" selected>Diashow – Karussell</option><option value="static">Feststehend – Fotowand</option><option value="fade">Verschwinden / Erscheinen</option><option value="scroll">Durchlaufen</option></select><label>Wechselzeit (Sekunden)</label><input id="pdur" type="number" min="2" value="5"></div><p class="small">Ordner-Einstellungen oben auswählen und ändern, anschließend unten speichern. Die Fotoübersicht zeigt nur Bilder und die Ordner-Löschfunktion.</p><h3>Gespeicherte Foto-Ordner</h3><div id="photoAdminList"></div><div class="card" style="margin-top:16px"><div id="firebasePhotosInfo" class="small" style="margin-bottom:10px"></div><button class="primary" style="width:100%" onclick="saveAllPhotoChanges()">Speichern</button></div>';renderPhotoAdminList();updatePhotoAlbumForm();document.getElementById('pmonth').onchange=updatePhotoAlbumForm;
 }
}
async function getLocalPhotoDataUrl(item){
 if(item?.data&&String(item.data).startsWith('data:'))return item.data;
 if(item?.mediaId){const b=await mediaGet(item.mediaId);if(b)return await dataUrlFromBlob(b);}
 return '';
}
function firebasePhotoDocId(item,index){return 'photo_'+String(item?.month||'x').replace(/[^0-9-]/g,'_')+'_'+String(index)+'_'+String(item?.id||'x').replace(/[^a-zA-Z0-9_-]/g,'_');}
async function syncPhotosToFirebase(){
 if(!ecwRequireCentralSave(pCfg().label+' speichern'))return {ok:false,error:'Firebase ist nicht verfügbar'};
 const info=document.getElementById('firebasePhotosInfo');if(info)info.textContent='Übertragung wird vorbereitet …';
 try{
  let count=0,failed=0,albums=0;
  const desired=new Set();
  for(const month of Object.keys(pAlbums()).sort()){
   const a=pAlbums()[month]||{};
   const albumId='album_'+String(month).replace(/[^0-9-]/g,'_');
   await fbTimeout(firestoreDb.collection(pCfg().fb).doc(albumId).set({type:'album',month,name:String(a.name||''),mode:String(a.mode||'slideshow'),duration:Number(a.duration)||5,updatedAt:new Date().toISOString()}),60000,'Firebase');
   desired.add(albumId);albums++;
  }
  const arr=pItems();
  for(let i=0;i<arr.length;i++){
   const item=arr[i];if(!item)continue;
   const docId=firebasePhotoDocId(item,i);
   desired.add(docId);
   let dataUrl=await getLocalPhotoDataUrl(item);
   // Zu große Fotos wurden bisher einfach übersprungen – jetzt werden sie automatisch verkleinert.
   if(dataUrl&&dataUrl.length>FIREBASE_MAX_CHARS)dataUrl=await shrinkDataUrlForFirebase(dataUrl);
   if(!dataUrl||dataUrl.length>FIREBASE_MAX_CHARS){failed++;continue}
   if(info)info.textContent='Übertrage Foto '+(count+1)+' …';
   await fbTimeout(firestoreDb.collection(pCfg().fb).doc(docId).set({type:'photo',month:String(item.month||''),index:i,id:String(item.id||''),name:String(item.name||''),data:dataUrl,updatedAt:new Date().toISOString()}),90000,'Firebase');
   count++;
  }
  await removeFirebaseDocsNotInSet(pCfg().fb,desired);
  const message=count+' Foto(s) und '+albums+' Ordner zu Firebase übertragen'+(failed?' · '+failed+' Foto(s) ohne Datei/zu groß übersprungen':'')+'.';
  if(info)info.textContent=message;
  return {ok:failed===0,count,failed,message};
 }catch(e){
  console.error(e);
  const error=firebaseErrorText(e);
  if(info)info.textContent='Fehler: '+error;
  return {ok:false,error};
 }
}
async function loadPhotosFromFirebase(){
 if(!firebaseReady||!firestoreDb)return showToast('Firebase ist nicht verbunden');
 const info=document.getElementById('firebasePhotosInfo');if(info)info.textContent='Firebase-Fotos werden geladen …';
 try{
  const snap=await firestoreDb.collection(pCfg().fb).get();
  const photos=[],albums={};
  snap.forEach(doc=>{const x=doc.data()||{};if(x.type==='album'&&x.month){albums[x.month]={name:x.name||'',mode:x.mode||'slideshow',duration:Number(x.duration)||5};}else if(x.type==='photo'&&x.data&&x.month){photos.push({id:x.id||doc.id,month:x.month,name:x.name||'',data:x.data,order:Number.isFinite(x.index)?x.index:0});}});
  photos.sort(comparePhotos);
  data[pCfg().items]=photos;data[pCfg().albums]=albums;save();await hydrateMedia();
  photoAlbumMonth=null;renderPhotoAdminList();
  if(document.getElementById(pCfg().view).classList.contains('active'))initPhotos();
  const count=photos.length; if(info)info.textContent=count+' Foto(s) und '+Object.keys(albums).length+' Ordner aus Firebase geladen.';showToast(count+' Foto(s) aus Firebase geladen');
 }catch(e){console.error(e);if(info)info.textContent='Fehler: '+(e?.message||e);showToast('Firebase-Laden fehlgeschlagen: '+(e?.code||'Regeln prüfen'));}
}
function saveTournamentPerPage(){
 const value=Math.max(1,Math.min(30,Number(document.getElementById('tperpage').value)||12));
 data.settings.tournamentPerPage=value;
 if(save()){
   showToast('Einstellung gespeichert: '+value+' Dateien pro Seite');
   currentPage=0;adminTournamentPage=0;
   if(document.getElementById('tournaments').classList.contains('active')) renderTournaments();
 }
}
function renderTournamentAdminList(){
 const el=document.getElementById('tAdminList');if(!el)return;
 const m=tCollection==='pressReports'?PRESS_REPORTS_GROUP:(document.getElementById('tadminmonth')?.value||currentMonth);
 el.innerHTML='';
 if(!m){el.innerHTML='<div class="small">Kein Zeitraum ausgewählt.</div>';return;}
 const items=tStore()[m]||[],count=items.filter(Boolean).length;
 if(count){
   const h=document.createElement('h4');
   h.textContent=(tCollection==='pressReports'?'Zeitungsberichte':tGroupLabel(m))+' – '+count+' '+(tCollection==='pressReports'?'Bericht'+(count===1?'':'e'):'Einladung(en)');
   el.appendChild(h);
   items.forEach((x,i)=>{
     if(!x)return;
     const d=document.createElement('div');d.className='list-item';
     const pair=x.data2||x.mediaId2;
     const endControl=tCollection==='tournaments'
       ?'<label class="small" style="margin:0 6px 0 14px;white-space:nowrap">Anzeigen bis</label><input type="date" value="'+esc(x.endDate||'')+'" style="width:170px" onchange="setTournamentInvitationEndDate('+jsArg(m)+','+i+',this.value)">'
       :'';
     d.innerHTML='<span>'+esc(x.name)+(pair?' <b>· 2 Seiten</b>':'')+'</span><div class="row" style="gap:6px;align-items:center;justify-content:flex-end">'+endControl+'<button class="admin-crop-btn" onclick="cropOpenTournament('+jsArg(m)+','+i+')">✂ Zuschneiden</button><button class="danger" onclick="deleteTournament('+jsArg(m)+','+i+')">Löschen</button></div>';
     el.appendChild(d);
   });
 }else el.innerHTML='<div class="small">'+(tCollection==='pressReports'?'Noch keine Zeitungsberichte vorhanden.':'Für den ausgewählten Monat sind noch keine Einladungen vorhanden.')+'</div>';
}
function renderTournamentAdminPreview(){
 const el=document.getElementById('tAdminPreview'),m=tCollection==='pressReports'?PRESS_REPORTS_GROUP:(document.getElementById('tadminmonth')?.value||currentMonth);
 if(!el)return;
 if(!m){el.innerHTML='<div class="small">Kein Zeitraum ausgewählt.</div>';return;}
 const items=tStore()[m]||[],perPage=Math.max(1,Math.min(30,Number(data.settings.tournamentPerPage)||12)),totalPages=Math.max(1,Math.ceil(items.length/perPage));
 adminTournamentPage=Math.max(0,Math.min(adminTournamentPage,totalPages-1));
 const start=adminTournamentPage*perPage,cols=Math.ceil(perPage/2),rows=2;
 el.innerHTML='';
 const controls=document.createElement('div');controls.className='admin-preview-controls';
 controls.innerHTML='<button '+(adminTournamentPage<=0?'disabled':'')+' onclick="changeAdminTournamentPage(-1)">◀ Vorige Seite</button><div class="admin-preview-pageinfo">'+esc(tGroupLabel(m))+' · Präsentationsseite '+(adminTournamentPage+1)+' / '+totalPages+'</div><button '+(adminTournamentPage>=totalPages-1?'disabled':'')+' onclick="changeAdminTournamentPage(1)">Nächste Seite ▶</button>';
 el.appendChild(controls);
 const page=document.createElement('div');page.className='admin-tournament-page';
 page.style.gridTemplateColumns='repeat('+cols+',minmax(110px,1fr))';page.style.gridTemplateRows='repeat('+rows+',minmax(170px,auto))';
 for(let pos=0;pos<perPage;pos++){
   const absolute=start+pos,x=items[absolute],d=document.createElement('div');
   d.className='admin-tournament-slot'+(x?' filled':'')+(x&&(x.data2||x.mediaId2)?' press-pair':'');
   d.dataset.pos=String(absolute);
   let body='<div class="admin-tournament-placeholder">Freier Platz<br>'+(tCollection==='pressReports'?'Bericht':'Einladung')+' hierher ziehen</div>';
   if(x){
     body='<img src="'+x.data+'" alt="'+esc(x.name)+'">';
     if(x.data2)body+='<img src="'+x.data2+'" alt="'+esc(x.name2||x.name+' Seite 2')+'">';
     body+='<button class="danger admin-tournament-delete" onclick="event.stopPropagation();deleteTournament('+jsArg(m)+','+absolute+')">Löschen</button>';
   }
   d.innerHTML='<div class="admin-tournament-position">Platz '+(pos+1)+(x&&(x.data2||x.mediaId2)?' · 2 Seiten':'')+'</div>'+body;
   d.draggable=!!x;
   d.ondragstart=e=>{if(!x)return;e.dataTransfer.setData('text/plain',String(absolute));d.style.opacity='.5'};
   d.ondragend=()=>d.style.opacity='1';
   d.ondragover=e=>{e.preventDefault();d.classList.add('drag-over')};
   d.ondragleave=()=>d.classList.remove('drag-over');
   d.ondrop=e=>{e.preventDefault();d.classList.remove('drag-over');const from=Number(e.dataTransfer.getData('text/plain')),to=Number(d.dataset.pos);if(!Number.isFinite(from)||from===to)return;const arr=tStore()[m]||[];if(from<0||from>=arr.length||!arr[from])return;const moved=arr[from];arr[from]=null;if(to>=arr.length)arr.length=to+1;arr[to]=moved;while(arr.length&&arr[arr.length-1]==null)arr.pop();renderTournamentAdminPreview();renderTournamentAdminList();showToast('Reihenfolge geändert – bitte Speichern')};
   page.appendChild(d);
 }
 el.appendChild(page);
 const help=document.createElement('div');help.className='small admin-preview-help';
 help.textContent=tCollection==='pressReports'?'Ein Platzhalter kann eine oder zwei zusammengehörige Zeitungsseiten enthalten. Per Drag & Drop können die Berichte frei sortiert werden.':'Die Platzhalter entsprechen den Positionen der Präsentationsseite. Per Drag & Drop können Einladungen frei umsortiert werden.';
 el.appendChild(help);
}
function changeAdminTournamentPage(d){adminTournamentPage+=d;renderTournamentAdminPreview()}
function readFile(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
async function compressInvitationCanvas(sourceCanvas){
  const MAX_CHARS=780000;
  let scale=1,quality=.72,last='';
  for(let attempt=0;attempt<16;attempt++){
    const w=Math.max(1,Math.round(sourceCanvas.width*scale));
    const h=Math.max(1,Math.round(sourceCanvas.height*scale));
    const can=document.createElement('canvas');can.width=w;can.height=h;
    const ctx=can.getContext('2d');
    ctx.drawImage(sourceCanvas,0,0,w,h);
    last=can.toDataURL('image/jpeg',quality);
    if(last.length<=MAX_CHARS)return last;
    if(quality>.48)quality=Math.max(.48,quality-.05);
    else scale*=.82;
  }
  return last;
}
async function compressInvitationImage(img){
  const can=document.createElement('canvas');
  can.width=img.naturalWidth||img.width;can.height=img.naturalHeight||img.height;
  const ctx=can.getContext('2d');ctx.drawImage(img,0,0);
  return compressInvitationCanvas(can);
}
async function addTournamentImageFile(file,month){
 const raw=await readFile(file);
 let dataUrl=raw;
 if(file.type==='image/png'||file.type==='image/bmp'||file.type==='image/jpeg'||/\.(png|bmp|jpe?g)$/i.test(file.name)){
   const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=raw});
   const maxSide=1600,scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
   const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);dataUrl=c.toDataURL('image/jpeg',.78);
 }
 const id=Date.now()+'_'+Math.random();const stored=await storeMedia(tCfg().prefix,id,dataUrl);
 const st=tStore();const arr=st[month]||(st[month]=[]);let slot=arr.findIndex(v=>!v);if(slot<0)slot=arr.length;arr[slot]={id,name:file.name,mediaId:stored.id,data:stored.url};
 return {item:arr[slot],index:slot};
}
async function addTournamentPdfFile(file,month){
 if(!(await loadPdfJs()))throw new Error('PDF.js konnte nicht geladen werden');
 const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
 for(let n=1;n<=pdf.numPages;n++){
   const pg=await pdf.getPage(n),vp=pg.getViewport({scale:2}),can=document.createElement('canvas');can.width=Math.ceil(vp.width);can.height=Math.ceil(vp.height);
   await pg.render({canvasContext:can.getContext('2d'),viewport:vp}).promise;
   let dataUrl=can.toDataURL('image/jpeg',.8);
   const id=Date.now()+'_'+Math.random();const stored=await storeMedia(tCfg().prefix,id,dataUrl);
   const st=tStore();const arr=st[month]||(st[month]=[]);let slot=arr.findIndex(v=>!v);if(slot<0)slot=arr.length;arr[slot]={id,name:file.name+' – Seite '+n,mediaId:stored.id,data:stored.url};
 }
}

async function pressExtractPages(file){
 const out=[];
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
   if(!(await loadPdfJs()))throw new Error('PDF.js konnte nicht geladen werden');
   const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
   for(let n=1;n<=pdf.numPages;n++){
     const pg=await pdf.getPage(n),vp=pg.getViewport({scale:2}),can=document.createElement('canvas');
     can.width=Math.ceil(vp.width);can.height=Math.ceil(vp.height);
     await pg.render({canvasContext:can.getContext('2d'),viewport:vp}).promise;
     out.push({name:file.name+' – Seite '+n,dataUrl:await compressInvitationCanvas(can)});
   }
   return out;
 }
 if(/\.(png|bmp|jpe?g)$/i.test(file.name)||/^image\/(png|bmp|jpeg)$/i.test(file.type)){
   const raw=await readFile(file);
   const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=reject;x.src=raw});
   const maxSide=1600,scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
   const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);
   out.push({name:file.name,dataUrl:await compressInvitationCanvas(c)});
   return out;
 }
 throw new Error('Nur PDF, PNG, JPG oder BMP sind erlaubt');
}
async function pressStorePage(dataUrl,name){
 const id=Date.now()+'_'+Math.random().toString(36).slice(2),stored=await storeMedia('zr',id,dataUrl);
 return {id:String(id),name,mediaId:stored.id,data:stored.url};
}

async function pressEnsureFirebaseReady(timeoutMs=10000){
  const start=Date.now();
  while(Date.now()-start<timeoutMs){
    if(firebaseReady&&firestoreDb&&firebaseAuthUser&&!centralFirebaseOffline)return true;
    await new Promise(r=>setTimeout(r,250));
  }
  return !!(firebaseReady&&firestoreDb&&firebaseAuthUser&&!centralFirebaseOffline);
}
async function savePressReportFiles(){
 const folder=document.getElementById('zrFolderSelect')?.value||currentMonth;
 const files=[...(document.getElementById('zrfiles')?.files||[])];
 const pairCurrentUpload=!!document.getElementById('zrPairPages')?.checked;
 const info=document.getElementById('firebasePressReportInfo');
 const hasLocalReports=pressReportsLocalCount()>0;

 if(!files.length && !hasLocalReports){
   showToast('Noch keine Zeitungsberichte vorhanden.');
   return;
 }

 if(files.length){
   pressEnsureFolder();
   if(info)info.textContent='Zeitungsberichte werden vorbereitet …';
 }

 try{
   const pages=[];

   if(files.length){
     for(const file of files)pages.push(...await pressExtractPages(file));
     const arr=data.pressReports[folder]||(data.pressReports[folder]=[]);

     if(pairCurrentUpload){
       for(let i=0;i<pages.length;i+=2){
         const p1=pages[i],p2=pages[i+1]||null;
         const a=await pressStorePage(p1.dataUrl,p1.name);
         const item={id:a.id,name:a.name,mediaId:a.mediaId,data:a.data};
         if(p2){
           const b=await pressStorePage(p2.dataUrl,p2.name);
           item.name2=b.name;item.mediaId2=b.mediaId;item.data2=b.data;
         }
         let slot=arr.findIndex(v=>!v);if(slot<0)slot=arr.length;
         arr[slot]=item;
       }
     }else{
       for(const p of pages){
         const a=await pressStorePage(p.dataUrl,p.name);
         const item={id:a.id,name:a.name,mediaId:a.mediaId,data:a.data};
         let slot=arr.findIndex(v=>!v);if(slot<0)slot=arr.length;
         arr[slot]=item;
       }
     }

     if(!save())throw new Error('Lokales Speichern fehlgeschlagen');
     currentMonth=folder;currentPage=0;adminTournamentPage=0;
     await hydrateMedia();renderTournamentAdminPreview();renderTournamentAdminList();

     const pairBox=document.getElementById('zrPairPages');
     if(pairBox)pairBox.checked=false;
   }

   if(info)info.textContent=files.length
     ? 'Lokal gespeichert. Firebase-Anmeldung wird geprüft …'
     : 'Vorhandene Zeitungsberichte werden mit Firebase abgeglichen …';

   const ready=await pressEnsureFirebaseReady(12000);
   if(!ready){
     if(info)info.textContent='Lokal vorhanden ✓ · Firebase/Anmeldung nicht verfügbar.';
     showToast('Zeitungsberichte sind lokal vorhanden, konnten aber noch nicht zentral gespeichert werden. Bitte Firebase-Anmeldung prüfen und erneut „Zeitungsberichte speichern“ drücken.',9000);
     return;
   }

   if(info)info.textContent='Firebase wird aktualisiert …';
   const fb=await syncTournamentsToFirebase();
   const inp=document.getElementById('zrfiles');if(inp)inp.value='';

   if(fb.ok){
     try{
       const verify=await firestoreDb.collection('pressReports').get({source:'server'}).catch(()=>firestoreDb.collection('pressReports').get());
       const remote=pressReportsSnapshotData(verify);
       const localCount=pressReportsLocalCount();
       if(remote.count<localCount){
         throw new Error('Firebase-Prüfung: zentral sind nur '+remote.count+' von '+localCount+' Berichten vorhanden.');
       }
     }catch(verifyErr){
       console.error('Zeitungsberichte Firebase-Prüfung:',verifyErr);
       if(info)info.textContent='Lokal vorhanden ✓ · Firebase-Prüfung fehlgeschlagen: '+(verifyErr?.message||verifyErr);
       showToast('Zeitungsberichte lokal vorhanden. Zentrale Firebase-Prüfung ist fehlgeschlagen.',9000);
       return;
     }

     if(info)info.textContent='Firebase aktuell ✓ · '+fb.message;
     if(files.length){
       const pairText=pairCurrentUpload?' · paarweise zusammengefasst':' · einzeln gespeichert';
       showToast(pages.length+' Seite(n) gespeichert'+pairText+' · zentral in Firebase gespeichert');
     }else{
       showToast('Vorhandene Zeitungsberichte wurden zentral mit Firebase synchronisiert.');
     }
   }else{
     if(info)info.textContent='Lokal vorhanden ✓ · Firebase-Fehler: '+(fb.error||fb.message||'unbekannt');
     showToast('Zeitungsberichte lokal vorhanden, Firebase fehlgeschlagen: '+(fb.error||fb.message||''),9000);
   }
 }catch(e){
   console.error(e);
   if(info)info.textContent='Fehler: '+(e?.message||e);
   showToast('Speichern fehlgeschlagen: '+(e?.message||e),7000);
 }
}
async function saveTournamentFiles(){
 const month=document.getElementById('tm')?.value||document.getElementById('tadminmonth')?.value||monthKey();
 const files=[...(document.getElementById(tFileInputId())?.files||[])];
 const info=document.getElementById(tInfoElId());
 if(info)info.textContent='Einladungen werden gespeichert …';
 let added=0,failed=0,firstError='';
 try{
   for(const file of files){
     try{
       if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)) await addTournamentPdfFile(file,month);
       else if(/\.(png|bmp|jpe?g)$/i.test(file.name)||/^image\/(png|bmp|jpeg)$/i.test(file.type)) await addTournamentImageFile(file,month);
       else throw new Error('Nur PDF, PNG, JPG oder BMP sind erlaubt');
       added++;
     }catch(e){failed++;if(!firstError)firstError=file.name+': '+(e?.message||e);console.error('Datei:',file.name,e)}
   }
   if(!save()){if(info)info.textContent='Fehler: lokales Speichern fehlgeschlagen';return}
   await hydrateMedia();
   currentMonth=month;currentPage=0;adminTournamentPage=0;
   renderTournamentAdminPreview();renderTournamentAdminList();
   if(document.getElementById('tournaments')?.classList.contains('active'))renderTournaments();
   let fb=null;
   if(firebaseReady&&firestoreDb){
     if(info)info.textContent='Programm gespeichert. Firebase wird aktualisiert …';
     fb=await syncTournamentsToFirebase();
   }
   const tfin=document.getElementById(tFileInputId());if(tfin)tfin.value='';
   const parts=[];
   if(added)parts.push(added+' neue Datei(en) hinzugefügt');
   if(failed)parts.push(failed+' Datei(en) fehlgeschlagen ('+firstError+')');
   if(fb&&!fb.ok)showToast('Lokal gespeichert – aber Firebase: '+(fb.error||fb.message)+(parts.length?' · '+parts.join(' · '):''),8000);
   else showToast('Einladungen gespeichert'+(fb?' und Firebase aktualisiert':' (nur lokal – Firebase nicht verbunden)')+(parts.length?' · '+parts.join(' · '):''),failed?8000:3500);
 }catch(e){
   console.error(e);
   if(info)info.textContent='Fehler: '+(e?.message||e);
   showToast('Speichern fehlgeschlagen: '+(e?.message||e),6000);
 }
}
async function deleteTournament(m,i){
 const st=tStore();const arr=st[m]||[];
 const item=arr[i];
 if(!item)return;
 if(!confirm((tCollection==='pressReports'?'Zeitungsbericht':'Einladung')+' wirklich löschen?'))return;
 try{if(item.mediaId)await mediaDelete(item.mediaId);if(item.mediaId2)await mediaDelete(item.mediaId2)}catch(e){console.error('Medienlöschung:',e)}
 arr.splice(i,1);
 if(!arr.filter(Boolean).length)delete st[m];
 else st[m]=arr;
 save();
 currentMonth=m;
 adminTournamentPage=Math.max(0,adminTournamentPage);
 renderTournamentAdminList();renderTournamentAdminPreview();
 if(document.getElementById('tournaments')?.classList.contains('active'))renderTournaments();
 showToast((tCollection==='pressReports'?'Zeitungsbericht':'Einladung')+' gelöscht. Bitte jetzt unten auf „Speichern“ drücken.');
}
function resizeImage(file,maxSide=1600,quality=.82){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight,scale=Math.min(1,maxSide/Math.max(w,h));w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',quality))};img.onerror=reject;img.src=r.result};r.onerror=reject;r.readAsDataURL(file)})}
function updatePhotoAlbumForm(){const m=document.getElementById('pmonth')?.value;if(!m)return;const a=pAlbums()[m]||{};document.getElementById('palbum').value=a.name||'';document.getElementById('pmode').value=a.mode||'slideshow';document.getElementById('pdur').value=a.duration||5}
async function addPhotos(){
 const month=document.getElementById('pmonth')?.value||monthKey(),files=[...(document.getElementById('pfiles')?.files||[])];
 if(!files.length){showToast('Bitte mindestens ein Foto auswählen');return {added:0,failed:0}}
 const albumName=document.getElementById('palbum')?.value.trim()||monthLabel(month);
 pAlbums()[month]={name:albumName,mode:document.getElementById('pmode')?.value||'slideshow',duration:Number(document.getElementById('pdur')?.value)||5};
 let added=0,failed=0;
 for(const f of files){
   try{
     const img=await resizeImage(f);
     const id=String(Date.now())+'_'+Math.random().toString(36).slice(2);
     const stored=await storeMedia(pCfg().prefix,id,img);
     pItems().push({id,month,name:f.name,mediaId:stored.id,data:stored.url});
     added++;
   }catch(e){failed++;console.error('Foto:',f.name,e)}
 }
 renderPhotoAdminList();
 const inp=document.getElementById('pfiles');if(inp)inp.value='';
 return {added,failed};
}
function renderPhotoAdminList(){const el=document.getElementById('photoAdminList');if(!el)return;el.innerHTML='';const months=[...new Set(pItems().map(p=>p.month))].sort().reverse();if(!months.length){el.innerHTML='<div class="small">Keine Fotos verfügbar. Falls die Bilder noch im alten Firebase-Projekt liegen, müssen sie vom Administrator in das neue Projekt übertragen werden.</div>';return}months.forEach(m=>{const a=pAlbums()[m]||{};const box=document.createElement('div');box.className='card';box.style.marginBottom='12px';const count=pItems().filter(p=>p.month===m).length;box.innerHTML='<div class="row" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px"><div><b>'+esc(a.name||monthLabel(m))+'</b><div class="small">'+monthLabel(m)+' · '+count+' Foto(s)</div></div><div class="row" style="gap:6px;flex-wrap:wrap"><button type="button" onclick="savePhotoAlbumSettings('+jsArg(m)+')">Ordner bearbeiten</button><button type="button" class="danger" onclick="deletePhotoAlbum('+jsArg(m)+')">Ordner löschen</button></div></div><div class="thumb-grid"></div>';el.appendChild(box);
  const grid=box.querySelector('.thumb-grid');
  if(grid)pItems().filter(p=>p&&p.month===m).forEach(p=>{
    const t=document.createElement('div');t.className='thumb';
    const img=document.createElement('img');img.src=p.data||'';img.alt=p.name||'';
    const b=document.createElement('button');b.type='button';b.className='danger';b.title='Foto löschen';b.textContent='✕';
    b.onclick=()=>deletePhoto(p);
    t.appendChild(img);t.appendChild(b);grid.appendChild(t);
  });
 })}
function deletePhoto(p){
 if(!p||!confirm('Dieses Foto wirklich löschen?'))return;
 const items=pItems();
 const i=items.indexOf(p);if(i<0)return;
 const month=p.month;
 if(p.mediaId)pendingMediaDeletes.push(p.mediaId);
 items.splice(i,1);
 if(!items.some(x=>x&&x.month===month))delete pAlbums()[month];
 renderPhotoAdminList();
 showToast('Foto gelöscht – bitte unten Speichern');
}
function savePhotoAlbumSettings(m){
 // Ordner-Einstellungen werden ausschließlich im oberen Bearbeitungsformular gepflegt.
 const select=document.getElementById('pmonth');if(select)select.value=m;
 updatePhotoAlbumForm();
 document.getElementById('palbum')?.focus();
}
function deletePhotoAlbum(m){if(!confirm('Den gesamten Foto-Ordner inklusive Fotos löschen?'))return;pItems().forEach(p=>{if(p&&p.month===m&&p.mediaId)pendingMediaDeletes.push(p.mediaId)});data[pCfg().items]=pItems().filter(p=>p.month!==m);delete pAlbums()[m];renderPhotoAdminList();if(document.getElementById('pmonth')?.value===m)updatePhotoAlbumForm();showToast('Foto-Ordner zum Löschen vorgemerkt – bitte unten Speichern')}
function collectPhotoAlbumSettings(){
 // Das obere Formular gilt nur für den dort ausgewählten Ordner; keine doppelten Eingabefelder.
 const m=document.getElementById('pmonth')?.value;
 if(!m||!pItems().some(p=>p&&p.month===m))return;
 pAlbums()[m]={
  name:document.getElementById('palbum')?.value.trim()||monthLabel(m),
  mode:document.getElementById('pmode')?.value||'slideshow',
  duration:Math.max(2,Number(document.getElementById('pdur')?.value)||5)
 };
}
async function saveAllPhotoChanges(){
 const info=document.getElementById('firebasePhotosInfo');
 collectPhotoAlbumSettings();
 let added=0,failedPhotos=0;
 // Neu ausgewählte Fotos wurden bisher nie übernommen: addPhotos() wurde nirgends aufgerufen.
 if((document.getElementById('pfiles')?.files?.length||0)>0){
   if(info)info.textContent='Fotos werden verarbeitet …';
   try{const r=await addPhotos();added=r.added;failedPhotos=r.failed}
   catch(e){console.error(e);showToast('Fotos konnten nicht verarbeitet werden: '+(e?.message||e),6000);return}
 }
 if(!save()){if(info)info.textContent='Fehler: lokales Speichern fehlgeschlagen';return}
 for(const id of pendingMediaDeletes.splice(0)){try{await mediaDelete(id)}catch(e){console.error('Medienlöschung:',e)}}
 if(info)info.textContent='Fotos und Ordner werden in Programm und Firebase gespeichert …';
 let fb=null;
 if(firebaseReady&&firestoreDb)fb=await syncPhotosToFirebase();
 if(document.getElementById(pCfg().view)?.classList.contains('active')){try{await hydrateMedia();initPhotos()}catch(e){}}
 const parts=[];
 if(added)parts.push(added+' Foto(s) hinzugefügt');
 if(failedPhotos)parts.push(failedPhotos+' Foto(s) konnten nicht gelesen werden');
 if(fb&&!fb.ok)showToast('Lokal gespeichert – aber Firebase: '+(fb.error||fb.message)+(parts.length?' · '+parts.join(' · '):''),8000);
 else showToast('Fotos gespeichert'+(fb?' und Firebase aktualisiert':' (nur lokal – Firebase nicht verbunden)')+(parts.length?' · '+parts.join(' · '):''),failedPhotos?8000:3500);
}
function tpEnsureSinglePhotoNav(){
  ['photoNav','sponsorPhotoNav'].forEach(id=>{
    const els=document.querySelectorAll('#'+id);
    if(els.length>1){for(let i=1;i<els.length;i++)els[i].remove();}
  });
}

const photoLoadTasks={};
function readPhotoSource(item){
 const source=item.data||item.imageUrl||item.url||item.src||'';
 return typeof source==='string'&&/^(data:image\/|blob:|https?:\/\/)/i.test(source)?source:'';
}
async function loadPhotoPresentation(kind){
 if(photoLoadTasks[kind])return photoLoadTasks[kind];
 const cfg=P_COLLECTIONS[kind];if(!cfg||!canViewApp(kind==='sponsorPhotos'?'sp':'p'))return;
 const task=(async()=>{
  if(firebaseReady&&firestoreDb&&(firebaseAuthUser||isPublicWhiteboardMode())){
   try{
    const snap=await firestoreDb.collection(cfg.fb).get();
    const images=[],albums={};
    snap.forEach(doc=>{const item=doc.data()||{};const source=readPhotoSource(item);
     if(item.type==='album'&&item.month)albums[item.month]={name:item.name||'',mode:item.mode||'slideshow',duration:Number(item.duration)||5};
     else if(source){const month=String(item.month||'all');images.push({id:item.id||doc.id,month,name:item.name||'',data:source,order:Number.isFinite(item.index)?item.index:0});}
    });
    if(images.length){images.sort(comparePhotos);data[cfg.items]=images;data[cfg.albums]=albums;}
    else if(!data[cfg.items]?.length){data[cfg.albums]=albums;}
   }catch(e){console.error('Fotoansicht '+kind+':',e);showToast('Fotos konnten nicht geladen werden: '+firebaseErrorText(e),6000);}
  }
  await hydrateMedia();
  if(document.getElementById(cfg.view)?.classList.contains('active')){pCollection=kind;photoAlbumMonth=null;initPhotos();}
 })();
 photoLoadTasks[kind]=task;
 try{await task;}finally{if(photoLoadTasks[kind]===task)delete photoLoadTasks[kind];}
}

function initPhotos(){clearInterval(photoTimer);if(photoScrollTimer)clearInterval(photoScrollTimer);const ms=[...new Set(pItems().map(p=>p.month))].sort();photoAlbumMonth=photoAlbumMonth&&ms.includes(photoAlbumMonth)?photoAlbumMonth:(ms[0]||null);tpEnsureSinglePhotoNav();renderPhotos()}
function renderPhotos(){
 clearInterval(photoTimer);if(photoScrollTimer)cancelAnimationFrame(photoScrollTimer);photoScrollTimer=null;
 const c=document.getElementById(pCfg().contentEl),photos=pItems().filter(p=>p.month===photoAlbumMonth&&readPhotoSource(p)),ms=[...new Set(pItems().map(p=>p.month))].sort();
 const a=pAlbums()[photoAlbumMonth]||{};const mode=(a.mode||'static').toLowerCase();
 document.getElementById(pCfg().monthEl).textContent=photoAlbumMonth?(a.name||(photoAlbumMonth==='all'?'Fotos':monthLabel(photoAlbumMonth))):'Keine Fotos vorhanden';
 if(!photos.length){c.innerHTML='<div class="empty">Keine Fotos verfügbar. Falls die Bilder noch im alten Firebase-Projekt liegen, müssen sie vom Administrator in das neue Projekt übertragen werden.</div>';document.getElementById(pCfg().prevBtn).style.display='none';document.getElementById(pCfg().nextBtn).style.display='none';return}
 const idx=ms.indexOf(photoAlbumMonth);document.getElementById(pCfg().prevBtn).style.display=idx>0?'inline-block':'none';document.getElementById(pCfg().nextBtn).style.display=idx>=0&&idx<ms.length-1?'inline-block':'none';
 const dur=Math.max(2,Number(a.duration)||5)*1000;
 if(mode==='fade'||mode==='slideshow'){
   c.className='photo-stage photo-carousel';
   let i=0;
   const n=photos.length;
   c.innerHTML='<div class="photo-carousel-track"><div class="photo-carousel-item side left"><img></div><div class="photo-carousel-item center"><img></div><div class="photo-carousel-item side right"><img></div><div class="photo-carousel-item incoming"><img></div></div>';
   const items=[...c.querySelectorAll('.photo-carousel-item')];
   const setImg=(el,p)=>{el.querySelector('img').src=p.data;el.querySelector('img').alt=esc(p.name)};
   const paint=()=>{setImg(items[0],photos[(i-1+n)%n]);setImg(items[1],photos[i%n]);setImg(items[2],photos[(i+1)%n]);setImg(items[3],photos[(i+2)%n])};
   paint();
   if(n>1){
     // Echtes 4-Element-Karussell: Die Elemente wechseln ihre Rollen.
     // Dadurch läuft die Bewegung nach jedem Intervall weiter und stoppt nicht
     // nach den ersten beiden Bildern.
     let leftEl=items[0], centerEl=items[1], rightEl=items[2], spareEl=items[3];
     const advance=()=>{
       const next=(i+1)%n;
       const nextRight=(i+2)%n;
       const nextSpare=(i+3)%n;
       const oldLeft=leftEl;
       const oldCenter=centerEl;
       const oldRight=rightEl;
       const oldSpare=spareEl;

       // Vorwärtsbewegung: links raus, Mitte nach links, rechts in die Mitte,
       // vorbereitetes Bild von rechts in die Anzeige.
       oldLeft.className='photo-carousel-item leaving';
       oldCenter.className='photo-carousel-item side left';
       oldRight.className='photo-carousel-item center';
       oldSpare.className='photo-carousel-item side right';
       setImg(oldSpare,photos[nextRight]);
       i=next;

       // Das ausgeschiedene Element wird unsichtbar rechts für den nächsten
       // Umlauf vorbereitet. Ein erzwungener Reflow verhindert sichtbare Sprünge.
       setTimeout(()=>{
         oldLeft.className='photo-carousel-item incoming';
         setImg(oldLeft,photos[nextSpare]);
         void oldLeft.offsetWidth;
       },850);

       leftEl=oldCenter;
       centerEl=oldRight;
       rightEl=oldSpare;
       spareEl=oldLeft;
     };
     photoTimer=setInterval(advance,dur);
   }
 }else if(mode==='scroll'){
   c.className='photo-stage';
   c.innerHTML='<div class="photo-scroll"><div class="photo-scroll-track">'+photos.map(p=>'<img src="'+p.data+'" alt="'+esc(p.name)+'">').join('')+'</div></div>';
   const track=c.querySelector('.photo-scroll-track');let x=c.clientWidth, last=performance.now();const speed=Math.max(25,90000/dur);
   const step=now=>{const dt=Math.min(50,now-last);last=now;x-=speed*dt/1000;const width=track.scrollWidth;if(x<-width)x=c.clientWidth;track.style.transform='translateX('+x+'px)';photoScrollTimer=requestAnimationFrame(step)};photoScrollTimer=requestAnimationFrame(step);
 }else{
   c.className='content';c.innerHTML='<div class="photo-grid">'+photos.map(p=>'<div class="photo-item"><img src="'+p.data+'" alt="'+esc(p.name)+'"></div>').join('')+'</div>';
 }
}
function changePhotoAlbum(d){const ms=[...new Set(pItems().map(p=>p.month))].sort();let i=ms.indexOf(photoAlbumMonth);i+=d;if(i>=0&&i<ms.length){photoAlbumMonth=ms[i];renderPhotos()}}
function updateNewsModeFields(){
 const mode=document.getElementById('nmode')?.value||'static';
 const isStatic=mode==='static';
 const durW=document.getElementById('ndurWrap'),gapW=document.getElementById('ngapWrap');
 if(durW)durW.style.display=isStatic?'none':'block';
 if(gapW)gapW.style.display=isStatic?'none':'block';
}
function saveNewsForm(){
 const title=document.getElementById('ntitle')?.value.trim()||'';
 const text=document.getElementById('ntext')?.value.trim()||'';
 const mode=document.getElementById('nmode')?.value||'static';
 const duration=Number(document.getElementById('ndur')?.value)||18;
 const gap=Math.max(0,Number(document.getElementById('ngap')?.value)||0);
 const start=document.getElementById('nstart')?.value||'';
 const end=document.getElementById('nend')?.value||'';
 const showTitle=!!document.getElementById('nshowtitle')?.checked;
 if(!text){showToast('Bitte Nachricht eingeben');return false;}
 if(start&&end&&start>end){showToast('Das Enddatum darf nicht vor dem Startdatum liegen');return false;}
 if(editingNewsId!==null){
   const n=data.news.find(x=>String(x.id)===String(editingNewsId));
   if(!n){showToast('Die zu bearbeitende Nachricht wurde nicht gefunden');return false;}
   n.title=title;n.text=text;n.mode=mode;n.duration=duration;n.gap=gap;n.startDate=start;n.endDate=end;n.showTitle=showTitle;
 }else{
   data.news.push({id:String(Date.now())+'_'+Math.random().toString(36).slice(2),title,text,mode,duration,gap,startDate:start,endDate:end,showTitle,active:true});
 }
 cancelNewsEdit();renderNewsAdminList();
 return true;
}
async function saveAllNewsChanges(){
 const text=(document.getElementById('ntext')?.value||'').trim();
 if(editingNewsId!==null || text){if(!saveNewsForm())return;}
 if(!save()){const i=document.getElementById('firebaseNewsInfo');if(i)i.textContent='Fehler: lokales Speichern fehlgeschlagen';return}
 const info=document.getElementById('firebaseNewsInfo');
 if(info)info.textContent='Vereinsnachrichten werden in Programm und Firebase gespeichert …';
 try{
   let fb=null;
   if(firebaseReady&&firestoreDb)fb=await syncNewsToFirebase();
   if(document.getElementById('news')?.classList.contains('active'))renderNews();
   if(fb&&!fb.ok)showToast('Lokal gespeichert – aber Firebase: '+(fb.error||fb.message),8000);
   else showToast('Vereinsnachrichten gespeichert'+(fb?' und Firebase aktualisiert':' (nur lokal – Firebase nicht verbunden)'));
 }catch(e){console.error(e);showToast('Speichern der Vereinsnachrichten fehlgeschlagen: '+(e?.message||e),6000);}
}
function editNews(id){
 const n=data.news.find(x=>String(x.id)===String(id));
 if(!n)return;
 editingNewsId=n.id;
 document.getElementById('ntitle').value=n.title||'';
 document.getElementById('ntext').value=n.text||'';
 document.getElementById('nmode').value=n.mode||'static';updateNewsModeFields();
 document.getElementById('nshowtitle').checked=!!n.showTitle;
 document.getElementById('ndur').value=n.duration||18;
 document.getElementById('ngap').value=n.gap??2;
 document.getElementById('nstart').value=n.startDate||'';
 document.getElementById('nend').value=n.endDate||'';
 document.getElementById('newsCancelBtn').style.display='inline-block';
 document.getElementById('ntitle')?.focus();
}
function cancelNewsEdit(){editingNewsId=null;if(document.getElementById('ntitle')){document.getElementById('ntitle').value='';document.getElementById('ntext').value='';document.getElementById('nmode').value='static';if(document.getElementById('nshowtitle'))document.getElementById('nshowtitle').checked=false;document.getElementById('ndur').value=18;document.getElementById('ngap').value=2;document.getElementById('nstart').value='';document.getElementById('nend').value='';document.getElementById('newsCancelBtn').style.display='none'}}
function newsDateActive(n){const today=new Date();const d=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');return (!n.startDate||d>=n.startDate)&&(!n.endDate||d<=n.endDate)}

async function syncNewsToFirebase(){
  if(!ecwRequireCentralSave('Vereinsnachrichten speichern'))return {ok:false,error:'Firebase ist nicht verfügbar'};
  try{await ecwSafetyPreflight('news',(data.news||[]).filter(n=>n&&n.id).length,'Vereinsnachrichten');}
  catch(e){const msg=e?.message||String(e);showToast(msg,8000);return {ok:false,error:msg}}
  const info=document.getElementById('firebaseNewsInfo');
  if(info)info.textContent='Übertragung wird vorbereitet …';
  try{
    let count=0;
    for(const n of (data.news||[])){
      if(!n||!n.id)continue;
      const payload={
        id:String(n.id),
        title:String(n.title||''),
        text:String(n.text||''),
        mode:String(n.mode||'static'),
        active:!!n.active,
        duration:Number(n.duration)||18,
        gap:Number(n.gap??2),
        showTitle:!!n.showTitle,
        startDate:String(n.startDate||''),
        endDate:String(n.endDate||''),
        updatedAt:new Date().toISOString()
      };
      await fbTimeout(firestoreDb.collection('news').doc(String(n.id)).set(payload),60000,'Firebase');
      count++;
    }
    await removeFirebaseDocsNotInSet('news', new Set((data.news||[]).filter(n=>n&&n.id).map(n=>String(n.id))));
    const message=count+' Vereinsnachricht(en) zu Firebase übertragen.';
    if(info)info.textContent=message;
    return {ok:true,count,message};
  }catch(e){
    console.error(e);
    const error=firebaseErrorText(e);
    if(info)info.textContent='Fehler: '+error;
    return {ok:false,error};
  }
}
async function loadNewsFromFirebase(){
  if(!firebaseReady||!firestoreDb)return showToast('Firebase ist nicht verbunden');
  const info=document.getElementById('firebaseNewsInfo');
  if(info)info.textContent='Firebase-Daten werden geladen …';
  try{
    const snap=await firestoreDb.collection('news').get();
    const news=[];
    snap.forEach(doc=>{
      const x=doc.data()||{};
      if(!x.id&&!doc.id)return;
      news.push({
        id:String(x.id||doc.id),
        title:String(x.title||''),
        text:String(x.text||''),
        mode:String(x.mode||'static'),
        active:x.active!==false,
        duration:Number(x.duration)||18,
        gap:Number(x.gap??2),
        showTitle:!!x.showTitle,
        startDate:String(x.startDate||''),
        endDate:String(x.endDate||'')
      });
    });
    data.news=news;
    save();
    renderNewsAdminList();
    if(document.getElementById('news').classList.contains('active'))renderNews();
    const count=news.length;
    if(info)info.textContent=count+' Vereinsnachricht(en) aus Firebase geladen.';
    showToast(count+' Vereinsnachricht(en) aus Firebase geladen');
  }catch(e){
    console.error(e);
    if(info)info.textContent='Fehler: '+(e?.message||e);
    showToast('Firebase-Laden fehlgeschlagen: '+(e?.code||'Regeln prüfen'));
  }
}

function renderNewsAdminList(){const el=document.getElementById('newsAdminList');el.innerHTML='';if(!data.news.length){el.innerHTML='<div class="small">Noch keine Nachrichten vorhanden.</div>';return}data.news.forEach(n=>{const d=document.createElement('div');d.className='list-item';const dates=(n.startDate||n.endDate)?' · '+(n.startDate||'offen')+' bis '+(n.endDate||'offen'):'';const expired=!!(n.endDate&&n.endDate<(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0')));d.innerHTML='<div><b>'+esc(n.title||'Ohne Überschrift')+'</b><div class="small">'+esc(n.text)+'</div><div class="small">'+({static:'Feststehend',fade:'Ein-/Ausblenden',ticker:'Lauftext'}[n.mode]||n.mode)+' · '+(n.duration||18)+' s · Pause '+(n.gap??2)+' s'+dates+(expired?' · ABGELAUFEN (nicht mehr sichtbar)':'')+'</div></div><div class="row"><button onclick="editNews('+jsArg(n.id)+')">Bearbeiten</button><button onclick="toggleNews('+jsArg(n.id)+')">'+(n.active?'Ausblenden':'Einblenden')+'</button><button class="danger" onclick="deleteNews('+jsArg(n.id)+')">Löschen</button></div>';el.appendChild(d)})}
function toggleNews(id){const n=data.news.find(x=>String(x.id)===String(id));if(!n)return;n.active=!n.active;renderNewsAdminList();showToast('Änderung übernommen – bitte unten Speichern')}
let newsDeleteBusy=false;
async function deleteNews(id){
 const target=String(id),n=data.news.find(x=>String(x.id)===target);
 if(!n||newsDeleteBusy)return;
 if(!confirm('Nachricht „'+String(n.title||'Ohne Überschrift')+'“ endgültig aus Firebase und der Vereinsverwaltung löschen?'))return;
 if(!ecwRequireCentralSave('Vereinsnachricht löschen'))return;
 newsDeleteBusy=true;
 const info=document.getElementById('firebaseNewsInfo');
 if(info)info.textContent='Nachricht wird aus Firebase gelöscht …';
 try{
   // Vor jeder destruktiven Änderung eine serverseitige Sicherheitskopie ablegen.
   await ecwSafetyServerSnapshot('news','Einzelne Vereinsnachricht löschen: '+target);
   const ref=firestoreDb.collection('news').doc(target);
   await fbTimeout(ref.delete(),60000,'Firebase (Nachricht löschen)');
   const check=await fbTimeout(ref.get({source:'server'}),45000,'Firebase (Löschen überprüfen)');
   if(check.exists)throw new Error('Die Nachricht ist auf Firebase noch vorhanden.');
   data.news=data.news.filter(x=>String(x.id)!==target);
   if(editingNewsId!==null&&String(editingNewsId)===target)cancelNewsEdit();
   save();renderNewsAdminList();
   if(document.getElementById('news')?.classList.contains('active'))renderNews();
   if(info)info.textContent='Nachricht wurde in Firebase gelöscht.';
   showToast('Nachricht erfolgreich aus Firebase gelöscht');
 }catch(e){
   console.error('Vereinsnachricht löschen:',e);
   const message=firebaseErrorText(e);
   if(info)info.textContent='Löschen fehlgeschlagen: '+message;
   showToast('Nicht gelöscht: '+message,8000);
 }finally{newsDeleteBusy=false}
}
let newsToken=0,newsRaf=0;
function stopNews(){
 newsToken++;                              // ältere Abläufe werden ungültig
 clearTimeout(newsTimer);newsTimer=null;   // setTimeout-Timer
 if(newsRaf){cancelAnimationFrame(newsRaf);newsRaf=0}  // Lauftext-Animation (clearTimeout kann diese nicht stoppen)
}
function renderNews(){
 stopNews();
 const token=newsToken;
 const alive=()=>token===newsToken;
 const active=data.news.filter(n=>n.active&&newsDateActive(n));
 const stacked=active.filter(n=>n.mode!=='ticker');
 const tickerItems=active.filter(n=>n.mode==='ticker');
 const area=document.getElementById('newsArea'),ticker=document.getElementById('ticker'),tickerText=document.getElementById('tickerText'),headline=document.getElementById('tickerHeadline');
 // Alle offenen (aktiven) Nachrichten werden gemeinsam, untereinander, auf einer Seite dargestellt.
 area.style.display='flex';
 if(!stacked.length){
   area.innerHTML='<div class="small">Keine aktuellen Vereinsnachrichten.</div>';
 }else{
   area.innerHTML='<div class="notice-stack">'+stacked.map(n=>'<div class="fade notice-block">'+(n.showTitle&&n.title?'<div class="notice-title">'+esc(n.title)+'</div>':'')+'<div class="notice-text">'+esc(n.text).replace(/\n/g,'<br>')+'</div></div>').join('')+'</div>';
 }
 if(!tickerItems.length){
   ticker.style.display='none';headline.style.display='none';headline.classList.remove('show');
   return;
 }
 ticker.style.display='flex';
 let tIndex=0;
 const showTicker=()=>{
   if(!alive())return;
   const n=tickerItems[tIndex%tickerItems.length];
   const duration=Math.max(1,Number(n.duration)||18)*1000;
   const gap=Math.max(0,Number(n.gap??2))*1000;
   tickerText.textContent=n.text;
   if(n.showTitle && n.title){headline.textContent=n.title;headline.style.display='block';requestAnimationFrame(()=>headline.classList.add('show'));}
   else{headline.style.display='none';headline.classList.remove('show');}
   tickerText.style.transform='translateX(0px)';
   const run=()=>{
     if(!alive())return;
     const startX=ticker.clientWidth;
     const endX=-tickerText.scrollWidth;
     const distance=startX-endX;
     const t0=performance.now();
     tickerText.style.transform='translateX('+startX+'px)';
     const frame=(now)=>{
       if(!alive())return;
       const p=Math.min(1,((now||performance.now())-t0)/duration);
       tickerText.style.transform='translateX('+(startX-distance*p)+'px)';
       if(p<1){newsRaf=requestAnimationFrame(frame)}else{newsRaf=0;newsTimer=setTimeout(next,gap)}
     };
     newsRaf=requestAnimationFrame(frame);
   };
   newsRaf=requestAnimationFrame(run);
   function next(){if(!alive())return;tIndex=(tIndex+1)%tickerItems.length;showTicker();}
 };
 showTicker();
}
window.addEventListener('resize',()=>{if(document.getElementById('tournaments').classList.contains('active'))renderTournaments()});
window.addEventListener('resize',()=>{if(document.getElementById('tournaments')?.classList.contains('active')) requestAnimationFrame(renderTournaments)});
document.addEventListener('fullscreenchange',()=>{ if(document.fullscreenElement){ if(document.getElementById('tournaments').classList.contains('active')){requestAnimationFrame(()=>requestAnimationFrame(()=>renderTournaments()))} }else if(!['tournamentMonths','tournaments','news','photos'].some(id=>document.getElementById(id).classList.contains('active'))) leavePresentationFullscreen(); });

// V2.5.2: Direkte öffentliche Aufrufe werden erst nach dem Firebase-Laden ausgeführt.
window.__directRouteV1248=function(){
  try{
    const params=new URLSearchParams(window.location.search);
    const hash=(window.location.hash||'').toLowerCase();
    const turn=params.get('turniere');
    const seite=(params.get('seite')||'').toLowerCase();
    if(seite==='zeitungsberichte' || hash==='#zeitungsberichte') openTournamentSection('pressReports');
    else if(seite==='eigene-turniere' || hash==='#eigene-turniere') openOwnTournamentsReleased();
    else if(seite==='turnierliste' || seite==='turnierplaner' || hash==='#turnierliste' || hash==='#liste' || hash==='#turnierplaner') openTournamentListDirect();
    else if(seite==='turniere' || hash==='#turniere' || turn==='monatsuebersicht' || hash==='#turniere-monatsuebersicht') openTournamentMonthsOverview();
    else if(seite==='nachrichten' || hash==='#nachrichten') showView('news');
    else if(seite==='fotos' || hash==='#fotos') showView('photos');
    else if(seite==='fotos-sponsoren' || hash==='#fotos-sponsoren') showView('sponsorPhotos');
    else if(seite==='mannschaften' || hash==='#mannschaften') openTeams();
    else if(hash.startsWith('#mannschaft-')) openTeamDirect(hash.slice(12));
    else if(seite==='druckdokumente'||hash.startsWith('#druckdokumente')) ecwDocsOpen(hash.startsWith('#druckdokumente-')?decodeURIComponent(hash.slice(16)):null);
    else if(seite==='startseite' || hash==='#startseite') showView('startseite');
     else if(seite==='links' || hash==='#links') showView('links');
    else if(seite==='mitglieder' || hash==='#mitglieder') openMemberManagement();
    const rh=document.getElementById('routeDiagHome');
    if(rh&&(hash||seite)){rh.textContent='Direktaufruf erkannt: '+(window.location.hash||'')+(window.location.search||'');rh.style.display='block';}

  }catch(e){console.error('Direktaufruf konnte nicht verarbeitet werden:',e)}
};
/* V2.5.2: Öffentliche Firebase-Daten laden, ohne die lokale Sicherung zu überschreiben.
   Wichtig: Die Firebase-Daten bleiben im Arbeitsspeicher. Dadurch werden die großen
   Data-URLs nicht in localStorage geschrieben und die Navigation bleibt unabhängig. */
async function autoLoadPublicFirebaseDataV1245(){
  if(!firebaseReady||!firestoreDb||currentUser==='admin')return;
  if(!firebaseAuthUser&&!isPublicWhiteboardMode())return;
  const loadT=async()=>{
    try{
      const snap=await firestoreDb.collection('tournamentInvitations').get();
      const tournaments={};
      snap.forEach(doc=>{const x=doc.data()||{};if(x.month&&x.data){const i=Number.isFinite(x.index)?x.index:0;(tournaments[x.month]||(tournaments[x.month]=[]))[i]={id:x.id||doc.id,name:x.name||'',endDate:x.endDate||'',data:x.data};}});
      if(snap.size && currentUser!=='admin'){data.tournaments=tournaments;if(tCollection==='tournaments'){currentPage=0;if(document.getElementById('tournamentMonths')?.classList.contains('active'))renderTournamentMonthOverview();if(document.getElementById('tournaments')?.classList.contains('active')){if(!currentMonth||!(data.tournaments[currentMonth]||[]).some(Boolean)) currentMonth=existingMonths()[0]||monthKey();renderTournaments();}}}
    }catch(e){console.warn('Firebase Turniere:',e);}
  };

  const loadZR=async()=>{
    try{
      const snap=await firestoreDb.collection('pressReports').get();
      if(currentUser!=='admin')centralApplyPressReports(snap,{source:'public'});
    }catch(e){console.warn('Firebase Zeitungsberichte:',e);}
  };
  const loadO=async()=>{
    try{
      const snap=await firestoreDb.collection('ownTournamentInvitations').get();
      const own={};
      snap.forEach(doc=>{const x=doc.data()||{};if(x.month&&x.data){const i=Number.isFinite(x.index)?x.index:0;(own[x.month]||(own[x.month]=[]))[i]={id:x.id||doc.id,name:x.name||'',endDate:x.endDate||'',data:x.data}}});
      if(snap.size && currentUser!=='admin'){data.ownTournaments=own;if(tCollection==='ownTournaments'){currentPage=0;if(document.getElementById('tournamentMonths')?.classList.contains('active'))renderTournamentMonthOverview();if(document.getElementById('tournaments')?.classList.contains('active')){initTournaments();}}}
    }catch(e){console.warn('Firebase eigene Turniere:',e);}
  };
  const loadN=async()=>{
    try{
      const snap=await firestoreDb.collection('news').get(); const news=[];
      snap.forEach(doc=>{const x=doc.data()||{};news.push({id:String(x.id||doc.id),title:String(x.title||''),text:String(x.text||''),mode:String(x.mode||'static'),active:x.active!==false,duration:Number(x.duration)||18,gap:Number(x.gap??2),showTitle:!!x.showTitle,startDate:String(x.startDate||''),endDate:String(x.endDate||'')});});
      if(snap.size && currentUser!=='admin'){data.news=news;if(document.getElementById('news')?.classList.contains('active'))renderNews();}
    }catch(e){console.warn('Firebase Nachrichten:',e);}
  };
  const loadP=async()=>{
    try{
      const snap=await firestoreDb.collection('photos').get(); const photos=[],albums={};
      snap.forEach(doc=>{const x=doc.data()||{};if(x.type==='album'&&x.month)albums[x.month]={name:x.name||'',mode:x.mode||'slideshow',duration:Number(x.duration)||5};else if(x.type==='photo'&&x.data&&x.month)photos.push({id:x.id||doc.id,month:x.month,name:x.name||'',data:x.data,order:Number.isFinite(x.index)?x.index:0});});
      if(snap.size && currentUser!=='admin'){photos.sort(comparePhotos);data.photos=photos;data.photoAlbums=albums;if(pCollection==='photos'){photoAlbumMonth=null;if(document.getElementById('photos')?.classList.contains('active')){try{initPhotos()}catch(e){console.error('Firebase Fotos Anzeige:',e);}}}}
    }catch(e){console.warn('Firebase Fotos:',e);}
  };
  const loadSP=async()=>{
    try{
      const snap=await firestoreDb.collection('sponsorPhotos').get(); const photos=[],albums={};
      snap.forEach(doc=>{const x=doc.data()||{};if(x.type==='album'&&x.month)albums[x.month]={name:x.name||'',mode:x.mode||'slideshow',duration:Number(x.duration)||5};else if(x.type==='photo'&&x.data&&x.month)photos.push({id:x.id||doc.id,month:x.month,name:x.name||'',data:x.data,order:Number.isFinite(x.index)?x.index:0});});
      if(snap.size && currentUser!=='admin'){photos.sort(comparePhotos);data.sponsorPhotos=photos;data.sponsorPhotoAlbums=albums;if(pCollection==='sponsorPhotos'){photoAlbumMonth=null;if(document.getElementById('sponsorPhotos')?.classList.contains('active')){try{initPhotos()}catch(e){console.error('Firebase Sponsoren-Fotos Anzeige:',e);}}}}
    }catch(e){console.warn('Firebase Sponsoren-Fotos:',e);}
  };
  const loadTP=async()=>{
    try{
      const snap=await firestoreDb.collection('tournamentPlanner').get();
      const list=[];
      snap.forEach(doc=>{const x=doc.data()||{};list.push({id:String(x.id||doc.id),name:String(x.name||''),date:String(x.date||''),time:String(x.time||''),reportedBy:String(x.reportedBy||''),players:[0,1,2,3].map(i=>String((x.players||[])[i]||'')),location:String(x.location||''),type:String(x.type||''),internal:!!x.internal,calendarExported:!!x.calendarExported,googleEventId:String(x.googleEventId||''),googleEventCalendarId:String(x.googleEventCalendarId||''),calendarExportedBeforeChange:!!x.calendarExportedBeforeChange,googleEventUpdated:String(x.googleEventUpdated||''),googleSyncedFields:tpGoogleStoredFields(x.googleSyncedFields),updatedAt:String(x.updatedAt||'')})});
      if(snap.size && currentUser!=='admin'){
        data.tournamentPlanner=list;
        save();
        if(document.getElementById('tournamentPlanner')?.classList.contains('active')){
          tpPatchVisiblePlannerValues();
          if(tpWhiteboardEditHoldActive())tpKeepWhiteboardEditPosition();
        }
      }
    }catch(e){console.warn('Firebase Turnierplaner:',e);}
  };
  // Parallel laden, damit ein großer Foto-Datensatz die Navigation nicht blockiert.
  return Promise.allSettled([['t',loadT],['t',loadZR],['o',loadO],['n',loadN],['p',()=>loadPhotoPresentation('photos')],['sp',()=>loadPhotoPresentation('sponsorPhotos')],['tp',loadTP]].filter(([k])=>canViewApp(k)).map(([,load])=>load()));
}



function publicWhiteboardFirebaseError(context,e){
  console.error('Whiteboard Firebase '+context+':',e);
  const code=String(e?.code||'');
  if(code.includes('permission-denied')){
    showToast('Firestore-Regeln erlauben den öffentlichen Whiteboard-Zugriff noch nicht. Bitte die aktuellen Firestore-Regeln in Firebase veröffentlichen.',10000);
  }
}

function ecwPublicLoading(show,text){
  const el=document.getElementById('ecwPublicWhiteboardLoading');
  if(!el)return;
  el.style.display=show?'flex':'none';
  if(text)el.textContent=text;
}
async function ecwWaitForFirebasePublic(maxMs=12000){
  const started=Date.now();
  while(Date.now()-started<maxMs){
    if(firebaseReady&&firestoreDb)return true;
    await new Promise(r=>setTimeout(r,120));
  }
  return !!(firebaseReady&&firestoreDb);
}
async function ecwLoadPublicStartPageStrict(){
  if(!firestoreDb)throw new Error('Firestore nicht initialisiert');
  let snap=null;
  try{
    snap=await firestoreDb.collection('appSettings').doc('startseite').get({source:'server'});
  }catch(e){
    // Fallback auf normalen Firestore-Cache nur wenn Server-Lesen fehlschlägt.
    snap=await firestoreDb.collection('appSettings').doc('startseite').get();
  }
  if(!snap.exists)throw new Error('appSettings/startseite fehlt');
  const x=snap.data()||{};
  const cfg=x.config||x.startseite||x;
  const clean=shSane(cfg);
  if(!clean || !Array.isArray(clean.buttons) || clean.buttons.length===0){
    throw new Error('Startseite enthält keine Schaltflächen');
  }
  SH=clean;
  shFirebaseUpdatedAt=x.updatedAt||'';
  shFirebaseUpdatedBy=x.updatedBy||'';
  shFirebaseDirty=false;
  // Nicht in einen leeren lokalen Zustand zurückschreiben, bevor Firebase erfolgreich war.
  shSave(false);
  shRender();
  return true;
}
async function publicWhiteboardBootstrap(){
  if(!isPublicWhiteboardMode())return false;
  ecwPublicLoading(true,'Vereinsinformation wird geladen …');

  try{
    const ready=await ecwWaitForFirebasePublic(12000);
    if(!ready)throw new Error('Firebase konnte nicht initialisiert werden');

    // 1. Startseite und Whiteboard-Freigaben zuerst direkt aus Firebase laden.
    await ecwLoadPublicStartPageStrict();
    await loadWhiteboardResultPermissions();

    // 2. Erst jetzt die sichtbare Startseite öffnen.
    window.__adminPreviewMode=false;
    currentUser=null;
    appPermissions={whiteboard:true,shView:true,tpView:true,tView:true,oView:true,nView:true,pView:true,spView:true,mView:true,lkView:true,mvView:true};
    window.appPermissions=appPermissions;
    showView('startseite');
    updateWhiteboardKioskUI();

    // 3. Restliche öffentliche Daten unabhängig nachladen.
    await Promise.allSettled([
      centralLoadNavigation(),
      loadExternalLinkPreferences(),
      autoLoadPublicFirebaseDataV1245(),
      firestoreDb.collection('teams').get().then(snap=>centralApplyTeams(snap)),
      tpLoadEvalExclusions(),
      tpLoadNameAliases()
    ]);

    const watch=(query,label,apply)=>{
      try{
        return query.onSnapshot(
          snap=>{try{apply(snap)}catch(e){console.error(label+' anwenden:',e)}},
          e=>publicWhiteboardFirebaseError(label,e)
        );
      }catch(e){
        publicWhiteboardFirebaseError(label,e);
        return null;
      }
    };

    watch(firestoreDb.collection('appSettings').doc('startseite'),'Startseite',snap=>{
      if(!snap.exists)return;
      const x=snap.data()||{},cfg=x.config||x.startseite||x;
      const clean=shSane(cfg);
      if(!clean||!Array.isArray(clean.buttons)||clean.buttons.length===0)return;
      SH=clean;
      shFirebaseUpdatedAt=x.updatedAt||'';
      shFirebaseUpdatedBy=x.updatedBy||'';
      shFirebaseDirty=false;
      shSave(false);
      shRender();
    });
    watch(firestoreDb.collection('tournamentPlanner'),'Turnierplaner',centralApplyTournamentPlanner);
    watch(firestoreDb.collection('tournamentInvitations'),'Turniereinladungen',s=>centralApplyTournamentInvitations(s,false));
    watch(firestoreDb.collection('ownTournamentInvitations'),'Eigene Turniere',s=>centralApplyTournamentInvitations(s,true));
    watch(firestoreDb.collection('pressReports'),'Zeitungsberichte',s=>centralApplyPressReports(s,{source:'live'}));
    watch(firestoreDb.collection('news'),'Nachrichten',centralApplyNews);
    watch(firestoreDb.collection('photos'),'Fotos Verein',s=>centralApplyPhotos(s,'photos'));
    watch(firestoreDb.collection('sponsorPhotos'),'Sponsorenfotos',s=>centralApplyPhotos(s,'sponsorPhotos'));
    watch(firestoreDb.collection('teams'),'Mannschaften',centralApplyTeams);
    watch(firestoreDb.collection('linkPreferences').doc('config'),'Linkeinstellungen',snap=>{
      externalLinkPreferences=snap.exists?(snap.data()?.entries||{}):{};
      try{shRender()}catch(e){}
    });
    watch(firestoreDb.collection('appSettings').doc('whiteboardFreigaben'),'Whiteboard-Freigaben',snap=>{
      if(!snap.exists)whiteboardResultPermissions={...WHITEBOARD_RESULT_DEFAULTS};
      else{
        const x=snap.data()||{};
        whiteboardResultPermissions={
          cup:x.cup!==false,
          jahresmeisterschaft:x.jahresmeisterschaft!==false,
          auslosung:x.auslosung!==false,
          stockdart:x.stockdart===true,
          soloPyramide:x.soloPyramide!==false
        };
      }
      try{shRender()}catch(e){}
    });

    // Direkt-Hash erst nach vollständigem Start ausführen.
    if(location.hash && location.hash!=='#whiteboard' && window.__directRouteV1248){
      try{window.__directRouteV1248()}catch(e){}
    }

    ecwPublicLoading(false);
    try{enterPresentationFullscreen()}catch(e){}
    return true;
  }catch(e){
    console.error('Öffentlicher Whiteboard-Start:',e);
    ecwPublicLoading(true,'Vereinsinformation konnte nicht geladen werden. Bitte Internet/Firebase prüfen und erneut laden.');
    return false;
  }
}
// V2.5.2: Direktaufruf sofort ausführen (nicht erst nach dem Firebase-Laden), damit keine Übersichtsseite dazwischen erscheint.
// Die Anzeigen aktualisieren sich selbst, sobald die Firebase-Daten geladen sind (siehe autoLoadPublicFirebaseDataV1245).
try{ if(!isPublicWhiteboardMode() && window.__directRouteV1248) window.__directRouteV1248(); }catch(e){ console.error('Direktaufruf:',e); }
// V2.5.2: Start erst nach Wiederherstellung der gespeicherten Firebase-Anmeldung.
async function ecwWaitForInitialAuth(){
  try{
    if(window.__ecwPersistenceReady){
      await Promise.race([window.__ecwPersistenceReady,new Promise(r=>setTimeout(r,2500))]);
    }
  }catch(e){}
  let trusted=false;
  try{trusted=localStorage.getItem('ecw_whiteboard_trusted_device')==='1'}catch(e){}
  const timeout=trusted?9000:5000;
  const start=Date.now();
  while(!window.__ecwAuthInitialResolved && Date.now()-start<timeout){
    await new Promise(r=>setTimeout(r,100));
  }
  return window.__ecwAuthInitialUser||window.firebaseAuth?.currentUser||null;
}

async function ecwStartupAfterAuth(){
  try{
    const p=new URLSearchParams(location.search);

    // Öffentlicher Whiteboardmodus läuft vollständig ohne Auth-Startlogik.
    if(isPublicWhiteboardMode()){
      await publicWhiteboardBootstrap();
      return;
    }

    const hasDirect=!!(location.hash||p.get('seite')||p.get('turniere'));

    if(hasDirect){
      setTimeout(()=>{
        if(!document.querySelector('.view.active')){
          if(firebaseAuthUser&&prefersPresentationStart())showView('startseite');
          else{loginPurpose='admin';showView('login');}
        }
      },2500);
      return;
    }

    const user=await ecwWaitForInitialAuth();

    if(user){
      firebaseAuthUser=user;
      window.firebaseAuthUser=user;
      await loadAppPermissions(user);

      if(prefersPresentationStart()){
        window.__adminPreviewMode=false;
        currentUser=null;
        showView('startseite');
        try{enterPresentationFullscreen()}catch(e){}
        return;
      }

      updateHomeAdminButton();
      showView('admin');
      return;
    }

    loginPurpose='admin';
    showView('login');

    let trusted=false;
    try{trusted=localStorage.getItem('ecw_whiteboard_trusted_device')==='1'}catch(e){}
    if(trusted){
      const st=document.getElementById('firebaseLoginStatus');
      if(st)st.textContent='Gespeicherte Whiteboard-Anmeldung wurde vom Browser nicht wiederhergestellt. Bitte einmal anmelden.';
    }
  }catch(e){
    console.error('Start nach Auth:',e);
    loginPurpose='admin';
    showView('login');
  }
}
ecwStartupAfterAuth();

// V2.5.2: Sicherheitsnetz für PC und Whiteboard.
// Wenn Firebase keinen Benutzer wiederhergestellt hat, darf die App nicht auf
// einer leeren/roten Ansicht hängen bleiben.
setTimeout(()=>{
  try{
    if(isPublicWhiteboardMode())return;
    if(window.firebaseAuth?.currentUser)return;
    loginPurpose='admin';
    showView('login');
    const st=document.getElementById('firebaseLoginStatus');
    if(st && !st.textContent){
      st.textContent='Bitte anmelden.';
    }
  }catch(e){
    console.warn('Login-Sicherheitsnetz:',e);
    try{loginPurpose='admin';showView('login');}catch(_){}
  }
},9000);

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{window.__publicLoadPromise=autoLoadPublicFirebaseDataV1245();},250));
else setTimeout(()=>{window.__publicLoadPromise=autoLoadPublicFirebaseDataV1245();},250);


/* V2.9.43 – Reservierungssystem-Verwaltung: Einbettung der bestehenden App.
   Kein direkter Firebase-Zugriff auf das fremde Reservierungssystem; Abgleich ist bewusst nur lesend. */
function ecwReservationAdmin(){
 const a=document.getElementById('adminMain');if(!a)return;
 if(appPermissions.admin!==true){showToast('Nur für Administratoren.');return;}
 a.innerHTML='<h2>Reservierungssystem</h2>'+
 '<div class="card"><p>Das Reservierungssystem wird aus dem Verwaltungsordner geladen. Melde dich dort mit deinen bisherigen Zugangsdaten an und öffne den Admin-Bereich. Die Anmeldung bleibt eigenständig.</p>'+ 
 '<div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" onclick="ecwReservationReload()">Reservierung neu laden</button>'+
 '<a href="ecw-reservierung-v2955.html" target="_blank" rel="noopener noreferrer" style="padding:10px;color:#fff">In neuem Tab öffnen ↗</a></div>'+
 '<iframe id="ecwReservationAdminFrame" title="Reservierungssystem" src="ecw-reservierung-v2955.html?v=2.9.55" loading="eager" style="display:block;width:100%;height:640px;min-height:50vh;border:1px solid #777;border-radius:10px;background:#fff;margin-top:12px"></iframe>'+
 '<p class="small">Die lokale Kopie funktioniert beim Öffnen über einen Webserver zuverlässig; Firebase benötigt eine Internetverbindung. Für den produktiven Betrieb die enthaltenen Dateien mit auf GitHub Pages hochladen.</p></div>'+ 
 '<div class="card"><h3>Mitglieder mit Spielerliste vergleichen (Test)</h3>'+
 '<p>Füge die Namen aus dem Reservierungssystem ein – ein Name pro Zeile, oder importiere eine CSV-/TXT-Datei. Der Vergleich verwendet die vorhandene Terminplaner-Spielerliste. Er verändert keine Daten.</p>'+
 '<input type="file" id="ecwReservationNamesFile" accept=".csv,.txt,text/plain,text/csv" onchange="ecwReservationImportNames(this)">'+
 '<textarea id="ecwReservationNames" rows="6" style="width:100%;margin:10px 0" placeholder="Vorname Nachname oder Nachname Vorname – ein Name pro Zeile"></textarea>'+
 '<button type="button" class="primary" onclick="ecwReservationCompare()">Namen vergleichen</button>'+
 '<div id="ecwReservationCompareResult" style="margin-top:14px"></div>'+
 '<p class="small">Hinweis: Ein automatischer Firebase-Abgleich ist erst möglich, wenn Datenstruktur und Berechtigungen des Reservierungssystems geprüft sind. Keine automatische Zusammenführung anhand ähnlicher Namen.</p></div>';
}
function ecwReservationReload(){const f=document.getElementById('ecwReservationAdminFrame');if(f)f.src='ecw-reservierung-v2955.html?v=2.9.55';}
function ecwReservationImportNames(el){
 const f=el?.files?.[0];if(!f)return;
 if(f.size>1024*1024){showToast('Datei zu groß (max. 1 MB)');return;}
 const reader=new FileReader();reader.onload=()=>{const t=document.getElementById('ecwReservationNames');if(t)t.value=String(reader.result||'')};reader.readAsText(f);
}
function ecwReservationCompare(){
 const input=document.getElementById('ecwReservationNames');const target=document.getElementById('ecwReservationCompareResult');if(!input||!target)return;
 const normalize=x=>String(x||'').normalize('NFKC').toLocaleLowerCase('de').replace(/[;,]/g,' ').replace(/\s+/g,' ').trim();
 const list=typeof tpPlayers==='function'?tpPlayers():[];
 const known=new Map();list.forEach(n=>{if(normalize(n)!=='x')known.set(normalize(n),n)});
 const lines=input.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const entries=lines.map(x=>x.includes(';')?x.split(';').filter(Boolean).join(' '):x).filter(Boolean);
 const found=[],missing=[],seen=new Set();
 for(const name of entries){const key=normalize(name);if(!key||seen.has(key))continue;seen.add(key);if(known.has(key))found.push(name);else missing.push(name)}
 const render=arr=>arr.length?'<ul style="max-height:240px;overflow:auto">'+arr.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>Keine</p>';
 target.innerHTML='<p><b>Verglichen:</b> '+seen.size+' &nbsp; <b>Exakt gefunden:</b> '+found.length+' &nbsp; <b>Nicht gefunden:</b> '+missing.length+'</p>'+
 '<h4>Nicht in der Spielerliste gefunden</h4>'+render(missing)+'<h4>Gefunden</h4>'+render(found)+
 '<p class="small">Unterschiedliche Namensreihenfolge, Schreibweisen oder frühere Nachnamen können zu „nicht gefunden“ führen. Bitte manuell prüfen.</p>';
}

// V2.9.47 – eingebettetes Modul; bestehende Anmeldung und Bereichsrechte gelten weiter.
window.ecwCanUseVersammlungen=function(){return !!firebaseAuthUser&&!isWhiteboardUser()&&hasAppPermission('vs')};
function renderVersammlungenAdmin(){
 if(!window.ecwCanUseVersammlungen()){showToast('Versammlungen und Arbeitseinsätze sind nicht freigegeben.');return}
 const a=document.getElementById('adminMain');if(!a)return;
 document.getElementById("admin").classList.add("meeting-wide");
 a.classList.add("meeting-mode");
 a.innerHTML='<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px"><h2 style="margin:0">Versammlungen und Arbeitseinsätze</h2><button type="button" onclick="ecwReturnFromMeetings()">← Zurück zur Verwaltung</button></div><iframe id="vsAdminFrame" title="Versammlungen und Arbeitseinsätze" src="ecw-versammlungen-v2957.html?v=workspace-20261105-fix1" style="width:100%;height:100%;min-height:0;flex:1;border:1px solid #ffffff44;border-radius:12px;background:#16080b" loading="eager"></iframe>';
}

window.addEventListener('message',function(event){if(event.data?.type!=='ECW_MEETING_ACCESS_REQUEST')return;const frame=document.getElementById('vsAdminFrame');if(!frame||event.source!==frame.contentWindow)return;let allowed=false;try{allowed=window.ecwCanUseVersammlungen()===true}catch(e){}event.source.postMessage({type:'ECW_MEETING_ACCESS_RESPONSE',allowed},event.origin==='null'?'*':event.origin)});

async function ecwReturnFromMeetings(){
 const frame=document.getElementById('vsAdminFrame');
 try{if(frame?.contentWindow?.ecwMeetingCloud&&!await frame.contentWindow.ecwMeetingCloud.prepareLeave())return;}
 catch(e){showToast('Speicherung konnte nicht abgeschlossen werden: '+e.message,6000);return}
 renderAdminMenuLanding();
}
