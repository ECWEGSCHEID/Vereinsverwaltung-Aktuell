/* Firebase adapter: existing signed-in parent session; no second Firebase app. */
(function(){
'use strict';
const CHUNK=240000,MAX=32*1024*1024;
let saving=false,quotaBlocked=false;const known=new Set(),blockCache=new Map();let cacheSize=0;
function cacheBlock(id,value){if(blockCache.has(id)){cacheSize-=blockCache.get(id).length;blockCache.delete(id)}blockCache.set(id,value);cacheSize+=value.length;while(cacheSize>64*1024*1024&&blockCache.size>1){const first=blockCache.keys().next().value;cacheSize-=blockCache.get(first).length;blockCache.delete(first)}}
function quotaError(e){if(e.code==='resource-exhausted'||/quota exceeded/i.test(e.message||''))quotaBlocked=true;return e}
function quotaCheck(retry){if(retry)quotaBlocked=false;if(quotaBlocked)throw fail('resource-exhausted','Firebase-Lesekontingent erreicht. Automatische Versuche sind pausiert. Nach Rücksetzung bewusst Verbindung prüfen.')}
function fail(code,message){const e=new Error(message);e.code=code;return e}
function access(){
 if(!window.ecwCanUseVersammlungen?.()||!firebaseAuthUser||!firestoreDb||firebaseAuth?.currentUser?.uid!==firebaseAuthUser.uid)throw fail('meeting/auth','Bitte mit Berechtigung für Versammlungen in der Vereinsverwaltung anmelden.');
 if(window.navigator?.onLine===false)throw fail('meeting/offline','Keine Internetverbindung. Die Daten bleiben im Browser gespeichert.');
 if(!window.crypto?.subtle)throw fail('meeting/https','Firebase-Speicherung bitte über HTTPS oder localhost öffnen.');
 return firebaseAuthUser.uid;
}
async function digest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')}
function encode(text){const bytes=new TextEncoder().encode(text);let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(binary)}
function decode(text){return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(text),x=>x.charCodeAt(0)))}
const state=()=>firestoreDb.collection('versammlungen').doc('state');
const chunk=id=>firestoreDb.collection('versammlungenChunks').doc(id);
async function read(options={}){
 access();quotaCheck(options.retry===true);
 try{const doc=await state().get({source:'server'});
 if(!doc.exists)return {revision:null,backup:null,savedAt:null};
 const m=doc.data();
 if(m.schemaVersion!==1||typeof m.revision!=='string'||!Array.isArray(m.chunks)||m.chunks.length>200||!m.chunks.length||m.chunks.some(x=>!/^([a-f0-9]{64})$/.test(x))||!Number.isInteger(m.length)||m.length>MAX*1.4)throw fail('meeting/format','Unbekannter oder unvollständiger Firebase-Stand.');
 const result=[];
 for(let i=0;i<m.chunks.length;i+=4){
  const part=await Promise.all(m.chunks.slice(i,i+4).map(async id=>{
   access();if(blockCache.has(id)){const cached=blockCache.get(id);cacheBlock(id,cached);known.add(id);return cached}
   const d=await chunk(id).get({source:'server'}),v=d.exists&&d.data().payload;
   if(typeof v!=='string'||v.length>CHUNK||await digest(v)!==id)throw fail('meeting/incomplete','Firebase-Datei ist unvollständig. Der Browserstand wurde nicht verändert.');known.add(id);cacheBlock(id,v);return v;
  }));result.push(...part);
 }
 const encoded=result.join('');if(encoded.length!==m.length||await digest(encoded)!==m.digest)throw fail('meeting/incomplete','Firebase-Prüfsumme stimmt nicht. Der Browserstand wurde nicht verändert.');
 const backup=JSON.parse(decode(encoded));if(backup.format!=='ecw-versammlungen-backup'||backup.schemaVersion!==1)throw fail('meeting/format','Ungültiges Firebase-Sicherungsformat.');
 return {revision:m.revision,backup,savedAt:m.savedAt,updatedBy:m.updatedBy};
 }catch(e){throw quotaError(e)}
}
async function save(backup,expectedRevision){
 if(saving)throw fail('meeting/busy','Ein Speichervorgang läuft bereits.');
 const uid=access();quotaCheck(false);if(expectedRevision!==null&&typeof expectedRevision!=='string')throw fail('meeting/revision','Bitte zuerst den Firebase-Stand prüfen.');
 if(backup?.format!=='ecw-versammlungen-backup'||backup.schemaVersion!==1||!backup.localStorage||!Object.keys(backup.localStorage).length)throw fail('meeting/format','Keine gültigen Versammlungsdaten zum Speichern.');
 saving=true;
 try{
  const text=JSON.stringify(backup);if(new TextEncoder().encode(text).length>MAX)throw fail('meeting/size','Die Sicherung ist größer als 32 MB. Bitte große Anhänge separat sichern.');
  // Read before staging chunks, then compare again atomically at commit.
  const first=await state().get({source:'server'});if((first.exists?first.data().revision:null)!==expectedRevision)throw fail('meeting/conflict','Ein neuerer Firebase-Stand ist vorhanden. Bitte zuerst „Verbindung prüfen“ und die gewünschte Fassung auswählen.');
  const encoded=encode(text),ids=[];
  for(let i=0;i<encoded.length;i+=CHUNK){const payload=encoded.slice(i,i+CHUNK),id=await digest(payload);ids.push(id);if(!known.has(id)){if(access()!==uid)throw fail('meeting/auth','Anmeldung wurde geändert.');await chunk(id).set({schemaVersion:1,payload});known.add(id);cacheBlock(id,payload)}}
  const revision=crypto.randomUUID(),savedAt=new Date().toISOString(),hash=await digest(encoded);
  await firestoreDb.runTransaction(async tx=>{
   if(access()!==uid)throw fail('meeting/auth','Anmeldung wurde geändert.');
   const current=await tx.get(state()),actual=current.exists?current.data().revision:null;
   if(actual!==expectedRevision)throw fail('meeting/conflict','Zwischenzeitlich hat ein anderes Gerät gespeichert. Deine Browserdaten bleiben erhalten. Bitte den Firebase-Stand erneut prüfen.');
   tx.set(state(),{schemaVersion:1,revision,previousRevision:actual,chunks:ids,length:encoded.length,digest:hash,savedAt,updatedBy:uid});
  });
  return {revision,savedAt};
 }catch(e){throw quotaError(e)}finally{saving=false}
}
function watch(onChange,onError){access();quotaCheck(false);return state().onSnapshot({includeMetadataChanges:true},doc=>{if(doc.metadata?.fromCache||doc.metadata?.hasPendingWrites)return;onChange(doc.exists?doc.data().revision:null)},e=>onError(quotaError(e)))}
window.ecwMeetingsCloud={read,save,watch};
})();
