(() => {
'use strict';
const box=document.getElementById('excel-checkboxes-container');if(!box)return;
const button=document.createElement('button');button.type='button';button.className='btn btn-secondary';button.textContent='Spielerliste aus Firebase laden';
const message=document.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.style.cssText='font-size:.95rem';box.parentElement.insertBefore(button,box);box.parentElement.insertBefore(message,box);
const gender=document.createElement('details');gender.style.cssText='padding:12px;background:#fff;margin-top:12px;border-radius:8px';const summary=document.createElement('summary');summary.textContent='Moar-Regel: Spielerinnen kennzeichnen';const info=document.createElement('p');info.textContent='Keine Geschlechtszuordnung anhand von Vornamen. Für die bestehende Moar-Regel die angemeldeten Spielerinnen hier markieren. Die Kennzeichnung gilt nur für diese geöffnete Auslosung.';const choices=document.createElement('div');gender.append(summary,info,choices);document.getElementById('player-list-container').insertAdjacentElement('afterend',gender);
function renderGender(){
 choices.replaceChildren();for(const name of players){const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:10px;margin:8px 0';const input=document.createElement('input');input.type='checkbox';input.checked=femalePlayers.has(name);input.style.width='auto';input.onchange=()=>input.checked?femalePlayers.add(name):femalePlayers.delete(name);const text=document.createElement('span');text.textContent=name;label.append(input,text);choices.append(label);}
 if(!players.length)choices.textContent='Zuerst Teilnehmer hinzufügen.';
}
const base=updatePlayerListUI;updatePlayerListUI=function(...args){const result=base.apply(this,args);renderGender();return result;};renderGender();
button.onclick=async()=>{
 button.disabled=true;message.textContent='Geschützte Spielerliste wird geladen …';
 try{
  const parent=window.parent;if(parent===window||typeof parent.ecwDrawLoadPlayerList!=='function')throw Error('Bitte aus der angemeldeten Turnierauswertung öffnen.');
  const rows=await parent.ecwDrawLoadPlayerList(),names=new Map(),marked=[];
  for(const row of rows){const name=typeof row==='string'?row:row?.name;if(typeof name!=='string'||!name.trim()||name.length>200)continue;const cleaned=name.trim().replace(/\s+/g,' ');if(/^x$/i.test(cleaned))continue;names.set(cleaned.toLocaleLowerCase('de'),cleaned);if(row&&typeof row==='object'&&(row.female===true||['w','weiblich','female'].includes(String(row.gender||'').toLowerCase())))marked.push(cleaned);}
  if(!names.size)throw Error('Die zentrale Liste enthält keine verwendbaren Namen. Manuelle Eingabe bleibt möglich.');
  excelPlayers.splice(0,excelPlayers.length,...[...names.values()].sort((a,b)=>a.localeCompare(b,'de')));for(const n of marked)femalePlayers.add(n);updateExcelCheckboxes();renderGender();message.textContent=names.size+' Namen aus Firebase geladen. Die Liste liegt nur im Arbeitsspeicher dieses geöffneten Fensters. Kennzeichnung für die Moar-Regel bitte prüfen.';
 }catch(e){message.textContent='Nicht geladen: '+e.message;}finally{button.disabled=false;}
};
})();
