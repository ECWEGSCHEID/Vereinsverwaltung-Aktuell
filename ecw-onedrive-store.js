/* Lokale Übergabe an den eigenen OneDrive-Tab. Keine Datei-/Tokenablage auf dem Server. */
(() => {
'use strict';
const DB='ecw-onedrive-export-v1',STORE='jobs',TTL=24*60*60*1000;
function open(){return new Promise((resolve,reject)=>{
 if(!window.indexedDB)return reject(Error('Der Browser unterstützt die lokale Dateiübergabe nicht. Bitte den bisherigen SKMR-Download verwenden.'));
 const request=indexedDB.open(DB,1);
 request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(Error('Die lokale Dateiübergabe konnte nicht geöffnet werden. Bitte den SKMR-Download verwenden.'));
 request.onblocked=()=>reject(Error('Die Dateiübergabe ist in einem anderen Tab blockiert. Bitte andere OneDrive-Exportfenster schließen.'));
});}
async function transaction(mode,action){const db=await open();return new Promise((resolve,reject)=>{
 const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let result;
 try{const req=action(store);if(req)req.onsuccess=()=>{result=req.result;};}catch(e){db.close();reject(e);return;}
 tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=tx.onerror=()=>{db.close();reject(Error('Dateiübergabe fehlgeschlagen. Eventuell ist der lokale Speicher voll.'));};
});}
async function purge(){return transaction('readwrite',s=>{const req=s.openCursor();req.onsuccess=()=>{const c=req.result;if(c){if(!c.value.createdAt||Date.now()-c.value.createdAt>TTL)c.delete();c.continue();}};});}
const valid=id=>/^[a-f0-9]{32}$/.test(id);
window.ecwOneDriveStore={
 async put(xml,name){
  if(typeof xml!=='string'||!xml.trim()||new Blob([xml]).size>12*1024*1024)throw Error('Die SKMR-Datei fehlt oder ist zu groß (maximal 12 MB).');
  if(!window.crypto?.getRandomValues)throw Error('Der Browser unterstützt die sichere Dateiübergabe nicht.');
  await purge();const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
  await transaction('readwrite',s=>s.put({id,xml,name:String(name||'Auslosung.skmr'),createdAt:Date.now()}));return id;
 },
 async get(id){if(!valid(id))throw Error('Keine gültige Exportkennung. Bitte erneut über die Auslosung öffnen.');await purge();const j=await transaction('readonly',s=>s.get(id));if(!j)throw Error('Die bereitgestellte Datei fehlt oder ist abgelaufen. Bitte erneut aus der Auslosung öffnen.');return j;},
 async remove(id){if(valid(id))await transaction('readwrite',s=>s.delete(id));}
};
})();
