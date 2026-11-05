/* Shared two-column menu. Existing entries stay in the start-page configuration. */
(function(){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
function normalize(d,j){
 d.utilityItems=Array.isArray(j.utilityItems)?j.utilityItems.filter(x=>x&&typeof x.t==='string').slice(0,100).map(x=>({t:x.t.slice(0,250),u:String(x.u||'').slice(0,2048)})):[];
 if(j.utilityMenuInitialized!==true){
  const indices=[];
  d.buttons.forEach((b,i)=>{const name=norm(b.t);if(name==='links'||name==='nutzliches')indices.push(i)});
  for(const i of indices){const b=d.buttons[i],items=Array.isArray(b.sub)&&b.sub.length?b.sub:(b.u&&!String(b.u).endsWith('#links')?[{t:b.t,u:b.u}]:[]),target=norm(b.t)==='links'?d.links:d.utilityItems;
   for(const item of items)if(!target.some(x=>x.t===item.t&&x.u===item.u))target.push({t:item.t,u:item.u||''});
  }
  const at=indices.length?indices[0]:d.buttons.length;
  d.buttons=d.buttons.filter((b,i)=>!indices.includes(i));
  if(!d.buttons.some(b=>b.u==='#ecw-nuetzliches-links'))d.buttons.splice(Math.min(at,d.buttons.length),0,{t:'Nützliches und Links',u:'#ecw-nuetzliches-links'});
 }
 d.utilityMenuInitialized=true;return d;
}
function dialog(){let d=document.getElementById('ecwUtilityDialog');if(!d){d=document.createElement('dialog');d.id='ecwUtilityDialog';d.className='ecw-results-dialog';d.setAttribute('aria-label','Nützliches und Links');d.addEventListener('cancel',()=>document.body.classList.remove('ecw-utility-open'));document.body.append(d)}return d}
function close(){const d=dialog();if(d.close)d.close();else{d.open=false;d.removeAttribute('open')}document.body.classList.remove('ecw-utility-open')}
function home(){close();shOpen=-1;showView('startseite');shRender()}
function open(){const d=dialog();d.style.backgroundImage='url('+JSON.stringify(SH.bg||'assets/startseite-standard.jpg')+')';d.innerHTML='<div class="er-public-shell"><header class="er-public-heading"><h1>Nützliches und Links</h1></header><div class="utility-columns"><section><h2>Links</h2><div id="ecwUtilityLinks" class="utility-buttons"></div></section><section><h2>Nützliches</h2><div id="ecwUtilityItems" class="utility-buttons"></div></section></div><nav class="er-bottom">'+ '<button type="button" onclick="ecwUtility.home()">Zurück zum Startmenü</button></nav></div>';
 for(const [selector,items] of [['ecwUtilityLinks',SH.links||[]],['ecwUtilityItems',SH.utilityItems||[]]]){
  const holder=document.getElementById(selector);for(const item of items){const b=shMakeBtn(item,-1);b.classList.add('er-tile');b.addEventListener('click',e=>{if(!b.classList.contains('nolink')&&!b.classList.contains('app-disabled'))close()});holder.append(b)}
  if(!items.length){const p=document.createElement('p');p.textContent='Noch keine Einträge vorhanden.';holder.append(p)}
 }
 if(!d.open){if(d.showModal)d.showModal();else{d.open=true;d.setAttribute('open','')}}document.body.classList.add('ecw-utility-open');
}
function allowed(){return hasAppPermission('sh')&&(typeof isWhiteboardUser!=='function'||!isWhiteboardUser())}
function adminHtml(){return '<div class="card" id="utilityItemsAdmin"><h3>Nützliches – rechte Menüseite verwalten</h3><p class="small">Die linke Seite verwendet die darüber verwalteten Links. Hier die Einträge für die rechte Seite ergänzen oder verschieben. Anschließend „Startseite speichern“ drücken.</p>'+(SH.utilityItems||[]).map((x,i)=>'<div class="sh-row"><div class="in"><label>Bezeichnung<input value="'+esc(x.t)+'" oninput="ecwUtility.set('+i+',\'t\',this.value)"></label><label>Adresse oder interner Link<input value="'+esc(x.u)+'" oninput="ecwUtility.set('+i+',\'u\',this.value)"></label></div><div class="acts"><button type="button" onclick="ecwUtility.move('+i+',-1)">↑</button><button type="button" onclick="ecwUtility.move('+i+',1)">↓</button><button type="button" class="danger" onclick="ecwUtility.remove('+i+')">Löschen</button></div></div>').join('')+'<div class="row"><button type="button" onclick="ecwUtility.add()">+ Nützliches hinzufügen</button><button type="button" onclick="ecwUtility.open()">👁 Vorschau</button></div></div>'}
function refresh(){shSave();shRender();renderStartseiteAdmin()}
window.ecwUtility={normalize,open,close,home,adminHtml,set(i,k,v){if(!allowed()||!['t','u'].includes(k)||!SH.utilityItems[i])return;SH.utilityItems[i][k]=String(v).slice(0,k==='t'?250:2048);shSave()},add(){if(!allowed())return;(SH.utilityItems=SH.utilityItems||[]).push({t:'Neuer Eintrag',u:''});refresh()},move(i,delta){if(!allowed()||![-1,1].includes(delta))return;const a=SH.utilityItems,j=i+delta;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];refresh()},remove(i){if(!allowed()||!SH.utilityItems[i]||!confirm('Eintrag „'+SH.utilityItems[i].t+'“ löschen?'))return;SH.utilityItems.splice(i,1);refresh()}};
})();
