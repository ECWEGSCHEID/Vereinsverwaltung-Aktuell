/* Private PDFs are selected on the user's device; no archive is shipped publicly. */
(function(){
'use strict';
window.ecwImportPrivateArchives=async function(input){
 const files=Array.from(input.files||[]);if(!files.length)return;if(window.ecwArchiveMutationPending){alert('Bitte zuerst die laufende Archivänderung abwarten.');input.value='';return;}
 const message=document.getElementById('meetingCloudStatus');
 try{
  if(!window.parent.ecwCanUseVersammlungen?.())throw Error('Bitte zuerst mit Versammlungsberechtigung anmelden.');
  for(const f of files)if(!/\.pdf$/i.test(f.name))throw Error('Bitte nur PDF-Dateien auswählen.');
  message.textContent='Private Archiv-PDFs werden lokal eingelesen …';
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('ecw_year_files_v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const old=await new Promise((resolve,reject)=>{const r=db.transaction('archives').objectStore('archives').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const incoming=[];
  for(const f of files){if(old.some(x=>x.name===f.name&&x.file?.size===f.size))continue;const match=f.name.match(/20\d{2}/);incoming.push({id:'archive_import_'+Date.now()+'_'+Math.random().toString(36).slice(2),year:match?Number(match[0]):new Date().getFullYear(),name:f.name,created:new Date().toISOString(),file:f})}
  await new Promise((resolve,reject)=>{const tx=db.transaction('archives','readwrite');for(const row of incoming)tx.objectStore('archives').put(row);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>{}});db.close();
  if(window.ecwArchiveManager)await window.ecwArchiveManager.render();
  message.textContent=incoming.length+' Archiv-PDFs lokal übernommen. Jetzt „In Firebase speichern“ wählen und die Speicherbestätigung abwarten. Nach erneutem Öffnen sind sie im Jahresarchiv sichtbar.';
 }catch(e){message.textContent='Archivimport fehlgeschlagen: '+e.message;alert(message.textContent)}finally{input.value=''}
};
})();
