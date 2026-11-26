/* EC Wegscheid – OneDrive aus der Vereinsverwaltung.
   Die Dateien werden lokal (IndexedDB) übergeben und im eigenen Tab ecw-onedrive.html mit Microsoft-Anmeldung gespeichert –
   dieselbe Seite wie bei „SKMR direkt in OneDrive speichern“ der Auslosung.
   Die öffentliche Anwendungs-ID und der Hauptordner werden zentral in Firebase (appSettings/onedrive) gehalten
   und auf jedem Gerät für die OneDrive-Seite übernommen. */
(function(){
'use strict';
const CONFIG='ecwOneDriveClientId',ROOT='ecwOneDriveRoot';
let cfg=null;
const redirectUri=()=>new URL('ecw-onedrive.html',location.href).href.split(/[?#]/)[0];
function mirror(){try{if(cfg.clientId)localStorage.setItem(CONFIG,cfg.clientId);localStorage.setItem(ROOT,cfg.root);}catch(e){}}
async function loadConfig(){
  if(cfg)return cfg;
  let d={};try{const s=await firestoreDb.collection('appSettings').doc('onedrive').get();d=s.exists?s.data():{};}catch(e){}
  let local='';try{local=localStorage.getItem(CONFIG)||'';}catch(e){}
  cfg={clientId:String(d.clientId||local||'').trim(),root:String(d.root||'ECWegscheid').trim()||'ECWegscheid'};
  mirror();return cfg;
}
async function saveConfig(next){
  await loadConfig();cfg={...cfg,...next};cfg.clientId=String(cfg.clientId||'').trim();cfg.root=String(cfg.root||'').trim()||'ECWegscheid';
  if(cfg.clientId&&!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(cfg.clientId))throw Error('Die Anwendungs-ID hat nicht das richtige Format.');
  await firestoreDb.collection('appSettings').doc('onedrive').set({clientId:cfg.clientId,root:cfg.root},{merge:true});
  mirror();
}
// Muss direkt im Klick aufgerufen werden (sonst blockiert der Browser das neue Fenster).
function openTab(){
  const tab=window.open('about:blank','_blank');
  if(!tab)throw Error('Bitte Pop-ups / neue Tabs für die Vereinsverwaltung erlauben.');
  try{tab.document.title='EC Wegscheid – OneDrive';tab.document.body.textContent='Dateien für OneDrive werden vorbereitet …';}catch(e){}
  return tab;
}
// files: [{name,blob,path}] – path relativ zum Hauptordner, z. B. „Turniere/2026/Duo Cup“
async function send(tab,files,title){
  if(!window.ecwOneDriveStore)throw Error('Die OneDrive-Übergabe ist nicht geladen.');
  const id=await window.ecwOneDriveStore.putFiles(files,title,'ergebnisse');
  const url=new URL('ecw-onedrive.html',location.href);url.hash='job='+id;
  try{tab.opener=null;}catch(e){}
  tab.location.replace(url.href);
}
window.ECWOneDrive={loadConfig,saveConfig,openTab,send,redirectUri,get config(){return cfg;}};
// Einstellungen nach der Anmeldung einmal übernehmen, damit auch die Auslosung sie kennt.
let tries=0;const t=setInterval(()=>{tries++;
  if(window.firebaseAuthUser&&typeof firestoreDb!=='undefined'){clearInterval(t);cfg=null;loadConfig();}else if(tries>60)clearInterval(t);
},5000);
})();
