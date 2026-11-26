/* Lokale Übergabe an den eigenen OneDrive-Tab (ecw-onedrive.html). Keine Datei-/Tokenablage auf dem Server.
   Ein Auftrag enthält eine oder mehrere Dateien mit Zielordner (relativ zum OneDrive-Hauptordner, z. B. „02.Auslosungen“). */
(() => {
'use strict';
const DB='ecw-onedrive-export-v1',STORE='jobs',TTL=24*60*60*1000,MAX=100*1024*1024;
function open(){return new Promise((resolve,reject)=>{
 if(!window.indexedDB)return reject(Error('Der Browser unterstützt die lokale Dateiübergabe nicht. Bitte den Download verwenden.'));
 const request=indexedDB.open(DB,1);
 request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(Error('Die lokale Dateiübergabe konnte nicht geöffnet werden. Bitte den Download verwenden.'));
 request.onblocked=()=>reject(Error('Die Dateiübergabe ist in einem anderen Tab blockiert. Bitte andere OneDrive-Fenster schließen.'));
});}
async function transaction(mode,action){const db=await open();return new Promise((resolve,reject)=>{
 const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let result;
 try{const req=action(store);if(req)req.onsuccess=()=>{result=req.result;};}catch(e){db.close();reject(e);return;}
 tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=tx.onerror=()=>{db.close();reject(Error('Dateiübergabe fehlgeschlagen. Eventuell ist der lokale Speicher voll.'));};
});}
async function purge(){return transaction('readwrite',s=>{const req=s.openCursor();req.onsuccess=()=>{const c=req.result;if(c){if(!c.value.createdAt||Date.now()-c.value.createdAt>TTL)c.delete();c.continue();}};});}
const valid=id=>/^[a-f0-9]{32}$/.test(id);
const newId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
async function putJob(files,title,source){
 if(!window.crypto?.getRandomValues)throw Error('Der Browser unterstützt die sichere Dateiübergabe nicht.');
 if(!files.length)throw Error('Keine Dateien für OneDrive.');
 if(files.reduce((n,f)=>n+(f.blob?.size||0),0)>MAX)throw Error('Die Dateien sind zusammen zu groß für die Übergabe (maximal 100 MB).');
 await purge();const id=newId();
 await transaction('readwrite',s=>s.put({id,files,title:String(title||''),source:String(source||''),createdAt:Date.now()}));return id;
}
// Alte Form eines Auftrags (eine SKMR-Datei als Text) in die neue Form bringen.
function normalize(j){
 if(!j||Array.isArray(j.files))return j;
 return {...j,title:j.name,source:'auslosung',files:[{name:j.name,blob:new Blob([j.xml],{type:'application/xml;charset=utf-8'}),path:'02.Auslosungen',unique:true}]};
}
window.ecwOneDriveStore={
 // Auslosung: befüllte SKMR-Datei nach ECWegscheid/02.Auslosungen
 async put(xml,name){
  if(typeof xml!=='string'||!xml.trim()||new Blob([xml]).size>12*1024*1024)throw Error('Die SKMR-Datei fehlt oder ist zu groß (maximal 12 MB).');
  return putJob([{name:String(name||'Auslosung.skmr'),blob:new Blob([xml],{type:'application/xml;charset=utf-8'}),path:'02.Auslosungen',unique:true}],String(name||'Auslosung'),'auslosung');
 },
 // Allgemein: [{name,blob,path,unique?}]
 putFiles:putJob,
 async get(id){if(!valid(id))throw Error('Keine gültige Auftragskennung. Bitte erneut aus der Vereinsverwaltung öffnen.');await purge();const j=await transaction('readonly',s=>s.get(id));if(!j)throw Error('Die bereitgestellten Dateien fehlen oder sind abgelaufen. Bitte erneut aus der Vereinsverwaltung öffnen.');return normalize(j);},
 async remove(id){if(valid(id))await transaction('readwrite',s=>s.delete(id));}
};
})();
