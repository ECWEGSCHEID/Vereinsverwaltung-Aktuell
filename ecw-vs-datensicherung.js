(function(){
'use strict';
const prefixes=['ecw_versammlungen','ecw_mannschaft','ecw_work','ecw_gv','ecw_board','ecw_secretary','ecw_year','ecw_team'];
async function encode(value){
 if(value instanceof Blob){const bytes=new Uint8Array(await value.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return {__ecwType:'Blob',mimeType:value.type,size:value.size,name:value.name||null,lastModified:value.lastModified||null,base64:btoa(binary)}}
 if(Array.isArray(value))return Promise.all(value.map(encode));
 if(value&&typeof value==='object'){const result={};for(const [key,entry] of Object.entries(value))result[key]=await encode(entry);return result}return value
}
async function databaseSnapshot(){
 const name='ecw_year_files_v1';
 if(indexedDB.databases){const known=await indexedDB.databases();if(!known.some(d=>d.name===name))return {name,present:false,stores:{}}}
 return new Promise((resolve,reject)=>{const request=indexedDB.open(name);let absent=false;request.onupgradeneeded=()=>{absent=true;request.transaction.abort()};request.onerror=()=>absent?resolve({name,present:false,stores:{}}):reject(request.error);request.onsuccess=()=>{const db=request.result,names=Array.from(db.objectStoreNames),stores={};if(!names.length){db.close();resolve({name,present:true,version:db.version,stores});return}const version=db.version,tx=db.transaction(names,'readonly');for(const storeName of names){stores[storeName]=[];const cursor=tx.objectStore(storeName).openCursor();cursor.onsuccess=()=>{const row=cursor.result;if(row){stores[storeName].push({key:row.key,value:row.value});row.continue()}}}tx.oncomplete=()=>{db.close();resolve({name,present:true,version,stores})};tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error||Error('Dateisicherung abgebrochen.'))}}})
}
window.ecwMeetingBackupTools={
 async capture(flush=true){
  if(flush)document.activeElement?.blur();
  if(typeof gvSave==='function')gvSave(true);
  if(window.yearApi)yearApi.capture();
  if(typeof save==='function')save();
  if(window.msApi)msApi.save();
  const values={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(prefixes.some(prefix=>key.startsWith(prefix)))values[key]=localStorage.getItem(key)}
  return {format:'ecw-versammlungen-backup',schemaVersion:1,applicationVersion:'2.9.51',localStorage:values,indexedDB:[await encode(await databaseSnapshot())]};
 }
};
window.ecwExportBackup=async function(){
 const button=document.getElementById('backupButton'),status=document.getElementById('backupStatus');button.disabled=true;status.textContent='Sicherung wird erstellt …';
 try{
 document.activeElement?.blur();
 if(typeof gvSave==='function')gvSave(true);
 if(window.yearApi)yearApi.capture();
 if(typeof save==='function')save();
 if(window.msApi)msApi.save();
 const values={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(prefixes.some(prefix=>key.startsWith(prefix)))values[key]=localStorage.getItem(key)}
 const raw=await databaseSnapshot(),snapshot=await encode(raw),count=Object.values(raw.stores).reduce((n,rows)=>n+rows.length,0);
 if(!Object.keys(values).length&&!count)throw Error('Keine Versammlungsdaten gefunden. Bitte die bisher benutzte Datei im selben Browser und Ordner öffnen.');
 const backup={format:'ecw-versammlungen-backup',schemaVersion:1,applicationVersion:'3.3',exportedAt:new Date().toISOString(),source:{url:location.href,storage:'localStorage + IndexedDB',firebaseIncluded:false},summary:{localStorageEntries:Object.keys(values).length,indexedDBRecords:count},localStorage:values,indexedDB:[snapshot]};
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'}),stamp=new Date().toISOString().replace(/[:.]/g,'-'),name='ECW_Versammlungen_Sicherung_'+stamp+'.json';
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 status.textContent='Sicherungsdatei erstellt: '+Object.keys(values).length+' gespeicherte Datenbereiche und '+count+' Datei-/Archiveinträge. Bitte die heruntergeladene JSON-Datei aufbewahren.';
 return true;
 }catch(e){status.textContent='Export fehlgeschlagen: '+e.message;alert(status.textContent);return false}finally{button.disabled=false}
};
})();
