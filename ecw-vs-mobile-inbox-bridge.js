(() => {
'use strict';let running=null;const committed=new Map();
function access(requester){if(document.getElementById('vsAdminFrame')?.contentWindow!==requester||!window.ecwCanUseVersammlungen?.()||!firebaseAuthUser||!firestoreDb)throw Error('Bitte mit Versammlungsberechtigung anmelden.');}
async function synchronize(requester){
 access(requester);const uid=firebaseAuthUser.uid;
 const snapshot=await firestoreDb.collection('versammlungenMobile').where('status','==','pending').limit(50).get({source:'server'});access(requester);
 const rows=[];snapshot.forEach(d=>{const r=d.data();rows.push({id:d.id,kind:r.kind,title:r.title,desc:r.desc});});
 if(!rows.length)return {count:0,blocked:[],added:[]};
 let merged,remote;
 for(let attempt=0;attempt<3;attempt++){
  access(requester);if(firebaseAuthUser.uid!==uid)throw Error('Anmeldung wurde geändert.');
  remote=await window.ecwMeetingsCloud.read();
  if(!remote.backup)return {count:0,blocked:rows.map(e=>({id:e.id,reason:'Mobile Punkte sind in Firebase gesichert. Ein gemeinsamer Versammlungsstand muss einmalig eingerichtet werden.'})),added:[]};
  merged=window.ecwMobilePointMerge.merge(remote.backup,rows);
  if(!merged.changed)break;
  try{const saved=await window.ecwMeetingsCloud.save(merged.backup,remote.revision);remote={...saved,backup:merged.backup};break;}
  catch(e){if(e.code==='meeting/conflict'&&attempt<2)continue;throw e;}
 }
 // Quittierung erst nach automatischer Anzeige: Bei geschlossenem Fenster
 // bleibt der Eingang für einen sicheren Wiederanlauf erhalten.
 for(const e of merged.ack)committed.set(e.id,uid);
 return {count:merged.ack.length,remote,added:merged.added,blocked:merged.blocked,ackIds:merged.ack.map(e=>e.id),more:rows.length===50};
}
window.ecwMobileMeetingInbox={
 async acknowledge(requester,ids){
  let failed=0;
  for(const id of ids){try{access(requester);const uid=firebaseAuthUser.uid;if(committed.get(id)!==uid)throw Error('Punkt noch nicht sicher im Serverstand enthalten.');const ref=firestoreDb.collection('versammlungenMobile').doc(id);await firestoreDb.runTransaction(async tx=>{const d=await tx.get(ref);if(!d.exists)throw Error('Punkt fehlt.');if(d.data().status==='imported')return;if(d.data().status!=='pending')throw Error('Unbekannter Status.');tx.update(ref,{status:'imported',importedAt:firebase.firestore.FieldValue.serverTimestamp(),importedBy:uid});});committed.delete(id);}catch{failed++;}}
  return {failed};
 },
 watch(requester,notify,onError){
  access(requester);let stop=()=>{};
  stop=firestoreDb.collection('versammlungenMobile').where('status','==','pending').limit(50).onSnapshot(snapshot=>{
   try{access(requester);if(snapshot.docChanges().some(change=>change.type==='added'))notify();}catch(e){stop();onError(e);}
  },onError);return ()=>stop();
 },
 synchronize(requester){access(requester);if(!running)running=synchronize(requester).finally(()=>{running=null;});return running;}};
})();
