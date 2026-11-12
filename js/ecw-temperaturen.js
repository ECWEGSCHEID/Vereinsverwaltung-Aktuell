/* ECW 12.11.2026: Temperaturen aus dem bestehenden Verwaltungs-Firebase. */
(function(){
 'use strict';
 const ids={halle:'ecwTempHalle',aussen:'ecwTempAussen',vereinsheim:'ecwTempVereinsheim'};
 const maxAge=10*60*1000; // Raspberry sendet alle 5 Minuten
 const status=()=>document.getElementById('ecwTempStatus');
 let lastData=null;
 function millis(value){
   if(value&&typeof value.toMillis==='function')return value.toMillis();
   if(value&&typeof value.seconds==='number')return value.seconds*1000;
   if(typeof value==='string')return Date.parse(value);
   return NaN;
 }
 function render(){
   const data=lastData;
   if(!data)return;
   const ms=millis(data.updatedAt);
   const age=Date.now()-ms;
   const stale=!Number.isFinite(ms)||age< -60000||age>maxAge;
   for(const [key,id] of Object.entries(ids)){
     const el=document.getElementById(id);if(!el)continue;
     const n=data[key];
     el.textContent=typeof n==='number'&&Number.isFinite(n)?n.toFixed(1).replace('.',',')+' °C':'--,- °C';
     el.style.opacity=stale?'.6':'1';
   }
   const el=status();
   if(el)el.textContent=stale?'Messwerte nicht aktuell': 'Aktualisiert: '+new Date(ms).toLocaleTimeString('de-DE');
 }
 function connect(){
   const db=window.ecwTechnikDb,el=status();
   if(!db){if(el)el.textContent=window.ecwTechnikFehler||'Firebase nicht konfiguriert';return;}
   db.collection('sensors').doc('temperatures').onSnapshot(snap=>{
     if(snap.exists){lastData=snap.data()||{};render();}
     else if(el)el.textContent='Warte auf Temperaturdaten';
   },error=>{if(el)el.textContent='Temperaturen: Zugriff nicht möglich';console.warn(error);});
   setInterval(render,30000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect);else connect();
})();
