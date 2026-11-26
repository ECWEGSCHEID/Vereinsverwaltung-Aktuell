/* EC Wegscheid – OneDrive-Ablage (Microsoft Graph).
   Einmalige Einrichtung: App in Microsoft Entra / Azure registrieren („Persönliche Microsoft-Konten“ bzw.
   „Alle Konten“), Plattform „Single-Page-Anwendung“ mit der Adresse der Vereinsverwaltung als Umleitungs-URI,
   Berechtigung Files.ReadWrite. Die Anwendungs-ID (Client-ID) wird in der Vereinsverwaltung gespeichert.
   Hochgeladen wird in den eigenen OneDrive-Speicher des angemeldeten Microsoft-Kontos. */
(function(){
'use strict';
const MSAL_URL='https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js';
const SCOPES=['Files.ReadWrite'];
let cfg=null,app=null,msalPromise=null;

const redirectUri=()=>location.origin+location.pathname.replace(/[^/]*$/,'')+'onedrive-anmeldung.html';
async function loadConfig(){
  if(cfg)return cfg;
  try{const s=await firestoreDb.collection('appSettings').doc('onedrive').get();cfg=s.exists?s.data():{};}catch(e){cfg={};}
  cfg.folder=cfg.folder||'EC Wegscheid/Ergebnisse';
  return cfg;
}
async function saveConfig(next){
  cfg={...(cfg||{}),...next};app=null;
  await firestoreDb.collection('appSettings').doc('onedrive').set({clientId:String(cfg.clientId||'').trim(),folder:String(cfg.folder||'').trim()},{merge:true});
}
function loadMsal(){
  if(window.msal)return Promise.resolve();
  if(!msalPromise)msalPromise=new Promise((res,rej)=>{const s=document.createElement('script');s.src=MSAL_URL;s.onload=res;s.onerror=()=>{msalPromise=null;rej(Error('Microsoft-Anmeldung konnte nicht geladen werden.'));};document.head.appendChild(s);});
  return msalPromise;
}
async function client(){
  await loadConfig();
  if(!/^[0-9a-f-]{36}$/i.test(String(cfg.clientId||'')))throw Error('OneDrive ist noch nicht eingerichtet (Anwendungs-ID fehlt).');
  if(app)return app;
  await loadMsal();
  app=new msal.PublicClientApplication({auth:{clientId:cfg.clientId,authority:'https://login.microsoftonline.com/common',redirectUri:redirectUri()},cache:{cacheLocation:'localStorage'}});
  if(app.initialize)await app.initialize();
  return app;
}
async function token(interactive){
  const a=await client();const account=a.getAllAccounts()[0];
  if(account){try{return (await a.acquireTokenSilent({scopes:SCOPES,account})).accessToken;}catch(e){if(!interactive)throw Error('OneDrive-Anmeldung abgelaufen. Bitte „Mit OneDrive verbinden“.');}}
  else if(!interactive)throw Error('Nicht mit OneDrive verbunden.');
  const r=await a.acquireTokenPopup({scopes:SCOPES,prompt:'select_account'});
  return r.accessToken;
}
async function connect(){const t=await token(true);const me=await graph(t,'GET','/me/drive');return me?.owner?.user?.displayName||'verbunden';}
async function status(){
  try{await loadConfig();if(!cfg.clientId)return {configured:false};const a=await client();const acc=a.getAllAccounts()[0];return {configured:true,connected:!!acc,account:acc?.username||''};}
  catch(e){return {configured:!!cfg?.clientId,connected:false,error:e.message};}
}
async function graph(t,method,path,body,headers){
  const r=await fetch('https://graph.microsoft.com/v1.0'+path,{method,headers:{Authorization:'Bearer '+t,...(headers||{})},body});
  if(!r.ok){let m='';try{m=(await r.json()).error?.message||'';}catch(e){}throw Error('OneDrive: '+(m||('HTTP '+r.status)));}
  return r.status===204?null:r.json().catch(()=>null);
}
const safe=s=>String(s||'').replace(/[\\:*?"<>|#%]/g,'-').replace(/\s+/g,' ').trim().slice(0,120)||'Ergebnis';
// Datei hochladen; fehlende Ordner legt OneDrive automatisch an.
async function upload(folderParts,name,blob){
  const t=await token(false);
  const path=[...String(cfg.folder||'').split('/'),...folderParts].map(safe).filter(Boolean).concat(safe(name)).map(encodeURIComponent).join('/');
  if(blob.size<=4*1024*1024)return graph(t,'PUT','/me/drive/root:/'+path+':/content',blob,{'Content-Type':blob.type||'application/octet-stream'});
  const session=await graph(t,'POST','/me/drive/root:/'+path+':/createUploadSession',JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'replace'}}),{'Content-Type':'application/json'});
  const size=blob.size,chunk=320*1024*10;let res=null;
  for(let start=0;start<size;start+=chunk){
    const end=Math.min(size,start+chunk);
    const r=await fetch(session.uploadUrl,{method:'PUT',headers:{'Content-Range':'bytes '+start+'-'+(end-1)+'/'+size},body:blob.slice(start,end)});
    if(!r.ok&&r.status!==202)throw Error('OneDrive-Upload abgebrochen (HTTP '+r.status+').');
    res=await r.json().catch(()=>null);
  }
  return res;
}
window.ECWOneDrive={loadConfig,saveConfig,connect,status,upload,redirectUri,get config(){return cfg;}};
})();
