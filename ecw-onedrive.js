(() => {
'use strict';
const $=id=>document.getElementById(id),SCOPE='https://graph.microsoft.com/Files.ReadWrite.AppFolder',GRAPH='https://graph.microsoft.com/v1.0';
const CONFIG='ecwOneDriveClientId',JOB='ecwOneDriveJobId',redirectUri=new URL('ecw-onedrive.html',location.href).href.split(/[?#]/)[0];
let app=null,job=null,id='',busy=false,account=null,authResult=null;
const guid=s=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s);
function status(message){$('status').textContent=message;}
function filename(j){
 const base=j.name.replace(/\.skmr$/i,'').replace(/["*:<>?\/\\|\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'Auslosung';
 return base+'_'+new Date(j.createdAt).toISOString().replace(/[:.]/g,'-').replace('T','_').replace('Z','')+'_'+j.id.slice(0,12)+'.skmr';
}
function buttons(){ $('login').disabled=busy||!job||!app;$('upload').disabled=busy||!job||!account;$('saveSetup').disabled=busy;$('cancel').disabled=busy; }
async function init(){
 if(window.top!==window.self)throw Error('Bitte die OneDrive-Seite in einem eigenen Tab öffnen.');
 if(location.protocol!=='https:'||!window.crypto?.subtle)throw Error('Die Microsoft-Anmeldung benötigt HTTPS und einen Browser mit Web-Crypto-Unterstützung.');
 $('redirectUri').value=redirectUri;
 id=new URLSearchParams(location.hash.slice(1)).get('job')||sessionStorage.getItem(JOB)||'';
 if(id)sessionStorage.setItem(JOB,id);
 job=await window.ecwOneDriveStore.get(id);$('filename').textContent=filename(job);
 $('clientId').value=localStorage.getItem(CONFIG)||'';
 if(!guid($('clientId').value)){$('setup').open=true;status('Bitte zuerst die einmalige Microsoft-Einrichtung durchführen und die Anwendungs-ID eintragen.');buttons();return;}
 if(!window.msal)throw Error('Die Microsoft-Anmeldebibliothek konnte nicht geladen werden. Bitte alle Programmdateien hochladen.');
 app=new msal.PublicClientApplication({auth:{clientId:$('clientId').value,authority:'https://login.microsoftonline.com/common',redirectUri,navigateToLoginRequestUrl:false},cache:{cacheLocation:'sessionStorage'},system:{loggerOptions:{piiLoggingEnabled:false,loggerCallback:()=>{}}}});
 await app.initialize();authResult=await app.handleRedirectPromise();
 account=authResult?.account||app.getActiveAccount()||app.getAllAccounts()[0]||null;if(account)app.setActiveAccount(account);
 $('account').textContent=account?'Verbunden mit: '+(account.username||account.name||'Microsoft-Konto'):'Noch nicht mit Microsoft verbunden.';
 status(account?'Anmeldung bereit. Bitte Dateiname und Konto prüfen und anschließend „Jetzt in OneDrive speichern“ wählen.':'Datei bereit. Bitte mit Microsoft anmelden.');buttons();
}
async function graph(path,token,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await fetch(GRAPH+path,{...options,signal:controller.signal,headers:{Authorization:'Bearer '+token,...options.headers}});
  if(!response.ok){let code='';try{code=(await response.json()).error?.code||'';}catch{}
   const e=Error(response.status===401?'Microsoft-Anmeldung abgelaufen. Bitte erneut anmelden.':response.status===403?'Microsoft verweigert den App-Ordner-Zugriff. Bitte die Berechtigung Files.ReadWrite.AppFolder und die Zustimmung prüfen.':response.status===429?'OneDrive begrenzt derzeit die Anfragen. Bitte später erneut versuchen.':response.status===507?'Der OneDrive-Speicher ist voll.':'OneDrive-Fehler '+response.status+(code?' ('+code+')':''));e.status=response.status;throw e;
  }
  return response.json();
 }catch(e){if(e.name==='AbortError')throw Error('Die OneDrive-Antwort hat zu lange gedauert. Bitte in OneDrive prüfen, ob die Datei bereits vorhanden ist.');throw e;}finally{clearTimeout(timer);}
}
$('saveSetup').onclick=()=>{
 const value=$('clientId').value.trim();if(!guid(value)){status('Bitte eine gültige öffentliche Anwendungs-ID eintragen. Keinen geheimen Schlüssel eingeben.');return;}
 if(app){status('Eine Microsoft-Verbindung ist bereits geladen. Bitte den Export-Tab schließen und aus der Auslosung neu öffnen, um die App zu wechseln.');return;}
 localStorage.setItem(CONFIG,value);location.reload();
};
$('login').onclick=async()=>{
 if(busy||!app||!job)return;busy=true;buttons();
 try{await app.loginRedirect({scopes:[SCOPE],prompt:'select_account'});}catch(e){status('Microsoft-Anmeldung konnte nicht gestartet werden: '+e.message);busy=false;buttons();}
};
$('upload').onclick=async()=>{
 if(busy||!app||!job||!account)return;
 if(!confirm('Die Datei „'+filename(job)+'“ im App-Ordner des Microsoft-Kontos '+(account.username||account.name||'')+' speichern?'))return;
 busy=true;buttons();
 try{
  let result;
  try{result=authResult?.accessToken?authResult:await app.acquireTokenSilent({account,scopes:[SCOPE]});}
  catch(e){if(e instanceof msal.InteractionRequiredAuthError){status('Microsoft benötigt eine erneute Anmeldung. Danach Speichern nochmals wählen.');await app.acquireTokenRedirect({account,scopes:[SCOPE]});return;}throw e;}
  const token=result.accessToken;if(!token)throw Error('Microsoft hat keinen Zugriff auf OneDrive bestätigt.');
  status('OneDrive-App-Ordner wird geöffnet …');
  const folder=await graph('/me/drive/special/approot',token);if(!folder.id)throw Error('Microsoft hat keinen App-Ordner zurückgegeben.');
  status('SKMR-Datei wird in OneDrive gespeichert …');const name=filename(job),blob=new Blob([job.xml],{type:'application/xml;charset=utf-8'});
  const item=await graph('/me/drive/items/'+encodeURIComponent(folder.id)+':/'+encodeURIComponent(name)+':/content',token,{method:'PUT',headers:{'Content-Type':'application/xml;charset=utf-8'},body:blob});
  if(!item.id||item.name!==name||Number(item.size)!==blob.size)throw Error('Die Speicherung wurde nicht vollständig bestätigt. Bitte die Datei in OneDrive prüfen.');
  // Erst nach bestätigtem Upload die lokale Übergabe entfernen.
  const savedId=id;job=null;authResult=null;sessionStorage.removeItem(JOB);
  try{await window.ecwOneDriveStore.remove(savedId);status('In OneDrive bestätigt gespeichert: '+name);}catch{status('In OneDrive bestätigt gespeichert: '+name+'\nDie lokale Exportkopie konnte noch nicht entfernt werden. Mit „Lokale Exportkopie entfernen“ erneut versuchen.');}
  if(item.webUrl){try{const url=new URL(item.webUrl);if(url.protocol==='https:'){$('resultLink').href=url.href;$('resultLink').hidden=false;}}catch{}}
 }catch(e){authResult=null;status('Nicht bestätigt gespeichert: '+e.message);if(e.status===401){account=null;app.setActiveAccount(null);$('account').textContent='Bitte erneut mit Microsoft anmelden.';}}
 finally{busy=false;buttons();}
};
$('cancel').onclick=async()=>{
 if(busy)return;
 if(job&&!confirm('Die lokale Exportkopie entfernen? Die Auslosung und bereits gespeicherte OneDrive-Dateien bleiben erhalten.'))return;
 try{await window.ecwOneDriveStore.remove(id);sessionStorage.removeItem(JOB);job=null;status('Lokale Exportkopie entfernt. Du kannst diesen Tab schließen und zur Auslosung zurückkehren.');buttons();}catch(e){status(e.message);}
};
window.ecwOneDriveTest={filename,guid};
init().catch(e=>{status(e.message);buttons();});
})();
