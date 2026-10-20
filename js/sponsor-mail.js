/* EC Wegscheid V2.9.9 – direkter Sponsor-Einzelversand, gleiche Gmail-OAuth-Konfiguration wie Turnierverwaltung */
(function(){
'use strict';
const byId=id=>document.getElementById(id);
const CLIENT_KEY='ecw_gmail_oauth_client_id_v287';
const SENDER='turniereinladungen@ec-wegscheid.de';
const LOGIN='m.stadler1978@gmail.com';
let token='',expires=0,busy=false,client=null;
function status(msg){const el=byId('sponsorMailStatus');if(el)el.textContent=msg;}
window.sponsorMailClose=function(){if(busy)return;byId('sponsorMailDialog').style.display='none';};
function loadGoogle(){
 if(window.google?.accounts?.oauth2)return Promise.resolve();
 if(window.__sponsorGisLoad)return window.__sponsorGisLoad;
 window.__sponsorGisLoad=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
  script.onload=()=>window.google?.accounts?.oauth2?resolve():reject(new Error('Google OAuth ist nicht verfügbar.'));
  script.onerror=()=>reject(new Error('Google-Anmeldeskript konnte nicht geladen werden.'));
  document.head.appendChild(script);
 }).finally(()=>window.__sponsorGisLoad=null);
 return window.__sponsorGisLoad;
}
window.sponsorMailConnect=async function(){
 if(busy)return;
 const clientId=localStorage.getItem(CLIENT_KEY)||'';
 if(!/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId)){
  status('Bitte zuerst in Turnierverwaltung → Einladung senden die Google OAuth-Client-ID hinterlegen.');return;
 }
 try{
  if(!window.google?.accounts?.oauth2){status('Google-Anmeldung wird vorbereitet. Bitte danach nochmals „Mit Gmail verbinden“ wählen.');await loadGoogle();return;}
  client=google.accounts.oauth2.initTokenClient({
   client_id:clientId,scope:'https://www.googleapis.com/auth/gmail.send',login_hint:LOGIN,
   callback:r=>{if(r.error||!r.access_token){status('Google-Anmeldung fehlgeschlagen: '+(r.error_description||r.error||'Kein Zugriffstoken'));return;}
    token=r.access_token;expires=Date.now()+Math.max(0,Number(r.expires_in||3500)-90)*1000;
    status('Gmail verbunden. Bitte Empfänger, Betreff und Nachricht kontrollieren und den Versand bestätigen.');},
   error_callback:e=>status('Google-Anmeldung abgebrochen oder blockiert: '+(e?.type||'Unbekannter Fehler'))
  });
  client.requestAccessToken({prompt:'consent'});
 }catch(e){status('Gmail-Verbindung fehlgeschlagen: '+(e?.message||e));}
};
function b64utf8(s){const b=new TextEncoder().encode(s);let out='';for(let i=0;i<b.length;i+=8192)out+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(out);}
function b64binary(bytes){let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(bin);}
function b64url(bytes){let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function wrap(b64){return b64.match(/.{1,76}/g)?.join('\r\n')||'';}
async function makeMail(to,subject,message,file){
 const boundary='ECW_'+Math.random().toString(36).slice(2);
 const encodedSubject='=?UTF-8?B?'+b64utf8(subject)+'?=';
 const lines=['From: EC Wegscheid <'+SENDER+'>','To: <'+to+'>','Subject: '+encodedSubject,'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="'+boundary+'"','','--'+boundary,
  'Content-Type: text/plain; charset="UTF-8"','Content-Transfer-Encoding: base64','',wrap(b64utf8(message))];
 if(file){
  const name=file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'_').replace(/[\r\n"\\]/g,'_').slice(0,150);
  const data=new Uint8Array(await file.arrayBuffer());
  lines.push('--'+boundary,'Content-Type: application/pdf; name="'+name+'"','Content-Disposition: attachment; filename="'+name+'"',
   'Content-Transfer-Encoding: base64','',wrap(b64binary(data)));
 }
 lines.push('--'+boundary+'--','');
 return b64url(new TextEncoder().encode(lines.join('\r\n')));
}
window.sponsorMailSend=async function(){
 if(busy)return;
 try{if(!window.parent?.firebaseAuthUser||!window.parent?.appPermissions?.admin){status('Nur für zentral angemeldete Administratoren freigegeben.');return;}}
 catch(e){status('Die zentrale Administrator-Anmeldung konnte nicht geprüft werden.');return;}
 const to=byId('sponsorMailTo').value.trim(),subject=byId('sponsorMailSubject').value.trim(),body=byId('sponsorMailBody').value;
 const file=byId('sponsorMailFile').files[0];
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)||/[;,\r\n]/.test(to)){status('Bitte eine gültige Empfängeradresse verwenden.');return;}
 if(!subject||!body.trim()){status('Bitte Betreff und Nachricht ausfüllen.');return;}
 if(file&&(!file.name.toLowerCase().endsWith('.pdf')||file.size>10*1024*1024)){status('Nur PDF-Dateien bis 10 MB sind erlaubt.');return;}
 if(!token||Date.now()>=expires){status('Bitte zuerst „Mit Gmail verbinden“ wählen.');return;}
 if(!confirm('Sponsor-E-Mail jetzt wirklich versenden?\n\nAn: '+to+'\nBetreff: '+subject+'\nAnhang: '+(file?.name||'Keiner')))return;
 busy=true;byId('sponsorMailSendButton').disabled=true;status('Nachricht wird an Gmail übertragen …');
 try{
  const raw=await makeMail(to,subject,body,file);
  const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.id){if(response.status===401)token='';throw Error(result?.error?.message||'HTTP '+response.status);}
  status('Gmail hat den Versand angenommen. Nachrichten-ID: '+result.id);
 }catch(e){status('Versand nicht bestätigt: '+(e?.message||e)+'. Bitte vor einem erneuten Versuch das Gmail-Postfach prüfen.');}
 finally{busy=false;byId('sponsorMailSendButton').disabled=false;}
};
})();
