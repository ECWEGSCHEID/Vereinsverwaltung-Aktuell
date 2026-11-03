(() => {
'use strict';
const el=id=>document.getElementById(id),host=document.querySelector('main')||document.body;
const tile=(id,icon,title,desc)=>`<button class="tile" id="${id}" type="button"><span class="ico">${icon}</span><span><h2>${title}</h2><p>${desc}</p></span></button>`;
const more=document.createElement('section');more.id='moreView';more.className='panel hidden';more.innerHTML='<div class="section-head"><h2>Weitere Funktionen</h2><button type="button" class="secondary" data-home>← Übersicht</button></div><div class="grid" id="moreTiles"></div>';host.append(more);
const grid=el('tileTv').parentElement;
for(const id of ['tileNews','tileJm'])el('moreTiles').append(el(id));
el('moreTiles').insertAdjacentHTML('beforeend',tile('tileCup','🏆','Interne Cup','Vorhandene Cupauswertung öffnen.'));
grid.insertAdjacentHTML('beforeend',tile('tileBoardPoint','📝','Vorstandssitzung','Tagesordnungspunkt hinzufügen.')+tile('tileWorkPoint','🛠','Arbeitseinsatz','Arbeitspunkt hinzufügen.')+tile('tileMore','☰','Weitere Funktionen','Vereinsnachrichten, Ziel-Jahresmeisterschaft und Interne Cup.'));
const form=document.createElement('section');form.id='mobilePointView';form.className='panel hidden';form.innerHTML=`<div class="section-head"><h2 id="mobilePointHeading">Neuer Punkt</h2><button type="button" class="secondary" data-home>← Übersicht</button></div><p>Der Punkt wird direkt in Firebase gespeichert. Beim Öffnen der Versammlungen erscheint er automatisch in der aktuellen offenen Vorstandssitzung bzw. im aktiven offenen Arbeitseinsatz.</p><label>Titel</label><input id="mobilePointTitle" maxlength="160"><label>Beschreibung</label><textarea id="mobilePointDesc" maxlength="10000" rows="5"></textarea><button type="button" id="mobilePointSave">Punkt in Firebase speichern</button><div id="mobilePointStatus" class="status" role="status" aria-live="polite"></div>`;host.append(form);
let kind='board',busy=false,retry=null;
const permitted=()=>can('vs')&&profile?.active!==false;
const originalApply=applyTiles;applyTiles=function(){originalApply();for(const id of ['tileBoardPoint','tileWorkPoint']){el(id).disabled=!permitted();el(id).classList.toggle('locked',!permitted());}el('tileCup').disabled=!currentUser;el('tileMore').disabled=!currentUser;};
function openPoint(type){if(!permitted())return;kind=type;retry=null;el('mobilePointHeading').textContent=type==='board'?'Vorstandssitzung – Tagesordnungspunkt hinzufügen':'Arbeitseinsatz – Punkt hinzufügen';el('mobilePointTitle').value='';el('mobilePointDesc').value='';setStatus('mobilePointStatus','');show('mobilePointView');}
async function submit(){
 if(busy||!currentUser||!permitted())return;
 const title=el('mobilePointTitle').value.trim(),desc=el('mobilePointDesc').value.trim(),uid=currentUser.uid;
 if(!title||title.length>160||desc.length>10000)return setStatus('mobilePointStatus','Bitte einen Titel eingeben (maximal 160 Zeichen). Die Beschreibung darf maximal 10.000 Zeichen haben.','err');
 const signature=JSON.stringify({title,desc,kind,uid});if(!retry||retry.signature!==signature)retry={signature,ref:db.collection('versammlungenMobile').doc()};
 busy=true;el('mobilePointSave').disabled=true;setStatus('mobilePointStatus','Punkt wird in Firebase gespeichert …');
 try{
  await db.runTransaction(async tx=>{
   const snap=await tx.get(retry.ref);
   if(snap.exists){const old=snap.data();if(old.createdBy!==uid||old.kind!==kind||old.title!==title||old.desc!==desc)throw Error('Die Eingabe konnte nicht eindeutig bestätigt werden. Bitte neu öffnen.');return;}
   tx.set(retry.ref,{kind,title,desc,status:'pending',createdBy:uid,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
  });
  setStatus('mobilePointStatus','In Firebase bestätigt gespeichert ✓ · Der Punkt erscheint beim Öffnen der Versammlungen automatisch. Kein zusätzlicher Übernahme-Schritt nötig.','ok');el('mobilePointTitle').value='';el('mobilePointDesc').value='';retry=null;
 }catch(e){setStatus('mobilePointStatus','Nicht bestätigt gespeichert: '+(e.code==='permission-denied'?'Berechtigung oder Firebase-Regeln für mobile Punkte fehlen.':e.message),'err');}
 finally{busy=false;el('mobilePointSave').disabled=false;}
}
document.addEventListener('DOMContentLoaded',()=>{
 el('tileBoardPoint').onclick=()=>openPoint('board');el('tileWorkPoint').onclick=()=>openPoint('work');el('tileMore').onclick=()=>{show('moreView');applyTiles();};el('tileCup').onclick=()=>{if(currentUser)location.href='turnierauswertung.html?seite=cup';};el('mobilePointSave').onclick=submit;
 more.querySelector('[data-home]').onclick=()=>{show('homeView');applyTiles();};form.querySelector('[data-home]').onclick=()=>{show('homeView');applyTiles();};
 for(const id of ['newsView','jmView']){const back=el(id)?.querySelector('[data-home]');if(back){back.textContent='← Weitere Funktionen';back.onclick=()=>{show('moreView');applyTiles();};}}
 document.querySelectorAll('.qr-item').forEach(item=>{if(item.textContent.includes('Vereinsnachrichten')||item.textContent.includes('Ziel Jahresmeisterschaft'))item.append(document.createTextNode(' · unter Weitere Funktionen'));});
});
})();
