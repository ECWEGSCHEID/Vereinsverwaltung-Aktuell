/* EC Wegscheid – Speichern in den OneDrive-Ordner am PC (ohne Microsoft-App).
   Einmal je PC/Browser wird der Ordner „OneDrive\ECWegscheid“ ausgewählt; die Freigabe wird im Browser gemerkt.
   Die OneDrive-App am PC lädt die Dateien dann automatisch hoch. Nur Chrome/Edge am Computer. */
(() => {
'use strict';
const DB='ecw-onedrive-ordner-v1',STORE='h',KEY='root';
const supported=()=>typeof window.showDirectoryPicker==='function';
function db(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function idb(mode,fn){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction(STORE,mode),req=fn(tx.objectStore(STORE));tx.oncomplete=()=>{d.close();res(req&&req.result);};tx.onerror=tx.onabort=()=>{d.close();rej(tx.error);};});}
const getHandle=()=>idb('readonly',s=>s.get(KEY)).catch(()=>null);
const setHandle=h=>idb('readwrite',s=>s.put(h,KEY));
async function choose(){
  if(!supported())throw Error('Speichern in den OneDrive-Ordner geht nur am Computer mit Chrome oder Edge.');
  let h;
  try{h=await window.showDirectoryPicker({id:'ecwOneDrive',mode:'readwrite',startIn:'documents'});}
  catch(e){if(e.name==='AbortError')throw Error('Kein Ordner ausgewählt – in OneDrive wurde nichts gespeichert.');throw e;}
  await setHandle(h);return h;
}
// Direkt im Klick aufrufen: holt den gemerkten Ordner und bittet bei Bedarf um die Freigabe.
async function ensure(){
  if(!supported())throw Error('Speichern in den OneDrive-Ordner geht nur am Computer mit Chrome oder Edge.');
  let h=await getHandle();
  if(!h)return choose();
  const opt={mode:'readwrite'};
  if(await h.queryPermission(opt)==='granted')return h;
  if(await h.requestPermission(opt)==='granted')return h;
  throw Error('Kein Zugriff auf den OneDrive-Ordner erlaubt – in OneDrive wurde nichts gespeichert.');
}
const clean=s=>String(s||'').replace(/["*:<>?\\|\/\x00-\x1f]/g,'_').replace(/[. ]+$/,'').replace(/\s+/g,' ').trim();
// path relativ zum gewählten Ordner, z. B. „Turniere/2026/Duo Cup“
async function write(root,path,name,blob){
  let dir=root;
  for(const part of String(path||'').split('/').map(clean).filter(Boolean))dir=await dir.getDirectoryHandle(part,{create:true});
  const fh=await dir.getFileHandle(clean(name)||'Datei',{create:true});
  const w=await fh.createWritable();try{await w.write(blob);await w.close();}catch(e){await w.abort().catch(()=>{});throw e;}
  return [root.name,...String(path||'').split('/').map(clean).filter(Boolean),clean(name)].join('/');
}
async function info(){const h=await getHandle();return {supported:supported(),folder:h?h.name:''};}
window.ecwOneDriveOrdner={supported,ensure,choose,write,info};
})();
