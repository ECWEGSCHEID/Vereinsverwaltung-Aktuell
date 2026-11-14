/* ECW: öffentliche Temperaturanzeige und Sensordetails aus sensors/temperatures. */
(function(){
 'use strict';
 const ids={halle:'ecwTempHalle',aussen:'ecwTempAussen',vereinsheim:'ecwTempVereinsheim'};
 const names={halle:'Halle',aussen:'Außen',vereinsheim:'Vereinsheim'};
 const maxAge=7*60*1000;
 let latest=null,received=null;
 const status=()=>document.getElementById('ecwTempStatus');
 const value=(n,d=1,suffix='')=>typeof n==='number'&&Number.isFinite(n)?n.toFixed(d).replace('.',',')+suffix:'—';
 const stampMillis=(v)=>v&&typeof v.toMillis==='function'?v.toMillis():typeof v==='string'?Date.parse(v):typeof v==='number'?v:NaN;
 function update(data){
   latest=data;
   const ms=stampMillis(data.updatedAt||data.aktualisiert);
   const stale=!Number.isFinite(ms)||Date.now()-ms>maxAge||ms>Date.now()+60000;
   for(const [key,id] of Object.entries(ids)){
     const el=document.getElementById(id);if(!el)continue;
     el.textContent=value(data[key],1,' °C');
     el.style.opacity=stale?'.6':'1';
   }
   const el=status();if(el)el.textContent=stale?'Messwerte nicht aktuell':'Aktualisiert: '+new Date(ms).toLocaleTimeString('de-DE');
   const panel=document.getElementById('ecwSensorDetails');
   if(panel && !panel.hidden && received) showDetail(received);
 }
 function showDetail(key){
   if(!latest)return;
   received=key;
   const wrap=document.getElementById('ecwSensorDetails');if(!wrap)return;
   const record=latest;
   const ms=stampMillis(record.updatedAt||record.aktualisiert);
   document.getElementById('ecwSensorDetailsTitle').textContent=names[key]+' – Messwerte';
   document.getElementById('ecwSensorDetailsTemp').textContent=value(record[key],2,' °C');
   document.getElementById('ecwSensorDetailsHum').textContent=value(record[key+'_luftfeuchte_prozent'],2,' %');
   document.getElementById('ecwSensorDetailsVolt').textContent=value(record[key+'_batteriespannung_v'],3,' V');
   document.getElementById('ecwSensorDetailsTime').textContent=Number.isFinite(ms)?'Letzte Übertragung: '+new Date(ms).toLocaleString('de-DE'):'Zeitpunkt unbekannt';
   wrap.hidden=false;
 }
 function addDetailUI(){
   if(document.getElementById('ecwSensorDetails'))return;
   const style=document.createElement('style');style.textContent='#ecwSensorDetails[hidden]{display:none!important}#ecwSensorDetails{position:fixed;z-index:99999;inset:0;background:#000b;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}#ecwSensorDetails .ecw-sensor-card{color:#fff;background:#201b22;border:1px solid #a44;border-radius:14px;padding:22px;max-width:430px;width:100%;box-shadow:0 16px 45px #0009}#ecwSensorDetails .ecw-sensor-card p{font-size:18px;line-height:1.5}#ecwSensorDetails button{background:#a52a35;color:white;border:0;border-radius:8px;padding:10px 17px;cursor:pointer}.ecw-temp-cell[data-sensor]{cursor:pointer}.ecw-temp-cell[data-sensor]:focus-visible{outline:2px solid #fff}';document.head.append(style);
   const panel=document.createElement('div');panel.id='ecwSensorDetails';panel.hidden=true;panel.innerHTML='<div class="ecw-sensor-card" role="dialog" aria-modal="true" aria-labelledby="ecwSensorDetailsTitle"><h2 id="ecwSensorDetailsTitle"></h2><p>Temperatur: <strong id="ecwSensorDetailsTemp"></strong></p><p>Luftfeuchte: <strong id="ecwSensorDetailsHum"></strong></p><p>Batteriespannung: <strong id="ecwSensorDetailsVolt"></strong></p><p id="ecwSensorDetailsTime"></p><button type="button" id="ecwSensorDetailsClose">Schließen</button></div>';
   document.body.append(panel);
   const close=()=>{panel.hidden=true;received=null;};
   panel.querySelector('button').addEventListener('click',close);
   panel.addEventListener('click',e=>{if(e.target===panel)close();});
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close();});
   for(const key of Object.keys(ids)){
     const tile=document.getElementById(ids[key])?.closest('.ecw-temp-cell');if(!tile)continue;
     tile.dataset.sensor=key;tile.tabIndex=0;tile.setAttribute('role','button');tile.setAttribute('aria-label',names[key]+' Messwerte im Detail');
     tile.addEventListener('click',()=>showDetail(key));
     tile.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showDetail(key);}});
   }
 }
 function connect(){
   addDetailUI();
   const db=window.ecwTechnikDb,el=status();
   if(!db){if(el)el.textContent=window.ecwTechnikFehler||'Firebase nicht konfiguriert';return;}
   db.collection('sensors').doc('temperatures').onSnapshot(snap=>{
     if(snap.exists)update(snap.data()||{});
     else if(el)el.textContent='Warte auf Temperaturdaten';
   },error=>{if(el)el.textContent='Temperaturen: Zugriff nicht möglich';console.warn(error);});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect);else connect();
})();
