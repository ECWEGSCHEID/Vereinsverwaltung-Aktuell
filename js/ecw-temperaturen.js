/* ECW 2026-11-14: Whiteboard-Temperaturen + Details, ohne zusätzliche Firebase-Anmeldung. */
(()=>{'use strict';
 const endpoint='https://firestore.googleapis.com/v1/projects/ec-wegscheid-verwaltung-neu/databases/(default)/documents/sensors/temperatures';
 const sensors=[['halle','ecwTempHalle','Halle'],['aussen','ecwTempAussen','Außen'],['vereinsheim','ecwTempVereinsheim','Vereinsheim']];
 let values=null, last=0, current=null;
 const fmt=(v,n=1,unit='')=>Number.isFinite(v)?v.toLocaleString('de-DE',{minimumFractionDigits:n,maximumFractionDigits:n})+unit:'—';
 const number=(o)=>o?.doubleValue!==undefined?Number(o.doubleValue):o?.integerValue!==undefined?Number(o.integerValue):NaN;
 const stamp=(f)=>f?.updatedAt?.timestampValue?new Date(f.updatedAt.timestampValue):null;
 const put=(id,text)=>{const e=document.getElementById(id);if(e)e.textContent=text;};
 function render(){if(!values)return; const f=values;
  for(const [key,id] of sensors){
   put(id,fmt(number(f[key]),1,' °C'));
   const humidity=document.getElementById(id.replace('ecwTemp','ecwHumidity'));
   if(humidity){
    const value=fmt(number(f[key+'_luftfeuchte_prozent']),0,' %');
    humidity.textContent=value;
    humidity.setAttribute('aria-label','Luftfeuchte: '+value);
   }
  }
  const d=stamp(f),age=d?Date.now()-d.getTime():Infinity;
  const note=(age>7*60e3?'Messwerte nicht aktuell · ':'Aktualisiert: ')+(d?d.toLocaleString('de-DE'):'Zeit unbekannt');put('ecwTempStatus',note);
  if(current)detail(current);
 }
 function detail(key){if(!values)return;current=key;const f=values;const x=sensors.find(s=>s[0]===key);if(!x)return;
  put('ecwSensorDetailsTitle',x[2]+' – Messwerte');put('ecwSensorDetailsTemp',fmt(number(f[key]),2,' °C'));
  put('ecwSensorDetailsHum',fmt(number(f[key+'_luftfeuchte_prozent']),2,' %'));
  put('ecwSensorDetailsVolt',fmt(number(f[key+'_batteriespannung_v']),3,' V'));
  const d=stamp(f);put('ecwSensorDetailsTime',d?'Letzte Übertragung: '+d.toLocaleString('de-DE'):'Messzeit nicht verfügbar');
  const panel=document.getElementById('ecwSensorDetails');if(panel)panel.hidden=false;
 }
 function ui(){if(document.getElementById('ecwSensorDetails'))return;
  const css=document.createElement('style');css.textContent='#ecwSensorDetails[hidden]{display:none!important}#ecwSensorDetails{position:fixed;inset:0;z-index:2147483640;background:#000b;display:flex;justify-content:center;align-items:center;padding:14px;box-sizing:border-box}#ecwSensorDetails .panel{background:#231d22;color:#fff;padding:24px;border:2px solid #b34;max-width:420px;width:100%;border-radius:14px;font-size:18px}#ecwSensorDetails button{padding:12px;background:#b32432;color:white;border:0;border-radius:8px}.ecw-temp-cell{cursor:pointer}';document.head.append(css);
  const panel=document.createElement('div');panel.id='ecwSensorDetails';panel.hidden=true;
  panel.innerHTML='<section class="panel" role="dialog" aria-modal="true" aria-labelledby="ecwSensorDetailsTitle"><h2 id="ecwSensorDetailsTitle"></h2><p>Temperatur: <strong id="ecwSensorDetailsTemp"></strong></p><p>Luftfeuchtigkeit: <strong id="ecwSensorDetailsHum"></strong></p><p>Batteriespannung: <strong id="ecwSensorDetailsVolt"></strong></p><p id="ecwSensorDetailsTime"></p><button type="button" id="ecwSensorDetailsClose">Schließen</button></section>';
  document.body.append(panel);const close=()=>{panel.hidden=true;current=null;};panel.querySelector('button').onclick=close;panel.onclick=e=>{if(e.target===panel)close();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close();});
  for(const [key,id,name] of sensors){const tile=document.getElementById(id)?.closest('.ecw-temp-cell');if(!tile)continue;
   tile.tabIndex=0;tile.setAttribute('role','button');tile.setAttribute('aria-label',name+' Messwerte im Detail');tile.onclick=()=>detail(key);
   tile.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();detail(key);}};}
 }
 async function refresh(){try{const r=await fetch(endpoint,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
  const data=await r.json();if(!data.fields)throw Error('keine Messwerte');values=data.fields;last=Date.now();render();
 }catch(e){put('ecwTempStatus','Messwerte nicht erreichbar: '+e.message+(last?' · zuvor gespeichert':''));}}
 function start(){ui();void refresh();setInterval(refresh,60e3);setInterval(render,30e3);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
