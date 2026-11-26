/* EC Wegscheid – Dateien in OneDrive speichern (eigener Tab, Microsoft-Anmeldung per Weiterleitung).
   Ziel: <Hauptordner>/<Ordner des Auftrags>/<Datei>, z. B. ECWegscheid/02.Auslosungen/…skmr
   oder ECWegscheid/Turniere/2026/Duo Cup/…pdf. Fehlende Ordner legt OneDrive selbst an. */
(() => {
'use strict';
const $=id=>document.getElementById(id),SCOPE='https://graph.microsoft.com/Files.ReadWrite',GRAPH='https://graph.microsoft.com/v1.0';
const CONFIG='ecwOneDriveClientId',ROOT='ecwOneDriveRoot',JOB='ecwOneDriveJobId',redirectUri=new URL('ecw-onedrive.html',location.href).href.split(/[?#]/)[0];
let app=null,job=null,id='',busy=false,account=null,authResult=null,done=false;
const guid=s=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s);
const clean=s=>String(s||'').replace(/["*:<>?\\|#%\x00-\x1f]/g,'_').replace(/[. ]+$/,'').replace(/\s+/g,' ').trim();
const rootFolder=()=>String(localStorage.getItem(ROOT)||'ECWegscheid').split('/').map(clean).filter(Boolean).join('/')||'ECWegscheid';
function status(message){$('status').textContent=message;}
function filename(f){
 if(!f.unique)return clean(f.name).slice(0,150)||'Datei';
 const m=String(f.name).match(/(\.[a-z0-9]{2,5})$/i),ext=m?m[1]:'';
 const base=clean(String(f.name).slice(0,f.name.length-ext.length)).slice(0,100)||'Datei';
 return base+'_'+new Date(job.createdAt).toISOString().replace(/[:.]/g,'-').replace('T','_').replace('Z','')+'_'+job.id.slice(0,12)+ext;
}
const target=f=>[rootFolder(),...String(f.path||'').split('/').map(clean).filter(Boolean)].join('/');
function buttons(){ $('login').disabled=busy||!job||!app||done;$('upload').disabled=busy||!job||!account||done;$('saveSetup').disabled=busy;$('cancel').disabled=busy; }
function showJob(){
 $('title').textContent=job.title||'Dateien';
 $('files').innerHTML='';
 for(const f of job.files){const li=document.createElement('li');li.textContent=target(f)+' / '+filename(f);$('files').appendChild(li);}
}
async function init(){
 if(window.top!==window.self)throw Error('Bitte die OneDrive-Seite in einem eigenen Tab öffnen.');
 if(location.protocol!=='https:'||!window.crypto?.subtle)throw Error('Die Microsoft-Anmeldung benötigt HTTPS und einen Browser mit Web-Crypto-Unterstützung.');
 $('redirectUri').value=redirectUri;$('clientId').value=localStorage.getItem(CONFIG)||'';$('rootFolder').value=rootFolder();
 id=new URLSearchParams(location.hash.slice(1)).get('job')||sessionStorage.getItem(JOB)||'';
 if(id)sessionStorage.setItem(JOB,id);
 job=await window.ecwOneDriveStore.get(id);showJob();
 if(!guid($('clientId').value)){$('setup').open=true;status('Bitte zuerst die einmalige Microsoft-Einrichtung durchführen und die Anwendungs-ID eintragen (oder in der Vereinsverwaltung unter „Ergebnisse eingeben → OneDrive-Einstellungen“).');buttons();return;}
 if(!window.msal)throw Error('Die Microsoft-Anmeldebibliothek konnte nicht geladen werden. Bitte die Seite neu laden.');
 app=new msal.PublicClientApplication({auth:{clientId:$('clientId').value,authority:'https://login.microsoftonline.com/common',redirectUri,navigateToLoginRequestUrl:false},cache:{cacheLocation:'localStorage'},system:{loggerOptions:{piiLoggingEnabled:false,loggerCallback:()=>{}}}});
 await app.initialize();authResult=await app.handleRedirectPromise();
 account=authResult?.account||app.getActiveAccount()||app.getAllAccounts()[0]||null;if(account)app.setActiveAccount(account);
 $('account').textContent=account?'Verbunden mit: '+(account.username||account.name||'Microsoft-Konto'):'Noch nicht mit Microsoft verbunden.';
 buttons();
 if(account)return upload();
 status('Dateien bereit. Bitte mit Microsoft anmelden – danach wird automatisch gespeichert.');
}
async function graph(path,token,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);
 try{
  const response=await fetch(path.startsWith('https:')?path:GRAPH+path,{...options,signal:controller.signal,headers:{...(path.startsWith('https:')?{}:{Authorization:'Bearer '+token}),...options.headers}});
  if(!response.ok&&response.status!==202){let code='';try{code=(await response.json()).error?.code||'';}catch{}
   const e=Error(response.status===401?'Microsoft-Anmeldung abgelaufen. Bitte erneut anmelden.':response.status===403?'Microsoft verweigert den Zugriff. Bitte die Berechtigung Files.ReadWrite und die Zustimmung prüfen.':response.status===429?'OneDrive begrenzt derzeit die Anfragen. Bitte später erneut versuchen.':response.status===507?'Der OneDrive-Speicher ist voll.':'OneDrive-Fehler '+response.status+(code?' ('+code+')':''));e.status=response.status;throw e;
  }
  return response.json().catch(()=>({}));
 }catch(e){if(e.name==='AbortError')throw Error('Die OneDrive-Antwort hat zu lange gedauert. Bitte in OneDrive prüfen, ob die Datei bereits vorhanden ist.');throw e;}finally{clearTimeout(timer);}
}
async function putFile(token,f){
 const path=(target(f)+'/'+filename(f)).split('/').map(encodeURIComponent).join('/');
 const blob=f.blob;
 if(blob.size<=4*1024*1024)return graph('/me/drive/root:/'+path+':/content',token,{method:'PUT',headers:{'Content-Type':blob.type||'application/octet-stream'},body:blob});
 const session=await graph('/me/drive/root:/'+path+':/createUploadSession',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'replace'}})});
 const chunk=320*1024*16;let item=null;
 for(let start=0;start<blob.size;start+=chunk){const end=Math.min(blob.size,start+chunk);
  item=await graph(session.uploadUrl,'',{method:'PUT',headers:{'Content-Range':'bytes '+start+'-'+(end-1)+'/'+blob.size},body:blob.slice(start,end)});}
 return item;
}
$('saveSetup').onclick=()=>{
 const value=$('clientId').value.trim();if(!guid(value)){status('Bitte eine gültige öffentliche Anwendungs-ID eintragen. Keinen geheimen Schlüssel eingeben.');return;}
 localStorage.setItem(CONFIG,value);localStorage.setItem(ROOT,$('rootFolder').value.trim()||'ECWegscheid');location.reload();
};
$('login').onclick=async()=>{
 if(busy||!app||!job)return;busy=true;buttons();
 try{await app.loginRedirect({scopes:[SCOPE],prompt:'select_account'});}catch(e){status('Microsoft-Anmeldung konnte nicht gestartet werden: '+e.message);busy=false;buttons();}
};
async function upload(){
 if(busy||!app||!job||!account||done)return;
 busy=true;buttons();
 try{
  let result;
  try{result=authResult?.accessToken?authResult:await app.acquireTokenSilent({account,scopes:[SCOPE]});}
  catch(e){if(e instanceof msal.InteractionRequiredAuthError){status('Microsoft benötigt eine erneute Anmeldung …');await app.acquireTokenRedirect({account,scopes:[SCOPE]});return;}throw e;}
  const token=result.accessToken;if(!token)throw Error('Microsoft hat keinen Zugriff auf OneDrive bestätigt.');
  const saved=[];let lastUrl='';
  for(const f of job.files){
   status('Wird in OneDrive gespeichert: '+filename(f)+' ('+(saved.length+1)+' von '+job.files.length+') …');
   const item=await putFile(token,f);
   if(!item?.id||Number(item.size)!==f.blob.size)throw Error('Die Speicherung von „'+filename(f)+'“ wurde nicht vollständig bestätigt. Bitte in OneDrive prüfen.');
   saved.push(target(f)+'/'+filename(f));lastUrl=item.webUrl||lastUrl;
  }
  done=true;const savedId=id;job=null;authResult=null;sessionStorage.removeItem(JOB);
  try{await window.ecwOneDriveStore.remove(savedId);}catch{}
  status('In OneDrive gespeichert ✓\n'+saved.join('\n')+'\n\nDieser Tab kann geschlossen werden.');
  if(lastUrl){try{const url=new URL(lastUrl);if(url.protocol==='https:'){$('resultLink').href=url.href;$('resultLink').hidden=false;}}catch{}}
 }catch(e){authResult=null;status('Nicht gespeichert: '+e.message);if(e.status===401){account=null;app.setActiveAccount(null);$('account').textContent='Bitte erneut mit Microsoft anmelden.';}}
 finally{busy=false;buttons();}
}
$('upload').onclick=upload;
$('cancel').onclick=async()=>{
 if(busy)return;
 if(job&&!confirm('Die bereitgestellten Dateien verwerfen? In OneDrive wird dann nichts gespeichert.'))return;
 try{await window.ecwOneDriveStore.remove(id);sessionStorage.removeItem(JOB);job=null;status('Verworfen. Du kannst diesen Tab schließen.');buttons();}catch(e){status(e.message);}
};
window.ecwOneDriveTest={filename,guid,target};
init().catch(e=>{status(e.message);buttons();});
})();
