/* ECW12: Temperaturanzeige aus ecw-technik / temperaturen / aktuell. */
(function(){
 'use strict';
 const ids={halle:'ecwTempHalle',aussen:'ecwTempAussen',vereinsheim:'ecwTempVereinsheim'};
 const status=()=>document.getElementById('ecwTempStatus');
 function update(data){
   const stamp=data.aktualisiert;
   const ms=stamp&&typeof stamp.toMillis==='function'?stamp.toMillis():NaN;
   const stale=!Number.isFinite(ms)||Date.now()-ms>180000||ms>Date.now()+60000;
   for(const [key,id] of Object.entries(ids)){
     const el=document.getElementById(id);if(!el)continue;
     const n=data[key];
     el.textContent=typeof n==='number'&&Number.isFinite(n)?n.toFixed(1).replace('.',',')+' °C':'--,- °C';
     el.style.opacity=stale?'.6':'1';
   }
   const el=status();if(el)el.textContent=stale?'Messwerte noch nicht aktuell':'Aktualisiert: '+new Date(ms).toLocaleTimeString('de-DE');
 }
 function connect(){
   const db=window.ecwTechnikDb,el=status();
   if(!db){if(el)el.textContent=window.ecwTechnikFehler||'Firebase Technik nicht konfiguriert';return;}
   db.collection('temperaturen').doc('aktuell').onSnapshot(snap=>{
     if(snap.exists)update(snap.data()||{});
     else if(el)el.textContent='Warte auf Temperaturdaten';
   },error=>{if(el)el.textContent='Temperaturen: Zugriff nicht möglich';console.warn(error);});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect);else connect();
})();
