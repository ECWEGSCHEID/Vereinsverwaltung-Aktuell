/* ECW Mitglieder-Mobilzugang: Temperaturdetails für Halle, Außen und Vereinsheim. */
(()=>{'use strict';
 const btn=document.getElementById('ecwMemberTemperatureDetailsButton');
 const panel=document.getElementById('ecwMemberTemperatureDetailsPanel');
 if(!btn||!panel)return;
 const endpoint='https://firestore.googleapis.com/v1/projects/ec-wegscheid-verwaltung-neu/databases/(default)/documents/sensors/temperatures';
 const number=x=>x?.doubleValue!==undefined?Number(x.doubleValue):x?.integerValue!==undefined?Number(x.integerValue):NaN;
 const fmt=(v,dec,u)=>Number.isFinite(v)?v.toLocaleString('de-DE',{minimumFractionDigits:dec,maximumFractionDigits:dec})+' '+u:'—';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function refresh(){panel.textContent='Messwerte werden geladen …';try{
  const r=await fetch(endpoint,{cache:'no-store'});if(!r.ok)throw Error('Firebase HTTP '+r.status);
  const data=await r.json(),f=data.fields||{},d=f.updatedAt?.timestampValue;
  const rows=[['aussen','Außen'],['halle','Halle'],['vereinsheim','Vereinsheim']].map(([k,t])=>'<section style="border-bottom:1px solid #7775;padding:12px 0"><strong>'+esc(t)+'</strong><div>Temperatur: '+fmt(number(f[k]),2,'°C')+'</div><div>Luftfeuchte: '+fmt(number(f[k+'_luftfeuchte_prozent']),2,'%')+'</div><div>Batteriespannung: '+fmt(number(f[k+'_batteriespannung_v']),3,'V')+'</div></section>').join('');
  panel.innerHTML=rows+'<p class="hint">Letzte Übertragung: '+(d?new Date(d).toLocaleString('de-DE'):'unbekannt')+'</p>';
 }catch(e){panel.textContent='Messwerte konnten nicht geladen werden: '+e.message;}}
 btn.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'Messwerte im Detail schließen':'Messwerte im Detail anzeigen';if(open)void refresh();});
})();
