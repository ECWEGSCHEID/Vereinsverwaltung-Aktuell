/* Separate Wabenmenüs für Links und Nützliches. */
(function(){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
function normalize(d,j){
 d.utilityItems=Array.isArray(j.utilityItems)?j.utilityItems.filter(x=>x&&typeof x.t==='string').slice(0,100).map(x=>({t:x.t.slice(0,250),u:String(x.u||'').slice(0,2048)})):[];
 if(j.utilityMenuInitialized!==true){
  const indices=[];
  d.buttons.forEach((b,i)=>{const name=norm(b.t);if((name==='links'||name==='nutzliches')&&!/#ecw-(?:nuetzliches-links|utility-links)$/.test(b.u))indices.push(i)});
  for(const i of indices){const b=d.buttons[i],items=Array.isArray(b.sub)&&b.sub.length?b.sub:(b.u&&!String(b.u).endsWith('#links')?[{t:b.t,u:b.u}]:[]),target=norm(b.t)==='links'?d.links:d.utilityItems;
   for(const item of items)if(!target.some(x=>x.t===item.t&&x.u===item.u))target.push({t:item.t,u:item.u||''});
  }
  const at=indices.length?indices[0]:d.buttons.length;
  d.buttons=d.buttons.filter((b,i)=>!indices.includes(i));
  if(!d.buttons.some(b=>b.u==='#ecw-nuetzliches-links'))d.buttons.splice(Math.min(at,d.buttons.length),0,{t:'Nützliches und Links',u:'#ecw-nuetzliches-links'});
 }
 const useful=d.buttons.find(b=>String(b.u).endsWith('#ecw-nuetzliches-links'));
 if(useful)useful.t='Nützliches';
 const links=d.buttons.find(b=>String(b.u).endsWith('#ecw-utility-links'));
 if(!links)d.buttons.splice(1,0,{t:'Links',u:'#ecw-utility-links'});
 d.utilityMenuInitialized=true;return d;
}
function dialog(){let d=document.getElementById('ecwUtilityDialog');if(!d){d=document.createElement('dialog');d.id='ecwUtilityDialog';d.className='ecw-results-dialog';d.setAttribute('aria-label','Nützliches und Links');d.addEventListener('cancel',()=>document.body.classList.remove('ecw-utility-open'));document.body.append(d)}return d}
function close(){const d=dialog();if(d.close)d.close();else{d.open=false;d.removeAttribute('open')}document.body.classList.remove('ecw-utility-open')}
function home(){close();shOpen=-1;showView('startseite');shRender()}
const utilityColumns=window.matchMedia('(max-width: 620px)');
let activeMenu='useful',page=0;
function stockTvLabel(title){
 const name=String(title||'').trim();
 const lane=name.match(/^stock[\s-]*tv[\s:–—-]*(?:bahn\s*)?(\d+)$/i)
   ||name.match(/^bahn\s*(\d+)(?:[\s:–—-]+stock[\s-]*tv)?$/i);
 return lane?'Stock TV\nBahn '+lane[1]:title;
}
function renderPage(){
 const d=dialog();
 const items=activeMenu==='links'?SH.links||[]:SH.utilityItems||[];
 const columns=utilityColumns.matches?2:4;
 const pageSize=columns*3;
 const pageCount=Math.max(1,Math.ceil(items.length/pageSize));
 page=Math.min(page,pageCount-1);
 const holder=d.querySelector('.utility-hex-grid');
 holder.style.setProperty('--utility-columns',columns);
 holder.replaceChildren();
 const visible=items.slice(page*pageSize,(page+1)*pageSize);
 visible.forEach((item,i)=>{
  const [row,column]=shStaggeredPosition(i,visible.length,columns);
  const b=shMakeBtn(item,-1);
  if(activeMenu==='useful')b.textContent=stockTvLabel(item.t);
  b.classList.add('utility-hex-tile');
  b.style.gridArea=row+' / '+column+' / span 1 / span 2';
  b.addEventListener('click',()=>{if(!b.classList.contains('nolink')&&!b.classList.contains('app-disabled'))close()});
  holder.append(b);
 });
 d.querySelector('.utility-empty').hidden=items.length!==0;
 const paging=d.querySelector('.utility-paging');
 paging.hidden=pageCount===1;
 paging.querySelector('[data-prev]').disabled=page===0;
 paging.querySelector('[data-next]').disabled=page===pageCount-1;
 paging.querySelector('output').textContent=(page+1)+' / '+pageCount;
}
utilityColumns.addEventListener('change',()=>{
 if(document.getElementById('ecwUtilityDialog')?.open){page=0;renderPage()}
});
function changePage(step){page=Math.max(0,page+step);renderPage()}
function open(menu='useful'){
 if(menu==='links'&&!canViewApp('lk'))return;
 activeMenu=menu;page=0;
 const title=menu==='links'?'Links':'Nützliches';
 const d=dialog();
 d.setAttribute('aria-label',title);
 d.style.backgroundImage='url('+JSON.stringify(SH.bg||'assets/startseite-standard.jpg')+')';
 d.innerHTML='<div class="utility-hex-shell"><h1>'+title+'</h1><div class="utility-hex-grid"></div><p class="utility-empty" hidden>Noch keine Einträge vorhanden.</p><nav class="utility-hex-nav" aria-label="Menünavigation"><div class="utility-paging" hidden><button type="button" data-prev onclick="ecwUtility.changePage(-1)" aria-label="Vorige Seite">‹</button><output aria-live="polite"></output><button type="button" data-next onclick="ecwUtility.changePage(1)" aria-label="Nächste Seite">›</button></div><button type="button" onclick="ecwUtility.home()">Zurück zum Startmenü</button></nav></div>';
 renderPage();
 if(!d.open){if(d.showModal)d.showModal();else{d.open=true;d.setAttribute('open','')}}
 document.body.classList.add('ecw-utility-open');
}
function allowed(){return hasAppPermission('sh')&&(typeof isWhiteboardUser!=='function'||!isWhiteboardUser())}
function adminHtml(){return '<div class="card" id="utilityItemsAdmin"><h3>Nützliches verwalten</h3><p class="small">Hier die Einträge für die Kachel „Nützliches“ ergänzen oder verschieben. Anschließend „Startseite speichern“ drücken.</p>'+(SH.utilityItems||[]).map((x,i)=>'<div class="sh-row"><div class="in"><label>Bezeichnung<input value="'+esc(x.t)+'" oninput="ecwUtility.set('+i+',\'t\',this.value)"></label><label>Adresse oder interner Link<input value="'+esc(x.u)+'" oninput="ecwUtility.set('+i+',\'u\',this.value)"></label></div><div class="acts"><button type="button" onclick="ecwUtility.move('+i+',-1)">↑</button><button type="button" onclick="ecwUtility.move('+i+',1)">↓</button><button type="button" class="danger" onclick="ecwUtility.remove('+i+')">Löschen</button></div></div>').join('')+'<div class="row"><button type="button" onclick="ecwUtility.add()">+ Nützliches hinzufügen</button><button type="button" onclick="ecwUtility.open()">👁 Vorschau</button></div></div>'}
function refresh(){shSave();shRender();renderStartseiteAdmin()}
window.ecwUtility={normalize,open,close,home,changePage,adminHtml,set(i,k,v){if(!allowed()||!['t','u'].includes(k)||!SH.utilityItems[i])return;SH.utilityItems[i][k]=String(v).slice(0,k==='t'?250:2048);shSave()},add(){if(!allowed())return;(SH.utilityItems=SH.utilityItems||[]).push({t:'Neuer Eintrag',u:''});refresh()},move(i,delta){if(!allowed()||![-1,1].includes(delta))return;const a=SH.utilityItems,j=i+delta;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];refresh()},remove(i){if(!allowed()||!SH.utilityItems[i]||!confirm('Eintrag „'+SH.utilityItems[i].t+'“ löschen?'))return;SH.utilityItems.splice(i,1);refresh()}};
})();
