(function(){'use strict';
const el=id=>document.getElementById(id),core=window.ECWMeetingSyncCore;
let remote=null,baseline=null,busy=false,dirty=false,ready=false,timer,stopWatch=null,queued=false,paused=false,conflictRemote=null,editVersion=0,requestedRevision;
const capture=flush=>window.ecwMeetingBackupTools.capture(flush);
function status(t){el('meetingCloudStatus').textContent=t}
function buttons(){el('meetingCloudSave').disabled=busy;el('meetingCloudLoad').disabled=busy||!remote?.backup;el('meetingCloudCheck').disabled=busy}
function adapter(){const a=window.parent.ecwMeetingsCloud;if(!a)throw Error('Bitte in der Vereinsverwaltung anmelden.');return a}
function editing(){const a=document.activeElement;return a&&(a.matches('input:not([type=file]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),textarea,[contenteditable="true"]')||a.isContentEditable)}
function remember(){try{localStorage.setItem('ECW_MEETINGS_CLOUD_META_V1',JSON.stringify({revision:remote.revision,savedAt:remote.savedAt}))}catch{}}
async function safety(backup){return new Promise((resolve,reject)=>{const q=indexedDB.open('ecw_meeting_safety_v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('copies',{autoIncrement:true});q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction('copies','readwrite'),s=tx.objectStore('copies');s.add({created:new Date().toISOString(),backup});const keys=s.getAllKeys();keys.onsuccess=()=>keys.result.slice(0,-8).forEach(k=>s.delete(k));tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>{db.close();reject(tx.error)}}})}
function showConflict(latest){conflictRemote=latest;ready=false;dirty=true;status('Gleichzeitige Änderungen am selben Datenfeld. Beide Fassungen bleiben gesichert. Bitte die gewünschte Fassung wählen.');box.hidden=false}
const box=document.createElement('div');box.hidden=true;box.innerHTML='<p>Gleichzeitige Änderungen</p><button type="button" data-choice="local">Meine Fassung speichern</button> <button type="button" data-choice="remote">Firebase-Fassung verwenden</button>';el('meetingCloudPanel').appendChild(box);
box.addEventListener('click',async e=>{const choice=e.target.dataset.choice;if(!choice||busy)return;if(!confirm(choice==='local'?'Eigene Fassung als gemeinsamen Stand speichern? Die andere Fassung bleibt lokal gesichert.':'Firebase-Fassung übernehmen? Die eigene Fassung bleibt lokal gesichert.'))return;
 busy=true;buttons();try{const latest=await adapter().read();if(latest.revision!==conflictRemote.revision){showConflict(latest);return}const local=await capture(true);await safety(local);await safety(latest.backup);if(choice==='local'){const saved=await adapter().save(local,latest.revision);remote={...saved,backup:local}}else{await window.ecwMeetingApplyLive(latest.backup);remote=latest}baseline=await capture(false);ready=true;dirty=false;conflictRemote=null;box.hidden=true;remember();status('Fassung übernommen. Automatischer Firebase-Abgleich aktiv.')}catch(e){failure(e)}finally{finish()}});
function failure(e){dirty=true;ready=false;if(e.code==='resource-exhausted'||e.code==='permission-denied'){paused=true;stopWatch?.();stopWatch=null}status('Nicht in Firebase bestätigt: '+(e.message||String(e))+'. Browserdaten bleiben erhalten.');}
function finish(){busy=false;if(requestedRevision!==undefined&&requestedRevision===remote?.revision&&!dirty){queued=false;requestedRevision=undefined}buttons();window.dispatchEvent(new Event('ecw-meetings-idle'));if(queued&&!paused){queued=false;schedule()}}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>sync(),1800)}
function watch(){if(stopWatch)return;try{stopWatch=adapter().watch(revision=>{if(revision!==remote?.revision){requestedRevision=revision;queued=true;if(!busy)schedule()}},failure)}catch(e){failure(e)}}
async function sync(retry=false,mutation=false){
 if(busy||paused||conflictRemote||window.ecwArchiveMutationPending&&!mutation)return false;
 if(editing()){queued=true;status('Eingabe läuft. Firebase-Abgleich folgt nach Verlassen des Feldes.');return false}
 const force=queued;busy=true;queued=false;buttons();
 try{
  const started=editVersion;let local=await capture(true);if(baseline&&core.eq(local,baseline)&&!force&&!retry){dirty=false;return true}let latest=await adapter().read({retry});
  if(latest.backup)window.ECWMeetingImportTest.normalize(latest.backup);
  if(editing()||editVersion!==started){queued=true;return false}let target=local;
  if(baseline===null&&latest.backup){if(!core.eq(local,latest.backup)){target=latest.backup}}
  else if(latest.backup&&baseline){const result=core.merge(baseline,local,latest.backup);if(result.conflicts.length){await safety(local);await safety(latest.backup);remote=latest;showConflict(latest);return false}target=result.backup}
  if(!core.eq(local,target)){await safety(local);await window.ecwMeetingApplyLive(target,()=>!editing()&&editVersion===started);target=await capture(false)}
  if(!latest.backup||!core.eq(target,latest.backup)){
   try{const saved=await adapter().save(target,latest.revision);remote={...saved,backup:target}}catch(e){if(e.code==='meeting/conflict'){queued=true;status('Anderes Gerät hat gespeichert. Änderungen werden erneut abgeglichen.');return false}throw e}
  }else remote=latest;
  baseline=remote.backup;dirty=!core.eq(await capture(false),baseline);if(dirty)queued=true;ready=true;remember();watch();status(dirty?'Weitere Eingaben vorhanden. Automatischer Abgleich folgt …':'Automatisch mit Firebase abgeglichen · '+new Date(remote.savedAt).toLocaleString('de-DE'));return true;
 }catch(e){if(e.code==='meeting/defer'){queued=true;return false}failure(e);return false}finally{finish()}
}
async function check(){paused=false;conflictRemote=null;box.hidden=true;return sync(true)}
async function loadRemote(){return check()}
async function saveLocal(automatic=false,mutation=false){return sync(false,mutation)}
async function synchronizeMobile(operation,apply){if(busy||window.ecwArchiveMutationPending){const e=Error('Firebase-Abstimmung läuft.');e.code='mobile/busy';throw e}busy=true;buttons();try{const result=await operation();if(result.remote){result.localMessages=await apply(result.added||[]);remote=result.remote;dirty=true;queued=true}return result}finally{finish()}}
function changed(e){if(el('meetingCloudPanel').contains(e.target))return;dirty=true;editVersion++;schedule()}
document.addEventListener('input',changed);document.addEventListener('change',changed);document.addEventListener('click',changed);
document.addEventListener('focusout',()=>{if(queued||dirty)schedule()});
window.addEventListener('online',()=>{paused=false;schedule()});window.addEventListener('offline',()=>{ready=false;status('Offline. Änderungen bleiben lokal gespeichert und werden nach Wiederverbindung abgeglichen.')});
window.addEventListener('beforeunload',e=>{if(dirty||busy||window.ecwArchiveMutationPending){e.preventDefault();e.returnValue=''}});
setInterval(async()=>{if(busy||paused||editing()||conflictRemote)return;try{if(baseline&&!core.eq(await capture(false),baseline))schedule()}catch(e){failure(e)}},15000);
window.ecwMeetingCloud={check,loadRemote,saveLocal,saveMutation:()=>sync(false,true),synchronizeMobile,isBusy:()=>busy,canWrite:()=>ready&&!busy,hasPending:()=>dirty||busy,async prepareLeave(){await sync();return !dirty||confirm('Stand noch nicht in Firebase bestätigt. Trotzdem zurück zur Verwaltung?')},allowReload(){dirty=false;busy=false;clearTimeout(timer);stopWatch?.()}};
// Download protected local safety copies on demand; never part of the GitHub package.
const recovery=document.createElement('button');recovery.type='button';recovery.textContent='Lokale Sicherungskopie exportieren';recovery.onclick=()=>{const q=indexedDB.open('ecw_meeting_safety_v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('copies',{autoIncrement:true});q.onsuccess=()=>{const db=q.result,r=db.transaction('copies').objectStore('copies').getAll();r.onsuccess=()=>{const copies=r.result.reverse();if(!copies.length){alert('Noch keine lokalen Sicherungskopien vorhanden.');db.close();return}const selected=prompt(copies.map((c,i)=>(i+1)+': '+new Date(c.created).toLocaleString('de-DE')).join('\n')+'\nNummer der Sicherungskopie:', '1');const copy=copies[Number(selected)-1];if(!copy){db.close();return}const u=URL.createObjectURL(new Blob([JSON.stringify(copy.backup)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='ECW_Lokale_Sicherung_'+copy.created.replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);db.close()}}};el('meetingCloudPanel').appendChild(recovery);
buttons();sync();
})();
