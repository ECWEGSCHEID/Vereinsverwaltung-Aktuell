/* ECW 12.11.2026: Temperaturen aus dem bestehenden Verwaltungs-Firebase. */
(function(){
 'use strict';
 const ids={halle:'ecwTempHalle',aussen:'ecwTempAussen',vereinsheim:'ecwTempVereinsheim'};
 const maxAge=10*60*1000; // Raspberry sendet alle 5 Minuten
 const format=new Intl.NumberFormat('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
 let lastData=null;
 function setText(id,value){
   const element=document.getElementById(id);
   if(element)element.textContent=value;
 }
 function setStatus(message){
   setText('ecwTempStatus',message);
   setText('ecwClimateStatus',message);
 }
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
     setText('ecwClimate-'+key+'-temperature',el.textContent);
     for(const metric of ['humidity','battery']){
       const value=data[metric]?.[key];
       setText('ecwClimate-'+key+'-'+metric,typeof value==='number'&&value>=0&&value<=100
         ?format.format(value)+' %':'Kein Messwert');
     }
   }
   setStatus(stale?'Messwerte nicht aktuell':'Aktualisiert: '+new Date(ms).toLocaleTimeString('de-DE'));
 }
 function connect(){
   const dialog=document.getElementById('ecwClimateDialog');
   if(dialog){
     document.querySelectorAll('.ecw-temp-open').forEach(button=>{
       button.addEventListener('click',()=>dialog.showModal());
     });
   }
   const db=window.ecwTechnikDb;
   if(!db){setStatus(window.ecwTechnikFehler||'Firebase nicht konfiguriert');return;}
   db.collection('sensors').doc('temperatures').onSnapshot(snap=>{
     if(snap.exists){lastData=snap.data()||{};render();}
     else{lastData=null;setStatus('Warte auf Temperaturdaten');}
   },error=>{lastData=null;setStatus('Temperaturen: Zugriff nicht möglich');console.warn(error);});
   setInterval(render,30000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect);else connect();
})();
