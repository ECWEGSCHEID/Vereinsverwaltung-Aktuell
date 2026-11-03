(function(){
'use strict';
const esc=window.gvEsc||((s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
let dbPromise,busy=false,renderNumber=0;
function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('ecw_year_files_v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}))}
async function records(){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('archives').objectStore('archives').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function write(action,row){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('archives','readwrite'),s=tx.objectStore('archives');if(action==='delete')s.delete(row.id);else s.put(row);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Archivänderung abgebrochen.'));tx.onerror=()=>{}})}
function kind(row){if(['gv','board','team'].includes(row.kind))return row.kind;const name=String(row.name||'').toLowerCase();if(/mannschaft|team/.test(name))return 'team';if(/vorstand.*sitz|board/.test(name))return 'board';return 'gv'}
function api(k){return k==='board'?window.ecwBoardArchiveApi:{state:()=>window.msApi.archiveState(),hide:v=>window.msApi.hideArchiveEntry(v)}}
function localEntry(k){if(k==='gv')return null;const s=api(k)?.state();return s?.archived&&!s.hidden?{id:'session:'+k,name:k==='board'?'Freigegebene Vorstandssitzung':'Freigegebene Mannschaftssitzung',created:s.date||'',session:true,kind:k}:null}
function formatDate(s){const d=new Date(s);return !s?'':Number.isNaN(d.getTime())?s:d.toLocaleDateString('de-DE')}
function target(k){if(k==='gv'){let e=document.getElementById('yearArchiveFiles');if(!e){e=document.createElement('div');e.id='yearArchiveFiles';document.getElementById('gvArchivePanel').appendChild(e)}return e}return document.getElementById(k==='board'?'archiveList':'ms_archiveList')}
async function render(){const revision=++renderNumber,all=await records();if(revision!==renderNumber)return;for(const k of ['gv','board','team']){
 const holder=target(k);if(!holder)continue;
 const search=k==='gv'?'':document.getElementById(k==='board'?'archiveSearch':'ms_archiveSearch')?.value.toLowerCase()||'';
 let list=all.filter(r=>kind(r)===k);const pseudo=localEntry(k);if(pseudo)list.push(pseudo);
 list=list.filter(r=>(String(r.name||'')+' '+String(r.year||'')+' '+String(r.created||'')).toLowerCase().includes(search)).sort((a,b)=>String(b.created||'').localeCompare(String(a.created||'')));
 holder.innerHTML=(k==='gv'?'<h3>Erstellte Jahresarchive</h3>':'')+(list.length?list.map(r=>`<div class="archive"><div><b>${esc(r.name||'Archivdatei')}</b><div class="small muted">${esc(formatDate(r.created))}${r.session?' · Freigabeeintrag ohne gespeicherte PDF':''}</div></div><div class="row">${r.session?'':`<button class="btn" data-archive-open="${esc(r.id)}">PDF herunterladen</button>`}<button class="btn red" data-archive-delete="${esc(r.id)}" data-archive-kind="${k}" ${busy?'disabled':''}>Löschen</button></div></div>`).join(''):'<div class="empty">Keine Archivdateien vorhanden.</div>');
 holder.querySelectorAll('[data-archive-open]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.archiveOpen)));
 holder.querySelectorAll('[data-archive-delete]').forEach(b=>b.addEventListener('click',()=>remove(b.dataset.archiveDelete,b.dataset.archiveKind)));
}}
function allowed(){try{return window.parent.ecwCanUseVersammlungen?.()===true}catch{return false}}
async function open(id){try{if(!allowed())throw Error('Bitte anmelden.');const row=(await records()).find(r=>r.id===id);if(!row?.file)throw Error('Archivdatei nicht gefunden.');gvDownload(row.name,row.file)}catch(e){alert(e.message)}}
async function remove(id,k){
 if(busy)return false;
 if(!allowed()){alert('Bitte mit Versammlungsberechtigung anmelden.');return false}
 if(!window.ecwMeetingCloud?.canWrite()){alert('Bitte zuerst die Firebase-Verbindung prüfen und Browser- und Firebase-Stand abgleichen. Danach kann die Archivdatei gelöscht werden.');return false}
 const session=id==='session:'+k;const row=session?localEntry(k):(await records()).find(r=>r.id===id&&kind(r)===k);
 if(!row)return false;
 if(!confirm('„'+row.name+'“ aus diesem Archiv und dem aktuellen Firebase-Stand löschen?\n\nAndere Sitzungen und Berichte bleiben erhalten. Bereits heruntergeladene oder ältere Sicherungskopien werden nicht gelöscht.'))return false;
 busy=true;window.ecwArchiveMutationPending=true;let changed=false;
 try{
  if(session)api(k).hide(true);else await write('delete',row);changed=true;
  await render();
  if(await window.ecwMeetingCloud.saveMutation()!==true)throw Error('Firebase hat die Löschung nicht bestätigt.');
  document.getElementById('meetingCloudStatus').textContent='Archivdatei gelöscht und aktueller Firebase-Stand gespeichert.';
  return true;
 }catch(e){
  if(changed){if(session)api(k).hide(false);else await write('put',row)}
  alert('Löschung nicht abgeschlossen. Der lokale Archiveintrag wurde beibehalten. '+e.message+' Bitte vor weiteren Änderungen Firebase erneut abgleichen.');return false;
 }finally{busy=false;window.ecwArchiveMutationPending=false;await render()}
}
window.ecwArchiveManager={render,remove,kind};
render().catch(e=>{document.getElementById('meetingCloudStatus').textContent='Archiv konnte nicht geladen werden: '+e.message});
})();
